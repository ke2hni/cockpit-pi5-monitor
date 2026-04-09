# Pi 5 Monitor

Pi 5 Monitor is a Cockpit-compatible third-party plugin for Raspberry Pi 5 systems.

It provides a clean Cockpit / PatternFly interface for live Raspberry Pi 5 hardware, power, storage, clock, and history data. The project is intentionally focused on Raspberry Pi 5 hardware paths and has been tested in an ASL 3 environment.

## Features

### Thermal / Cooling
- CPU temperature
- NVMe temperature
- I/O temperature
- Power Chip temperature
- Fan RPM
- Fan Power Level
- Color-coded border status for quick temperature visibility

### History / Trends
- Rolling local history from the Pi monitor history collector
- Summary of stored samples
- Temperature ranges for CPU, I/O, NVMe, and Power Chip
- Event totals for undervoltage, throttling, frequency cap, and soft temperature limit
- Last 5 Days view
- Day selection based on the node timezone
- Selected sample view for stored point-in-time readings
- Selected Sample dropdown with its own internal scrollbar
- Automatic dropdown placement with overflow protection
- Selected Sample auto-scroll to the current selection when reopened

### Power / Throttling
- Power health summary
- Current undervoltage
- Undervoltage since boot
- Current throttled status
- Throttled since boot
- Current frequency cap
- Frequency cap since boot
- Current soft temperature limit
- Soft temperature limit since boot

### System Summary
- Pi model
- CPU frequency
- Total RAM
- Memory usage
- Uptime
- Kernel
- Load averages
- Root filesystem used

### Boot / Device Info
- Boot device
- Root device
- NVMe present
- Fan present

### NVMe Drive
- SMART temperature
- Model
- Capacity
- Health
- Firmware
- Percentage of drive life used
- Power-on hours
- Unsafe shutdowns
- Media errors
- Mounted At

### SD Card
- Presence
- Device
- Capacity
- Card used
- Vendor
- Model
- Serial
- Mounted At

### External USB Storage
- Model
- Capacity
- Free space
- Device path
- Mounted At

**Note:** The External USB Storage section only appears when a USB storage device is detected.

### PCIe / NVMe Link
- Current link speed
- Current link width
- Max link speed
- Max link width

### Power Supply
- Input voltage
- Negotiated current limit
- USB current limit mode
- USB over-current at boot

### Voltages
- Core voltage
- SDRAM C
- SDRAM I
- SDRAM P

### Clocks
- ARM clock
- Core clock
- eMMC clock

### Advanced
- Firmware version
- Ring oscillator
- Core rail power

## Show/Hide Sections

The plugin includes a Show/Hide Sections control near the top of the page.

This lets users:
- hide sections they do not want to see
- keep commonly used sections visible
- simplify the page layout for their own workflow

Section visibility choices are saved in the browser's local storage, so the layout remains in place across page reloads and browser refreshes on that same browser profile.

## Current Scope

This plugin is intentionally focused on:
- Raspberry Pi 5
- Cockpit 337
- Cockpit-style third-party plugin structure
- PatternFly / Cockpit-compatible UI patterns
- Simple, readable monitoring without unnecessary extra controls

## Runtime Requirements

For full monitoring support on Raspberry Pi 5, the plugin expects standard Pi and Linux tooling to be available, including:

- `vcgencmd`
- `smartctl` from the `smartmontools` package for NVMe SMART and drive-health data
- `nvme-cli` for NVMe-related support and troubleshooting

If `smartctl` is not installed, the NVMe section can still show some basic device information, but SMART health, SMART temperature, percentage used, power-on hours, unsafe shutdowns, and media error reporting may be missing or incomplete.

## History Collector

Pi 5 Monitor uses a local history collector plus a systemd service and timer.

The collector writes sample data to:

```bash
/var/lib/pi-monitor/history.ndjson
```

This file is runtime data and should not be populated with personal node history in a public GitHub package.

For a true fresh install:
- `/var/lib/pi-monitor/` may not exist yet
- `history.ndjson` may not exist yet
- the install script starts the history collector once so the first sample is created immediately

For upgrades or reinstalls on an existing system:
- existing history data should normally be preserved
- the runtime history file should continue to be used if it already exists

## Build from Source

From the project directory:

```bash
npm install
npm run stylelint
npm run eslint
make
make codecheck
```

## Install

The published package name is:

```bash
pi-monitor
```

The `v2` name was only used during development reference and should not be used as the final installed package name.

From the project root, install with:

```bash
sudo ./install.sh
```

The installer:
- runs the Cockpit plugin install
- installs the history collector script
- installs the systemd service and timer
- enables the timer
- starts the collector once so history exists immediately after install

After install:
- refresh Cockpit in the browser
- open **Pi 5 Monitor**
- verify the plugin appears in the Cockpit menu

## Cockpit Menu Placement

The plugin is installed as a Cockpit menu entry labeled:

`Pi 5 Monitor`

## GitHub Package Contents

The GitHub package/repository should contain the project source plus the installer files, including:

- `install.sh`
- `tools/pi-monitor-history`
- `packaging/pi-monitor-history.service`
- `packaging/pi-monitor-history.timer`

The GitHub package/repository should **not** include a populated runtime history file from a live node.

## Status

Current status:
- Passes `stylelint`
- Passes `eslint`
- Passes `make codecheck`
- Manual dropdown placement checks passed
- Manual history/timezone checks passed
- Fresh-install simulation passed
- Reboot/install verification passed
- Working Cockpit plugin
- Ready for GitHub packaging

## Notes

- This plugin is designed around Raspberry Pi 5 hardware paths and telemetry.
- It is not intended to be a generic Cockpit hardware plugin for all Linux systems.
- The design goal is to stay close to Cockpit and PatternFly conventions while remaining simple and maintainable.
- The final published install uses a stable package name and stable install path like any other Cockpit-compatible third-party plugin.

## License

This project is licensed under the GNU Lesser General Public License v2.1 or later.

See the `LICENSE` file for details.
