#!/usr/bin/env bash
set -euo pipefail

# Pi 5 Monitor installer
# Installs the Cockpit plugin plus the history collector script, service, and timer.
# Intended to be run from the project root.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="/usr/local/share/cockpit/pi-monitor"
HISTORY_SCRIPT_SRC="$PROJECT_ROOT/tools/pi-monitor-history"
SERVICE_SRC="$PROJECT_ROOT/packaging/pi-monitor-history.service"
TIMER_SRC="$PROJECT_ROOT/packaging/pi-monitor-history.timer"
HISTORY_SCRIPT_DST="/usr/local/bin/pi-monitor-history"
SERVICE_DST="/etc/systemd/system/pi-monitor-history.service"
TIMER_DST="/etc/systemd/system/pi-monitor-history.timer"

APT_UPDATED=0

say() {
    printf '%s\n' "$*"
}

fail() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

require_file() {
    local path="$1"
    [[ -f "$path" ]] || fail "required file not found: $path"
}

require_cmd() {
    local cmd="$1"
    command -v "$cmd" >/dev/null 2>&1 || fail "required command not found: $cmd"
}

prompt_yes_no() {
    local prompt="$1"
    local reply

    if [[ ! -t 0 ]]; then
        return 1
    fi

    while true; do
        read -r -p "$prompt [y/N]: " reply
        case "$reply" in
            [Yy]|[Yy][Ee][Ss]) return 0 ;;
            [Nn]|[Nn][Oo]|"") return 1 ;;
            *) say "Please answer y or n." ;;
        esac
    done
}

apt_install_package() {
    local package_name="$1"
    local feature_text="$2"

    if command -v apt-get >/dev/null 2>&1; then
        say ""
        say "Missing package: $package_name"
        say "Purpose: $feature_text"

        if prompt_yes_no "Install $package_name now?"; then
            if [[ $APT_UPDATED -eq 0 ]]; then
                say "Running apt update..."
                apt-get update
                APT_UPDATED=1
            fi

            say "Installing $package_name..."
            apt-get install -y "$package_name"
            return 0
        fi

        fail "$package_name is required for Pi 5 Monitor. Install it, then re-run this installer."
    fi

    fail "$package_name is required for Pi 5 Monitor. Install it, then re-run this installer."
}

maybe_install_optional_package() {
    local command_name="$1"
    local package_name="$2"
    local feature_text="$3"

    if command -v "$command_name" >/dev/null 2>&1; then
        return 0
    fi

    say ""
    say "Optional package not found: $package_name"
    say "Feature: $feature_text"

    if command -v apt-get >/dev/null 2>&1 && prompt_yes_no "Install optional package $package_name now?"; then
        if [[ $APT_UPDATED -eq 0 ]]; then
            say "Running apt update..."
            apt-get update
            APT_UPDATED=1
        fi

        say "Installing $package_name..."
        apt-get install -y "$package_name"
    else
        say "Skipping optional package $package_name."
    fi
}

ensure_required_command() {
    local command_name="$1"
    local package_name="$2"
    local feature_text="$3"

    if command -v "$command_name" >/dev/null 2>&1; then
        return 0
    fi

    apt_install_package "$package_name" "$feature_text"
    command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is still missing after installing $package_name"
}

is_raspberry_pi_5() {
    local model=""

    if [[ -r /proc/device-tree/model ]]; then
        model="$(tr -d '\0' </proc/device-tree/model 2>/dev/null || true)"
    elif [[ -r /sys/firmware/devicetree/base/model ]]; then
        model="$(tr -d '\0' </sys/firmware/devicetree/base/model 2>/dev/null || true)"
    fi

    [[ "$model" == *"Raspberry Pi 5"* ]]
}

if [[ $EUID -ne 0 ]]; then
    fail "Please run this installer with sudo or as root."
fi

if [[ ! -f "$PROJECT_ROOT/package.json" || ! -f "$PROJECT_ROOT/Makefile" ]]; then
    fail "run this script from the Pi 5 Monitor project root."
fi

require_file "$HISTORY_SCRIPT_SRC"
require_file "$SERVICE_SRC"
require_file "$TIMER_SRC"

if ! is_raspberry_pi_5; then
    fail "Pi 5 Monitor only supports Raspberry Pi 5 systems. This installer will not continue on non-Pi-5 hardware."
fi

if ! command -v cockpit-bridge >/dev/null 2>&1; then
    fail "Cockpit is not installed or cockpit-bridge is missing. Pi 5 Monitor is a Cockpit plugin and requires Cockpit first."
fi

ensure_required_command make make "build/install support used by the Cockpit starter-kit Makefile"
ensure_required_command node nodejs "JavaScript runtime required to build the Cockpit plugin during install"
ensure_required_command npm npm "package manager required to download and build the Cockpit plugin dependencies"
ensure_required_command python3 python3 "runtime required by the pi-monitor-history collector script"
ensure_required_command systemctl systemd "service manager required for the pi-monitor-history service and timer"

if ! command -v vcgencmd >/dev/null 2>&1; then
    fail "vcgencmd is missing. Pi 5 Monitor needs Raspberry Pi firmware utilities for temperatures, clocks, voltages, and throttling data. Install the package that provides vcgencmd on this system, then re-run this installer."
fi

maybe_install_optional_package \
    smartctl \
    smartmontools \
    "full NVMe SMART health details, including SMART status, SMART temperature, percentage used, power-on hours, unsafe shutdowns, and media/data integrity errors"

# Install the Cockpit plugin using the starter-kit Makefile flow.
make -C "$PROJECT_ROOT" install

# Install the history collector and unit files from the current repo copies.
install -m 755 "$HISTORY_SCRIPT_SRC" "$HISTORY_SCRIPT_DST"
install -m 644 "$SERVICE_SRC" "$SERVICE_DST"
install -m 644 "$TIMER_SRC" "$TIMER_DST"

# Reload systemd, enable the timer, and force one immediate history sample
# so a fresh install does not look broken while waiting for the first interval.
systemctl daemon-reload
systemctl enable --now pi-monitor-history.timer
systemctl start pi-monitor-history.service

cat <<MSG

Pi 5 Monitor install complete.

Installed paths:
  Cockpit plugin:   $PLUGIN_DIR
  History script:   $HISTORY_SCRIPT_DST
  Service unit:     $SERVICE_DST
  Timer unit:       $TIMER_DST

Next checks:
  cockpit-bridge --packages | grep -A3 -B2 'pi-monitor\\|Pi 5 Monitor'
  systemctl status pi-monitor-history.timer --no-pager
  systemctl status pi-monitor-history.service --no-pager
  ls -ld /var/lib/pi-monitor /var/lib/pi-monitor/history.ndjson

Notes:
  - The installer does NOT restart Cockpit automatically.
  - Refresh your Cockpit browser tab or sign back in if needed.
  - A first history snapshot is created during install so History / Trends is not blank on a fresh install.
  - /var/lib/pi-monitor/history.ndjson is runtime data and should not be shipped with personal node history.
  - Existing history data is preserved if it is already present.
  - smartmontools is optional but recommended for full NVMe SMART health details.

MSG
