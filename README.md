# Pi 5 Hardware Monitor

Cockpit plugin for monitoring Raspberry Pi 5 hardware, power, clocks, storage, and system status.

---

Pi 5 Hardware Monitor is a third-party plugin for Cockpit that provides real-time monitoring of hardware, power, clocks, storage, and system status on a Raspberry Pi 5.

It runs inside the Cockpit web interface and is not tied to any specific distribution.

---

## Important

- This plugin is not limited to AllStarLink 3 (ASL 3)
- It will run on any Linux system running Cockpit on a Raspberry Pi 5
- ASL 3 is simply one environment where Cockpit is commonly used

---

## What This Plugin Does

Displays real-time Raspberry Pi 5 hardware data:

- CPU, NVMe, and I/O temperatures
- Power and throttling status
- Clock speeds

Detects and shows available storage:

- NVMe
- microSD
- USB

Additional monitoring includes:

- Cooling system data (fan RPM / PWM when available)
- System status and summary information
- Optional history logging via a background service

All data is read-only monitoring and adapts automatically based on detected hardware.

---

## Requirements

This plugin is designed only for Raspberry Pi 5 systems running Cockpit.

### Required (installer enforced)

- Raspberry Pi 5 hardware
- Cockpit (`cockpit-bridge`)
- `systemd`
- `make`
- `nodejs` and `npm`
- `python3`
- `vcgencmd` (Raspberry Pi firmware tool)
- `git`

#### Installer behavior

- The installer verifies all required components before continuing
- Missing required packages are installed automatically using `apt` when available
- All required commands are re-checked before the build process starts
- If a required component cannot be installed or is unavailable, the installer stops with a clear error message

---

### Optional (recommended)

- `smartmontools` (`smartctl`)

Provides full NVMe SMART health data, including:

- Drive health / percentage used
- Temperature
- Power-on hours
- Error counts

#### Optional package behavior

- If `smartmontools` is already installed, it is used automatically
- If missing, the installer prompts to install it (interactive terminals only)
- In non-interactive environments, optional packages are skipped and installation continues

---

## Install

### Recommended

Install `git` first, then clone the repository and run the installer:

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/ke2hni/cockpit-pi5-hardware-monitor.git
cd cockpit-pi5-hardware-monitor
sudo ./install.sh
```

---

## What to Expect During Install

- Required dependencies are checked and installed automatically if missing
- Optional packages may prompt for installation (interactive terminals only)
- The Cockpit plugin is built and installed
- The history service and timer are installed and started
- One initial history sample is created automatically

**Notes:**

- Cockpit is not restarted automatically — refresh your browser if needed

---

## Installed Locations

- Cockpit plugin:
  `/usr/local/share/cockpit/pi-monitor`

- History collector script:
  `/usr/local/bin/pi-monitor-history`

- Service:
  `/etc/systemd/system/pi-monitor-history.service`

- Timer:
  `/etc/systemd/system/pi-monitor-history.timer`

- Runtime history data:
  `/var/lib/pi-monitor/history.ndjson`

---

## Upgrade Instruction

If the install folder still exists, just follow these instructions to upgrade to newest version

```bash
cd ~/cockpit-pi5-hardware-monitor
git pull
sudo ./install.sh
```

## Remove / Uninstall

```bash
sudo systemctl disable --now pi-monitor-history.timer
sudo rm -rf /usr/local/share/cockpit/pi-monitor
sudo rm -f /usr/local/bin/pi-monitor-history
sudo rm -f /etc/systemd/system/pi-monitor-history.service
sudo rm -f /etc/systemd/system/pi-monitor-history.timer
sudo systemctl daemon-reload
```

### Optional cleanup

```bash
sudo rm -rf /var/lib/pi-monitor
```

---

## Notes

- This plugin is Raspberry Pi 5–specific and will not install on other hardware
- Some sections (NVMe, USB storage, fan data) only appear when that hardware is present
- History data is stored locally and is not included in the repository
- Re-running the installer is safe and will update existing files

---

## License

LGPL-2.1-or-later

---

## Screenshots


<img width="1600" height="900" alt="Screenshot 2026-04-09 213701" src="https://github.com/user-attachments/assets/069aa46e-e94c-4259-ac21-f5585030d4ef" />
<img width="1600" height="900" alt="Screenshot 2026-04-09 213720" src="https://github.com/user-attachments/assets/b05785af-968e-44dc-965b-f3a3a6328aae" />
<img width="1600" height="900" alt="Screenshot 2026-04-09 213729" src="https://github.com/user-attachments/assets/97135124-f9f0-42bc-ba12-fe835c56fd12" />
<img width="1600" height="900" alt="Screenshot 2026-04-09 213736" src="https://github.com/user-attachments/assets/cc1f8715-bb2e-45f8-aef5-8398085f050e" />
<img width="1600" height="900" alt="Screenshot 2026-04-09 213752" src="https://github.com/user-attachments/assets/dc0110ea-e1e7-4889-bfea-939436d46e71" />
