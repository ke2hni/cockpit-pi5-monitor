#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_NAME=$(basename "$0")
PROJECT_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
DEFAULT_PLUGIN_ID="pi-monitor"
DEFAULT_INSTALL_ROOT="/usr/local/share/cockpit"
DEFAULT_HISTORY_PATH="/var/lib/pi-monitor/history.ndjson"
APT_UPDATED=0
INTERACTIVE=0
HISTORY_COMPONENTS_INSTALLED=0
[[ -t 0 && -t 1 ]] && INTERACTIVE=1

REAL_USER="${SUDO_USER:-}"
if [[ -z "$REAL_USER" || "$REAL_USER" == "root" ]]; then
  REAL_USER=$(logname 2>/dev/null || true)
fi
if [[ -z "$REAL_USER" || "$REAL_USER" == "root" ]]; then
  REAL_USER=""
fi

declare -a SUMMARY_ALREADY_OK=()
declare -a SUMMARY_INSTALLED=()
declare -a SUMMARY_UPDATED=()
declare -a SUMMARY_SKIPPED=()
declare -a SUMMARY_WARNINGS=()
declare -a SUMMARY_ACTIONS=()

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

warn() {
  printf '[%s] WARNING: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
  SUMMARY_WARNINGS+=("$*")
}

die() {
  printf '[%s] ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
  print_summary 1
  exit 1
}

add_summary_unique() {
  local array_name="$1"
  local value="$2"
  local -n arr_ref="$array_name"
  local item
  for item in "${arr_ref[@]:-}"; do
    [[ "$item" == "$value" ]] && return 0
  done
  arr_ref+=("$value")
}

ask_yes_no() {
  local prompt="$1"
  local default_answer="${2:-N}"
  local answer=""

  if [[ "$INTERACTIVE" -ne 1 ]]; then
    [[ "$default_answer" =~ ^[Yy]$ ]]
    return
  fi

  while true; do
    read -r -p "$prompt " answer || true
    answer=${answer:-$default_answer}
    case "$answer" in
      Y|y|Yes|yes) return 0 ;;
      N|n|No|no) return 1 ;;
      *) printf 'Please answer y or n.\n' ;;
    esac
  done
}

run_checked() {
  local description="$1"
  shift
  log "$description"
  "$@"
}

require_root() {
  [[ "$EUID" -eq 0 ]] || die "Run this installer as root, usually with sudo."
}

ensure_project_root() {
  cd "$PROJECT_ROOT"
}

require_file() {
  local path="$1"
  [[ -e "$path" ]] || die "Required file missing: $path"
}

find_first_existing() {
  local candidate
  for candidate in "$@"; do
    if [[ -e "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

apt_update_once() {
  if [[ "$APT_UPDATED" -eq 1 ]]; then
    return 0
  fi

  log "Refreshing APT package metadata"
  if ! apt-get update; then
    die "apt-get update failed. Cannot safely compare or install packages."
  fi
  APT_UPDATED=1
}

package_is_installed() {
  local pkg="$1"
  dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q "install ok installed"
}

package_installed_version() {
  local pkg="$1"
  dpkg-query -W -f='${Version}' "$pkg" 2>/dev/null || true
}

package_candidate_version() {
  local pkg="$1"
  apt-cache policy "$pkg" 2>/dev/null | awk '/Candidate:/ {print $2; exit}'
}

package_needs_upgrade() {
  local pkg="$1"
  local installed candidate
  installed=$(package_installed_version "$pkg")
  candidate=$(package_candidate_version "$pkg")
  [[ -n "$installed" && -n "$candidate" && "$candidate" != "(none)" ]] || return 1
  dpkg --compare-versions "$installed" lt "$candidate"
}

install_package() {
  local pkg="$1"
  DEBIAN_FRONTEND=noninteractive apt-get install -y "$pkg"
}

upgrade_package() {
  local pkg="$1"
  DEBIAN_FRONTEND=noninteractive apt-get install -y --only-upgrade "$pkg"
}

ensure_command_works() {
  local command_name="$1"
  local test_cmd="$2"

  command -v "$command_name" >/dev/null 2>&1 || die "Command not found after package validation: $command_name"
  if ! bash -lc "$test_cmd" >/dev/null 2>&1; then
    die "Command validation failed for $command_name"
  fi
}

ensure_required_package() {
  local pkg="$1"
  local friendly="$2"
  local command_name="$3"
  local test_cmd="$4"
  local installed_version candidate_version

  apt_update_once

  if ! package_is_installed "$pkg"; then
    log "Installing missing required package: $pkg ($friendly)"
    install_package "$pkg"
    add_summary_unique SUMMARY_INSTALLED "$pkg (required)"
  else
    installed_version=$(package_installed_version "$pkg")
    candidate_version=$(package_candidate_version "$pkg")
    if package_needs_upgrade "$pkg"; then
      if ask_yes_no "Required package $pkg is outdated ($installed_version -> $candidate_version). Update it now? [Y/n]" "Y"; then
        log "Updating required package: $pkg"
        upgrade_package "$pkg"
        add_summary_unique SUMMARY_UPDATED "$pkg: $installed_version -> $candidate_version"
      else
        warn "Required package $pkg is outdated and was not updated by user choice."
        add_summary_unique SUMMARY_SKIPPED "$pkg update skipped ($installed_version < $candidate_version)"
      fi
    else
      add_summary_unique SUMMARY_ALREADY_OK "$pkg ($installed_version)"
    fi
  fi

  ensure_command_works "$command_name" "$test_cmd"
}

ensure_optional_package() {
  local pkg="$1"
  local recommendation="$2"
  local default_answer="$3"
  local installed_version candidate_version

  apt_update_once

  if ! package_is_installed "$pkg"; then
    if ask_yes_no "$recommendation Install $pkg now? [y/N]" "$default_answer"; then
      log "Installing optional package: $pkg"
      install_package "$pkg"
      add_summary_unique SUMMARY_INSTALLED "$pkg (optional)"
    else
      add_summary_unique SUMMARY_SKIPPED "$pkg not installed"
    fi
  else
    installed_version=$(package_installed_version "$pkg")
    candidate_version=$(package_candidate_version "$pkg")
    if package_needs_upgrade "$pkg"; then
      if ask_yes_no "Optional package $pkg is outdated ($installed_version -> $candidate_version). Update it now? [y/N]" "N"; then
        log "Updating optional package: $pkg"
        upgrade_package "$pkg"
        add_summary_unique SUMMARY_UPDATED "$pkg: $installed_version -> $candidate_version"
      else
        add_summary_unique SUMMARY_SKIPPED "$pkg update skipped ($installed_version < $candidate_version)"
      fi
    else
      add_summary_unique SUMMARY_ALREADY_OK "$pkg ($installed_version)"
    fi
  fi
}

check_pi5_hardware() {
  local model=""
  model=$(tr -d '\0' </proc/device-tree/model 2>/dev/null || true)
  [[ -n "$model" ]] || model=$(grep -m1 '^Model' /proc/cpuinfo 2>/dev/null | cut -d: -f2- | xargs || true)

  [[ "$model" == *"Raspberry Pi 5"* ]] || die "This installer only supports Raspberry Pi 5 hardware. Detected: ${model:-unknown}"
  add_summary_unique SUMMARY_ALREADY_OK "Hardware verified: ${model:-Raspberry Pi 5}"
}

resolve_plugin_id() {
  local manifest="$PROJECT_ROOT/manifest.json"
  local parsed=""

  if [[ -f "$manifest" ]]; then
    parsed=$(python3 - <<'PY' "$manifest"
import json, sys
path = sys.argv[1]
try:
    with open(path, 'r', encoding='utf-8') as fh:
        data = json.load(fh)
    for key in ('id', 'package'):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            print(value.strip())
            break
except Exception:
    pass
PY
)
  fi

  PLUGIN_ID="${parsed:-$DEFAULT_PLUGIN_ID}"
  INSTALL_DIR="$DEFAULT_INSTALL_ROOT/$PLUGIN_ID"
  HISTORY_PATH="$DEFAULT_HISTORY_PATH"
}

verify_project_files() {
  require_file "$PROJECT_ROOT/Makefile"
  require_file "$PROJECT_ROOT/package.json"
  require_file "$PROJECT_ROOT/manifest.json"
  [[ -d "$PROJECT_ROOT/src" ]] || die "Required directory missing: $PROJECT_ROOT/src"

  local history_script history_service history_timer
  history_script=$(find_first_existing \
    "$PROJECT_ROOT/pi-monitor-history" \
    "$PROJECT_ROOT/tools/pi-monitor-history" \
    "$PROJECT_ROOT/scripts/pi-monitor-history" \
    "$PROJECT_ROOT/packaging/pi-monitor-history" \
    "$PROJECT_ROOT/systemd/pi-monitor-history") || true
  history_service=$(find_first_existing \
    "$PROJECT_ROOT/pi-monitor-history.service" \
    "$PROJECT_ROOT/systemd/pi-monitor-history.service" \
    "$PROJECT_ROOT/packaging/pi-monitor-history.service") || true
  history_timer=$(find_first_existing \
    "$PROJECT_ROOT/pi-monitor-history.timer" \
    "$PROJECT_ROOT/systemd/pi-monitor-history.timer" \
    "$PROJECT_ROOT/packaging/pi-monitor-history.timer") || true

  HISTORY_SCRIPT_SRC="$history_script"
  HISTORY_SERVICE_SRC="$history_service"
  HISTORY_TIMER_SRC="$history_timer"
}

check_cockpit_presence() {
  command -v cockpit-bridge >/dev/null 2>&1 || die "cockpit-bridge is required but not installed or not in PATH."
  if ! cockpit-bridge --packages >/dev/null 2>&1; then
    die "cockpit-bridge is installed but not functioning correctly."
  fi
  add_summary_unique SUMMARY_ALREADY_OK "Cockpit bridge available"
}

check_nvme_presence() {
  if lsblk -dn -o NAME,TYPE 2>/dev/null | awk '$2 == "disk" && $1 ~ /^nvme/ {found=1} END {exit found ? 0 : 1}'; then
    NVME_PRESENT=1
    add_summary_unique SUMMARY_ALREADY_OK "NVMe detected"
  else
    NVME_PRESENT=0
    add_summary_unique SUMMARY_ALREADY_OK "No NVMe detected"
  fi
}

validate_vcgencmd_contexts() {
  local root_ok=0 user_ok=0 vcio_ls=""
  command -v vcgencmd >/dev/null 2>&1 || {
    warn "vcgencmd is not available. Voltage and clock telemetry will not work."
    add_summary_unique SUMMARY_ACTIONS "Install or restore vcgencmd support before expecting voltage/clock telemetry."
    return 0
  }

  if vcgencmd measure_volts core >/dev/null 2>&1 && vcgencmd measure_clock arm >/dev/null 2>&1; then
    root_ok=1
    add_summary_unique SUMMARY_ALREADY_OK "vcgencmd works as root"
  else
    warn "vcgencmd failed as root. Voltage and clock telemetry are not currently usable."
  fi

  if [[ -e /dev/vcio ]]; then
    vcio_ls=$(ls -l /dev/vcio 2>/dev/null || true)
    add_summary_unique SUMMARY_ALREADY_OK "/dev/vcio present"
  else
    warn "/dev/vcio is missing. Voltage and clock telemetry may fail even if vcgencmd exists."
  fi

  if [[ -n "$REAL_USER" ]] && id "$REAL_USER" >/dev/null 2>&1; then
    if sudo -u "$REAL_USER" vcgencmd measure_volts core >/dev/null 2>&1 && sudo -u "$REAL_USER" vcgencmd measure_clock arm >/dev/null 2>&1; then
      user_ok=1
      add_summary_unique SUMMARY_ALREADY_OK "vcgencmd works for user $REAL_USER"
    else
      warn "vcgencmd does not work for user $REAL_USER. Cockpit may show blank or failed voltage/clock data for that login."
      add_summary_unique SUMMARY_ACTIONS "Check whether user $REAL_USER needs access to /dev/vcio or membership in the video group, then reboot or re-login if changed."
    fi

    if id -nG "$REAL_USER" 2>/dev/null | tr ' ' '\n' | grep -qx 'video'; then
      add_summary_unique SUMMARY_ALREADY_OK "User $REAL_USER is in group video"
    else
      warn "User $REAL_USER is not in group video. That may prevent non-root vcgencmd access on some systems."
      add_summary_unique SUMMARY_ACTIONS "If needed: usermod -aG video $REAL_USER, then reboot or fully log out and back in."
    fi
  else
    warn "Could not determine a non-root install user from SUDO_USER/logname, so non-root vcgencmd validation was skipped."
  fi

  if [[ "$root_ok" -eq 0 || "$user_ok" -eq 0 ]]; then
    [[ -n "$vcio_ls" ]] && warn "/dev/vcio details: $vcio_ls"
  fi
}

build_and_install_plugin() {
  run_checked "Building plugin" make
  run_checked "Installing plugin" make install

  [[ -d "$INSTALL_DIR" ]] || die "Expected install directory not found after make install: $INSTALL_DIR"
  [[ -f "$INSTALL_DIR/manifest.json" ]] || die "Installed plugin is missing manifest.json at $INSTALL_DIR"

  add_summary_unique SUMMARY_INSTALLED "Plugin deployed to $INSTALL_DIR"
}

install_history_components() {
  if [[ -z "${HISTORY_SCRIPT_SRC:-}" || -z "${HISTORY_SERVICE_SRC:-}" || -z "${HISTORY_TIMER_SRC:-}" ]]; then
    warn "History script or unit files were not found in the project tree. History collection was not installed."
    add_summary_unique SUMMARY_ACTIONS "Verify pi-monitor-history, pi-monitor-history.service, and pi-monitor-history.timer exist in the project before relying on history data."
    return 0
  fi

  install -d -m 0755 /usr/local/bin /etc/systemd/system /var/lib/pi-monitor
  install -m 0755 "$HISTORY_SCRIPT_SRC" /usr/local/bin/pi-monitor-history
  install -m 0644 "$HISTORY_SERVICE_SRC" /etc/systemd/system/pi-monitor-history.service
  install -m 0644 "$HISTORY_TIMER_SRC" /etc/systemd/system/pi-monitor-history.timer

  systemctl daemon-reload
  systemctl enable --now pi-monitor-history.timer
  systemctl start pi-monitor-history.service || true
  HISTORY_COMPONENTS_INSTALLED=1

  add_summary_unique SUMMARY_INSTALLED "History script installed to /usr/local/bin/pi-monitor-history"
  add_summary_unique SUMMARY_INSTALLED "History timer enabled: pi-monitor-history.timer"
}

post_install_validation() {
  if cockpit-bridge --packages 2>/dev/null | grep -q "^[[:space:]]*$PLUGIN_ID[[:space:]]"; then
    add_summary_unique SUMMARY_ALREADY_OK "Cockpit package registration verified for $PLUGIN_ID"
  elif cockpit-bridge --packages 2>/dev/null | grep -q "$PLUGIN_ID"; then
    add_summary_unique SUMMARY_ALREADY_OK "Cockpit package registration verified for $PLUGIN_ID"
  else
    warn "cockpit-bridge did not list $PLUGIN_ID in package registration output."
    add_summary_unique SUMMARY_ACTIONS "Refresh the browser and re-check cockpit-bridge --packages. If still missing, inspect the install path and manifest."
  fi

  if [[ "$HISTORY_COMPONENTS_INSTALLED" -eq 1 ]]; then
    if systemctl is-enabled pi-monitor-history.timer >/dev/null 2>&1; then
      add_summary_unique SUMMARY_ALREADY_OK "pi-monitor-history.timer enabled"
    else
      warn "pi-monitor-history.timer is not enabled."
    fi

    if systemctl is-active pi-monitor-history.timer >/dev/null 2>&1; then
      add_summary_unique SUMMARY_ALREADY_OK "pi-monitor-history.timer active"
    else
      warn "pi-monitor-history.timer is not active."
    fi
  fi

  if [[ "$HISTORY_COMPONENTS_INSTALLED" -eq 1 ]] && [[ -e "$HISTORY_PATH" ]]; then
    add_summary_unique SUMMARY_ALREADY_OK "History file present: $HISTORY_PATH"
  elif [[ "$HISTORY_COMPONENTS_INSTALLED" -eq 1 ]]; then
    warn "History file was not found yet at $HISTORY_PATH. A sample may not have been written yet."
    add_summary_unique SUMMARY_ACTIONS "Run: systemctl status pi-monitor-history.service pi-monitor-history.timer and inspect journalctl if history does not appear."
  fi

  if command -v vcgencmd >/dev/null 2>&1; then
    if vcgencmd measure_volts core >/dev/null 2>&1 && vcgencmd measure_clock arm >/dev/null 2>&1; then
      add_summary_unique SUMMARY_ALREADY_OK "Root vcgencmd telemetry check passed after install"
    else
      warn "Post-install root vcgencmd telemetry check failed. Voltage and clock data may remain unavailable."
    fi

    if [[ -n "$REAL_USER" ]] && id "$REAL_USER" >/dev/null 2>&1; then
      if sudo -u "$REAL_USER" vcgencmd measure_volts core >/dev/null 2>&1 && sudo -u "$REAL_USER" vcgencmd measure_clock arm >/dev/null 2>&1; then
        add_summary_unique SUMMARY_ALREADY_OK "User vcgencmd telemetry check passed after install for $REAL_USER"
      else
        warn "Post-install non-root vcgencmd telemetry check failed for $REAL_USER. Voltage and clock cards may still be blank in Cockpit."
      fi
    fi
  fi
}

print_summary() {
  local exit_code="${1:-0}"
  printf '%s\n' '========== Pi 5 Hardware Monitor installer summary =========='

  if ((${#SUMMARY_ALREADY_OK[@]})); then
    printf '\nAlready OK:\n'
    printf '  - %s\n' "${SUMMARY_ALREADY_OK[@]}"
  fi

  if ((${#SUMMARY_INSTALLED[@]})); then
    printf '\nInstalled:\n'
    printf '  - %s\n' "${SUMMARY_INSTALLED[@]}"
  fi

  if ((${#SUMMARY_UPDATED[@]})); then
    printf '\nUpdated:\n'
    printf '  - %s\n' "${SUMMARY_UPDATED[@]}"
  fi

  if ((${#SUMMARY_SKIPPED[@]})); then
    printf '\nSkipped:\n'
    printf '  - %s\n' "${SUMMARY_SKIPPED[@]}"
  fi

  if ((${#SUMMARY_WARNINGS[@]})); then
    printf '\nWarnings:\n'
    printf '  - %s\n' "${SUMMARY_WARNINGS[@]}"
  fi

  if ((${#SUMMARY_ACTIONS[@]})); then
    printf '\nManual follow-up:\n'
    printf '  - %s\n' "${SUMMARY_ACTIONS[@]}"
  fi

  if [[ "$exit_code" -eq 0 ]]; then
    printf '\nResult: install completed. Review any warnings above.\n'
  else
    printf '\nResult: install failed. Review the error and summary above.\n'
  fi
}

main() {
  require_root
  ensure_project_root
  resolve_plugin_id
  verify_project_files
  check_pi5_hardware
  check_cockpit_presence

  ensure_required_package "make" "GNU make" "make" "make --version"
  ensure_required_package "nodejs" "Node.js" "node" "node --version"
  ensure_required_package "npm" "npm" "npm" "npm --version"
  ensure_required_package "python3" "Python 3" "python3" "python3 --version"
  ensure_required_package "systemd" "systemd" "systemctl" "systemctl --version"
  ensure_required_package "cockpit-bridge" "Cockpit bridge" "cockpit-bridge" "cockpit-bridge --packages >/dev/null"

  check_nvme_presence
  validate_vcgencmd_contexts

  if [[ "$NVME_PRESENT" -eq 1 ]]; then
    ensure_optional_package "smartmontools" "NVMe storage was detected, so smartmontools is recommended for fuller SMART and health data." "Y"
  else
    add_summary_unique SUMMARY_SKIPPED "smartmontools prompt skipped because no NVMe device was detected"
  fi

  build_and_install_plugin
  install_history_components
  post_install_validation
  print_summary 0
}

trap 'die "Installer aborted unexpectedly at line $LINENO."' ERR
main "$@"
