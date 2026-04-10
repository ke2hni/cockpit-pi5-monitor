# Pi 5 Monitor

Pi 5 Monitor is a Cockpit-compatible third-party plugin for Raspberry Pi 5 systems.

It adds a **Pi 5 Monitor** entry to the Cockpit menu and provides a simple, readable page for Raspberry Pi 5 hardware, power, storage, clock, and history information.

## What It Does

Pi 5 Monitor shows live and recent Raspberry Pi 5 information in Cockpit, including:

- CPU temperature
- I/O temperature
- Power chip temperature
- Fan RPM and fan power level
- Power and throttling status
- CPU frequency, memory, uptime, kernel, and load averages
- Boot and root device information
- SD card information
- PCIe / NVMe link information
- Power supply and voltage information
- ARM, core, and eMMC clock information
- History / Trends data collected locally on the node

### Conditional Sections

Some sections only appear when the related hardware is present:

- **NVMe Drive** only appears when an NVMe device is detected
- **External USB Storage** only appears when a USB storage device is attached

## Show/Hide Sections

Pi 5 Monitor includes a **Show/Hide Sections** control near the top of the page.

This lets you:

- hide sections you do not want to see
- keep the sections you use most visible
- simplify the page layout for your own workflow

Your section visibility choices are saved in the browser for that browser profile.

## Quick Install

### Option 1 — Clone from GitHub

```bash
git clone https://github.com/ke2hni/cockpit-pi5-monitor.git
cd cockpit-pi5-monitor
sudo ./install.sh
```

### Option 2 — Download ZIP from GitHub

1. Open the GitHub repository page
2. Click **Code**
3. Click **Download ZIP**
4. Extract the ZIP
5. Open a terminal in the extracted `cockpit-pi5-monitor` folder
6. Run:

```bash
sudo ./install.sh
```

## What the Installer Does

The installer:

- installs the Cockpit plugin
- installs the local history collector script
- installs the systemd service and timer
- enables the timer
- starts the history collector once so History / Trends has data immediately after install

The installer does **not** restart Cockpit automatically.

## After Install

After install:

- refresh the Cockpit browser tab or sign back in if needed
- open **Pi 5 Monitor** from the Cockpit menu
- verify **History / Trends** is showing data

## Installed Files and Locations

The installer places these files on the system:

- Cockpit plugin:
  `/usr/local/share/cockpit/pi-monitor`
- History collector script:
  `/usr/local/bin/pi-monitor-history`
- systemd service:
  `/etc/systemd/system/pi-monitor-history.service`
- systemd timer:
  `/etc/systemd/system/pi-monitor-history.timer`

## Runtime Data Created

Pi 5 Monitor creates local history data here:

```bash
/var/lib/pi-monitor/history.ndjson
```

This file stores collected History / Trends data on the local system.

## How to Remove Pi 5 Monitor

To remove Pi 5 Monitor from the system:

```bash
sudo systemctl disable --now pi-monitor-history.timer
sudo rm -f /etc/systemd/system/pi-monitor-history.service
sudo rm -f /etc/systemd/system/pi-monitor-history.timer
sudo systemctl daemon-reload
sudo rm -f /usr/local/bin/pi-monitor-history
sudo rm -rf /usr/local/share/cockpit/pi-monitor
sudo rm -f /usr/local/share/metainfo/org.cockpit_project.pi_monitor.metainfo.xml
```

After removal, refresh Cockpit or sign in again if needed.

### Optional: Remove Stored History Data Too

If you also want to delete the saved local history data:

```bash
sudo rm -rf /var/lib/pi-monitor
```

This removes the stored History / Trends data permanently.

## Notes

- Pi 5 Monitor is intended for **Raspberry Pi 5** systems.
- It is not intended to be a generic hardware plugin for all Linux systems.
- For full NVMe health details, `smartctl` from `smartmontools` is recommended.
- `nvme-cli` is also recommended for NVMe-related support and troubleshooting.

## License<img width="1600" height="900" alt="Screenshot 2026-04-09 213701" src="https://github.com/user-attachments/assets/b79e44dd-1337-413a-b9c2-03710438bbdc" />
<img width="1600" height="900" alt="Screenshot 2026-04-09 213720" src="https://github.com/user-attachments/assets/56ac18e1-1bf0-4b99-ac53-10ca320bdfe4" />
<img width="1600" height="900" alt="Screenshot 2026-04-09 213729" src="https://github.com/user-attachments/assets/f1ad253e-d3fc-4853-9eb3-2d5b68034f9b" />
<img width="1600" height="900" alt="Screenshot 2026-04-09 213736" src="https://github.com/user-attachments/assets/55e74dd7-2253-4838-b081-098a026dcf4f" />
<img width="1600" height="900" alt="Screenshot 2026-04-09 213752" src="https://github.com/user-attachments/assets/163b2f41-9a24-45a5-b874-1f71f6b0ca4b" />


This project is licensed under the GNU Lesser General Public License v2.1 or later.

See the `LICENSE` file for details.

