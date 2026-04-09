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

require_file() {
    local path="$1"
    if [[ ! -f "$path" ]]; then
        echo "Error: required file not found: $path" >&2
        exit 1
    fi
}

require_cmd() {
    local cmd="$1"
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Error: required command not found: $cmd" >&2
        exit 1
    fi
}

if [[ $EUID -ne 0 ]]; then
    echo "Please run this installer with sudo or as root." >&2
    exit 1
fi

if [[ ! -f "$PROJECT_ROOT/package.json" || ! -f "$PROJECT_ROOT/Makefile" ]]; then
    echo "Error: run this script from the Pi Monitor project root." >&2
    exit 1
fi

require_cmd make
require_cmd systemctl
require_cmd cockpit-bridge
require_file "$HISTORY_SCRIPT_SRC"
require_file "$SERVICE_SRC"
require_file "$TIMER_SRC"

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
  - The installer does NOT restart Cockpit automatically. Rebooting the Node is suggested though.
  - Refresh your Cockpit browser tab or sign back in if needed.
  - A first history snapshot is created during install so History / Trends is not blank on a fresh install.
  - /var/lib/pi-monitor/history.ndjson is runtime data and should not be shipped with personal node history.
  - Existing history data is preserved if it is already present.

MSG
