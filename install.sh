#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_NAME=$(basename "$0")
SCRIPT_PATH=$(readlink -f -- "${BASH_SOURCE[0]}")
PROJECT_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
DEFAULT_PLUGIN_ID="pi-monitor"
DEFAULT_INSTALL_ROOT="/usr/local/share/cockpit"
DEFAULT_HISTORY_DIR="/var/lib/pi-monitor"
DEFAULT_HISTORY_PATH="$DEFAULT_HISTORY_DIR/history.ndjson"
APT_UPDATED=0
INTERACTIVE=0
HISTORY_COMPONENTS_INSTALLED=0
INSTALL_DEGRADED=0
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

declare -a CONFLICT_PATHS=()

CURRENT_FAILURE_CLASS=""
CURRENT_FAILURE_DETAIL=""

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

warn() {
  printf '[%s] WARNING: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
  SUMMARY_WARNINGS+=("$*")
  INSTALL_DEGRADED=1
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

report_issue_footer() {
  printf '%s\n' "Please post this error on the GitHub page for the plugin in case other users have a similar issue."
  printf '%s\n' "Include the full installer output and the exact command you ran."
}

print_failure_guidance() {
  local class="$1"
  case "$class" in
    root_required)
      cat <<'TXT'
Simple reason:
The installer was not run with root privileges.

What this usually means:
This is a local system usage issue, not a plugin bug.

What to do next:
Run the installer with sudo or as root.
TXT
      ;;
    repo_layout)
      cat <<'TXT'
Simple reason:
The installer was not run from a complete Pi 5 Hardware Monitor project folder.

What this usually means:
This is usually caused by an incomplete download, copying only install.sh, or running from the wrong directory on your system, not by the plugin itself.

What to do next:
Clone or extract the full repository, cd into that folder, and run the installer again.
TXT
      ;;
    unsupported_hardware)
      cat <<'TXT'
Simple reason:
This installer only supports Raspberry Pi 5 hardware.

What this usually means:
The system is unsupported for this plugin installer. This is not a plugin code failure.

What to do next:
Run this installer only on a Raspberry Pi 5.
TXT
      ;;
    apt_problem)
      cat <<'TXT'
Simple reason:
APT could not refresh package metadata or install required packages.

What this usually means:
This is usually caused by the local system package manager, repository configuration, or network access, not by the plugin itself.

What to do next:
Fix apt-get update / apt-get install on the system first, then rerun the installer.
TXT
      ;;
    dependency_problem)
      cat <<'TXT'
Simple reason:
A required dependency is missing or not working correctly on this system.

What this usually means:
This is usually a local system dependency problem, not a plugin UI bug.

What to do next:
Verify the named command works manually on the system, then rerun the installer.
TXT
      ;;
    cockpit_problem)
      cat <<'TXT'
Simple reason:
Cockpit is missing, broken, or not responding correctly.

What this usually means:
This is caused by the local Cockpit installation or environment, not by the plugin files alone.

What to do next:
Verify cockpit-bridge is installed and working before rerunning the installer.
TXT
      ;;
    build_problem)
      cat <<'TXT'
Simple reason:
The plugin build did not complete successfully.

What this usually means:
This can be caused by the local build toolchain or by a plugin build issue.

What to do next:
Review the build output above, then post it on GitHub so it can be compared with other reports.
TXT
      ;;
    install_problem)
      cat <<'TXT'
Simple reason:
The plugin did not install cleanly into the expected Cockpit path.

What this usually means:
This can be caused by conflicting plugin copies, filesystem layout issues, or the install/build process.

What to do next:
Review the install path checks in the output, remove stale copies if needed, and report the full output on GitHub.
TXT
      ;;
    history_problem)
      cat <<'TXT'
Simple reason:
The history collector did not start correctly or did not write a valid sample.

What this usually means:
The plugin may be installed, but history collection is not functioning correctly on this system.

What to do next:
Check the pi-monitor-history service and timer output shown above, then report the result on GitHub.
TXT
      ;;
    vcgencmd_problem)
      cat <<'TXT'
Simple reason:
Pi voltage/clock telemetry is not working correctly on this system.

What this usually means:
This is usually caused by local Pi firmware access, vcgencmd availability, or user permissions, not by the plugin UI itself.

What to do next:
Verify vcgencmd works both as root and as the Cockpit login user, then rerun the installer.
TXT
      ;;
    *)
      cat <<'TXT'
Simple reason:
The installer hit an unexpected failure.

What this usually means:
This could be caused by the local system, the install environment, or the plugin installer logic.

What to do next:
Review the output above and post the full error on GitHub.
TXT
      ;;
  esac
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
    if [[ "$INSTALL_DEGRADED" -eq 1 ]]; then
      printf '\nResult: install completed with warnings. Review the items above.\n'
    else
      printf '\nResult: install completed and passed installer validation.\n'
    fi
  else
    printf '\nResult: install failed. Review the error, explanation, and summary above.\n'
  fi
}

fail_with_help() {
  local class="$1"
  local detail="$2"
  CURRENT_FAILURE_CLASS="$class"
  CURRENT_FAILURE_DETAIL="$detail"
  printf '[%s] ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$detail" >&2
  printf '\n'
  print_failure_guidance "$class"
  printf '\n'
  report_issue_footer
  printf '\n'
  print_summary 1
  exit 1
}

die() {
  fail_with_help "unexpected_problem" "$1"
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
  local failure_class="$2"
  shift 2
  log "$description"
  if ! "$@"; then
    fail_with_help "$failure_class" "$description failed."
  fi
}

require_root() {
  [[ "$EUID" -eq 0 ]] || fail_with_help "root_required" "Run this installer as root, usually with sudo."
}

ensure_project_root() {
  cd "$PROJECT_ROOT"
}

require_file() {
  local path="$1"
  [[ -e "$path" ]] || fail_with_help "repo_layout" "Required file missing: $path"
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
    fail_with_help "apt_problem" "apt-get update failed. Cannot safely compare or install packages."
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

  command -v "$command_name" >/dev/null 2>&1 || fail_with_help "dependency_problem" "Command not found after package validation: $command_name"
  if ! bash -lc "$test_cmd" >/dev/null 2>&1; then
    fail_with_help "dependency_problem" "Command validation failed for $command_name"
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
    if ! install_package "$pkg"; then
      fail_with_help "apt_problem" "Failed to install required package: $pkg"
    fi
    add_summary_unique SUMMARY_INSTALLED "$pkg (required)"
  else
    installed_version=$(package_installed_version "$pkg")
    candidate_version=$(package_candidate_version "$pkg")
    if package_needs_upgrade "$pkg"; then
      if ask_yes_no "Required package $pkg is outdated ($installed_version -> $candidate_version). Update it now? [Y/n]" "Y"; then
        log "Updating required package: $pkg"
        if ! upgrade_package "$pkg"; then
          fail_with_help "apt_problem" "Failed to update required package: $pkg"
        fi
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
      if ! install_package "$pkg"; then
        warn "Optional package $pkg failed to install."
        add_summary_unique SUMMARY_ACTIONS "Install optional package $pkg manually later if you want that feature."
        return 0
      fi
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
        if ! upgrade_package "$pkg"; then
          warn "Optional package $pkg failed to update."
          add_summary_unique SUMMARY_ACTIONS "Update optional package $pkg manually later if you want the newest version."
          return 0
        fi
        add_summary_unique SUMMARY_UPDATED "$pkg: $installed_version -> $candidate_version"
      else
        add_summary_unique SUMMARY_SKIPPED "$pkg update skipped ($installed_version < $candidate_version)"
      fi
    else
      add_summary_unique SUMMARY_ALREADY_OK "$pkg ($installed_version)"
    fi
  fi
}

print_startup_context() {
  log "Installer path: $SCRIPT_PATH"
  log "Project root: $PROJECT_ROOT"
  log "Current working directory: $(pwd)"
  log "Interactive mode: $INTERACTIVE"
  if [[ -n "$REAL_USER" ]]; then
    log "Detected non-root user for validation: $REAL_USER"
  else
    log "Detected non-root user for validation: none"
  fi
}

check_pi5_hardware() {
  local model=""
  model=$(tr -d '\0' </proc/device-tree/model 2>/dev/null || true)
  [[ -n "$model" ]] || model=$(grep -m1 '^Model' /proc/cpuinfo 2>/dev/null | cut -d: -f2- | xargs || true)

  [[ "$model" == *"Raspberry Pi 5"* ]] || fail_with_help "unsupported_hardware" "This installer only supports Raspberry Pi 5 hardware. Detected: ${model:-unknown}"
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
  HISTORY_DIR="$DEFAULT_HISTORY_DIR"
  HISTORY_PATH="$DEFAULT_HISTORY_PATH"
  add_summary_unique SUMMARY_ALREADY_OK "Plugin ID resolved as $PLUGIN_ID"
  add_summary_unique SUMMARY_ALREADY_OK "Target install directory: $INSTALL_DIR"
}

verify_project_files() {
  require_file "$PROJECT_ROOT/Makefile"
  require_file "$PROJECT_ROOT/package.json"
  require_file "$PROJECT_ROOT/manifest.json"
  [[ -d "$PROJECT_ROOT/src" ]] || fail_with_help "repo_layout" "Required directory missing: $PROJECT_ROOT/src"

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
  command -v cockpit-bridge >/dev/null 2>&1 || fail_with_help "cockpit_problem" "cockpit-bridge is required but not installed or not in PATH."
  if ! cockpit-bridge --packages >/dev/null 2>&1; then
    fail_with_help "cockpit_problem" "cockpit-bridge is installed but not functioning correctly."
  fi
  add_summary_unique SUMMARY_ALREADY_OK "Cockpit bridge available"
}

check_conflicting_plugin_copies() {
  local candidate
  local -a possible=(
    "/usr/local/share/cockpit/$PLUGIN_ID"
    "/usr/share/cockpit/$PLUGIN_ID"
    "/root/.local/share/cockpit/$PLUGIN_ID"
  )

  if [[ -n "$REAL_USER" && -d "/home/$REAL_USER/.local/share/cockpit/$PLUGIN_ID" ]]; then
    possible+=("/home/$REAL_USER/.local/share/cockpit/$PLUGIN_ID")
  fi

  for candidate in "${possible[@]}"; do
    [[ -d "$candidate" ]] && CONFLICT_PATHS+=("$candidate")
  done

  if ((${#CONFLICT_PATHS[@]} > 1)); then
    warn "Multiple plugin copies were found for $PLUGIN_ID: ${CONFLICT_PATHS[*]}"
    add_summary_unique SUMMARY_ACTIONS "Remove stale or override copies if Cockpit appears to load the wrong plugin version."
  elif ((${#CONFLICT_PATHS[@]} == 1)); then
    add_summary_unique SUMMARY_ALREADY_OK "Existing plugin copy detected at ${CONFLICT_PATHS[0]}"
  else
    add_summary_unique SUMMARY_ALREADY_OK "No pre-existing plugin copies detected"
  fi
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
  local root_ok=0 user_ok=0 vcio_ls="" root_volts="" root_clock="" user_volts="" user_clock=""
  command -v vcgencmd >/dev/null 2>&1 || {
    warn "vcgencmd is not available. Voltage and clock telemetry will not work."
    add_summary_unique SUMMARY_ACTIONS "Install or restore vcgencmd support before expecting voltage/clock telemetry."
    return 0
  }

  add_summary_unique SUMMARY_ALREADY_OK "vcgencmd path: $(readlink -f -- "$(command -v vcgencmd)")"

  if root_volts=$(vcgencmd measure_volts core 2>/dev/null) && root_clock=$(vcgencmd measure_clock arm 2>/dev/null); then
    root_ok=1
    add_summary_unique SUMMARY_ALREADY_OK "vcgencmd works as root ($root_volts, $root_clock)"
  else
    warn "vcgencmd failed as root. Voltage and clock telemetry are not currently usable."
  fi

  if [[ -e /dev/vcio ]]; then
    vcio_ls=$(ls -l /dev/vcio 2>/dev/null || true)
    add_summary_unique SUMMARY_ALREADY_OK "/dev/vcio present ($vcio_ls)"
  else
    warn "/dev/vcio is missing. Voltage and clock telemetry may fail even if vcgencmd exists."
  fi

  if [[ -n "$REAL_USER" ]] && id "$REAL_USER" >/dev/null 2>&1; then
    if user_volts=$(sudo -u "$REAL_USER" vcgencmd measure_volts core 2>/dev/null) && user_clock=$(sudo -u "$REAL_USER" vcgencmd measure_clock arm 2>/dev/null); then
      user_ok=1
      add_summary_unique SUMMARY_ALREADY_OK "vcgencmd works for user $REAL_USER ($user_volts, $user_clock)"
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

  if [[ "$root_ok" -eq 0 ]]; then
    warn "Root vcgencmd telemetry validation failed. This is a system-side telemetry issue, not a plugin UI failure."
  fi

  if [[ "$root_ok" -eq 0 || ( -n "$REAL_USER" && "$user_ok" -eq 0 ) ]]; then
    [[ -n "$vcio_ls" ]] && warn "/dev/vcio details: $vcio_ls"
  fi
}

build_and_install_plugin() {
  run_checked "Building plugin" "build_problem" make
  run_checked "Installing plugin" "install_problem" make install

  [[ -d "$INSTALL_DIR" ]] || fail_with_help "install_problem" "Expected install directory not found after make install: $INSTALL_DIR"
  [[ -f "$INSTALL_DIR/manifest.json" ]] || fail_with_help "install_problem" "Installed plugin is missing manifest.json at $INSTALL_DIR"
  [[ -f "$PROJECT_ROOT/manifest.json" ]] || fail_with_help "repo_layout" "Source manifest missing at $PROJECT_ROOT/manifest.json"

  local src_sum dst_sum
  src_sum=$(sha256sum "$PROJECT_ROOT/manifest.json" | awk '{print $1}')
  dst_sum=$(sha256sum "$INSTALL_DIR/manifest.json" | awk '{print $1}')
  add_summary_unique SUMMARY_ALREADY_OK "Source manifest checksum: $src_sum"
  add_summary_unique SUMMARY_ALREADY_OK "Installed manifest checksum: $dst_sum"
  if [[ "$src_sum" != "$dst_sum" ]]; then
    warn "Installed manifest checksum differs from the source manifest checksum."
    add_summary_unique SUMMARY_ACTIONS "Inspect the installed Cockpit package files if behavior does not match the source tree you expected."
  fi

  add_summary_unique SUMMARY_INSTALLED "Plugin deployed to $INSTALL_DIR"
}

install_history_components() {
  if [[ -z "${HISTORY_SCRIPT_SRC:-}" || -z "${HISTORY_SERVICE_SRC:-}" || -z "${HISTORY_TIMER_SRC:-}" ]]; then
    warn "History script or unit files were not found in the project tree. History collection was not installed."
    add_summary_unique SUMMARY_ACTIONS "Verify pi-monitor-history, pi-monitor-history.service, and pi-monitor-history.timer exist in the project before relying on history data."
    return 0
  fi

  install -d -m 0755 /usr/local/bin /etc/systemd/system "$HISTORY_DIR"
  install -m 0755 "$HISTORY_SCRIPT_SRC" /usr/local/bin/pi-monitor-history
  install -m 0644 "$HISTORY_SERVICE_SRC" /etc/systemd/system/pi-monitor-history.service
  install -m 0644 "$HISTORY_TIMER_SRC" /etc/systemd/system/pi-monitor-history.timer

  systemctl daemon-reload
  if ! systemctl enable --now pi-monitor-history.timer; then
    fail_with_help "history_problem" "Failed to enable/start pi-monitor-history.timer"
  fi
  if ! systemctl start pi-monitor-history.service; then
    fail_with_help "history_problem" "Failed to start pi-monitor-history.service"
  fi
  HISTORY_COMPONENTS_INSTALLED=1

  add_summary_unique SUMMARY_INSTALLED "History script installed to /usr/local/bin/pi-monitor-history"
  add_summary_unique SUMMARY_INSTALLED "History timer enabled: pi-monitor-history.timer"
}

validate_history_sample() {
  local size=0 last_line=""

  if [[ ! -x /usr/local/bin/pi-monitor-history ]]; then
    fail_with_help "history_problem" "History script is missing or not executable at /usr/local/bin/pi-monitor-history"
  fi

  if ! /usr/local/bin/pi-monitor-history; then
    fail_with_help "history_problem" "History script failed when run manually after install"
  fi

  if [[ ! -e "$HISTORY_PATH" ]]; then
    fail_with_help "history_problem" "History file was not created at $HISTORY_PATH"
  fi

  size=$(wc -c < "$HISTORY_PATH" 2>/dev/null || echo 0)
  if [[ "$size" -le 0 ]]; then
    fail_with_help "history_problem" "History file exists but is empty: $HISTORY_PATH"
  fi

  last_line=$(tail -n 1 "$HISTORY_PATH" 2>/dev/null || true)
  if [[ -z "$last_line" ]]; then
    fail_with_help "history_problem" "History file exists but no sample line could be read from: $HISTORY_PATH"
  fi

  if ! python3 - <<'PY' "$HISTORY_PATH" >/dev/null 2>&1
import json, sys
path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as fh:
    lines = [line.strip() for line in fh if line.strip()]
if not lines:
    raise SystemExit(1)
json.loads(lines[-1])
PY
  then
    fail_with_help "history_problem" "History file does not contain a valid JSON sample: $HISTORY_PATH"
  fi

  add_summary_unique SUMMARY_ALREADY_OK "History file present and non-empty: $HISTORY_PATH ($size bytes)"
}

post_install_validation() {
  local packages_output package_line=""
  packages_output=$(cockpit-bridge --packages 2>/dev/null || true)
  if [[ -n "$packages_output" ]] && grep -q "$PLUGIN_ID" <<<"$packages_output"; then
    package_line=$(grep "$PLUGIN_ID" <<<"$packages_output" | head -n 1 || true)
    add_summary_unique SUMMARY_ALREADY_OK "Cockpit package registration verified for $PLUGIN_ID"
    [[ -n "$package_line" ]] && add_summary_unique SUMMARY_ALREADY_OK "Cockpit package line: $package_line"
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

    validate_history_sample
  fi

  if command -v vcgencmd >/dev/null 2>&1; then
    local post_root_volts="" post_root_clock=""
    if post_root_volts=$(vcgencmd measure_volts core 2>/dev/null) && post_root_clock=$(vcgencmd measure_clock arm 2>/dev/null); then
      add_summary_unique SUMMARY_ALREADY_OK "Root vcgencmd telemetry check passed after install ($post_root_volts, $post_root_clock)"
    else
      warn "Post-install root vcgencmd telemetry check failed. Voltage and clock data may remain unavailable."
      add_summary_unique SUMMARY_ACTIONS "This appears to be caused by Pi telemetry access on the system, not by the plugin UI itself."
    fi

    if [[ -n "$REAL_USER" ]] && id "$REAL_USER" >/dev/null 2>&1; then
      local post_user_volts="" post_user_clock=""
      if post_user_volts=$(sudo -u "$REAL_USER" vcgencmd measure_volts core 2>/dev/null) && post_user_clock=$(sudo -u "$REAL_USER" vcgencmd measure_clock arm 2>/dev/null); then
        add_summary_unique SUMMARY_ALREADY_OK "User vcgencmd telemetry check passed after install for $REAL_USER ($post_user_volts, $post_user_clock)"
      else
        warn "Post-install non-root vcgencmd telemetry check failed for $REAL_USER. Voltage and clock cards may still be blank in Cockpit."
        add_summary_unique SUMMARY_ACTIONS "This appears to be caused by user access or session state on the system, not by the plugin installer itself."
      fi
    fi
  fi
}

main() {
  require_root
  ensure_project_root
  print_startup_context
  resolve_plugin_id
  verify_project_files
  check_pi5_hardware
  check_cockpit_presence
  check_conflicting_plugin_copies

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

trap 'fail_with_help "unexpected_problem" "Installer aborted unexpectedly at line $LINENO."' ERR
main "$@"
