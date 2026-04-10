# Pi 5 Monitor

Cockpit plugin for monitoring Raspberry Pi 5 hardware, power, clocks, storage, and system status.

---

## Requirements

This plugin is designed **only for Raspberry Pi 5 systems** running Cockpit.

The installer will automatically check for required components and stop if they are missing.

### Required (installer will enforce)

* Raspberry Pi 5 hardware
* Cockpit (`cockpit-bridge`)
* `systemd`
* `make`
* `nodejs` and `npm`
* `python3`
* `vcgencmd` (Raspberry Pi firmware tool)

### Optional (recommended)

* `smartmontools` (`smartctl`)
  Provides full NVMe SMART health data:

  * drive health / percentage used
  * temperature
  * power-on hours
  * error counts

If optional packages are missing, the installer will explain what they are used for and ask before installing them.

---

## Install (from GitHub)

```bash
git clone https://github.com/ke2hni/cockpit-pi5-monitor.git
cd cockpit-pi5-monitor
sudo ./install.sh
```

Notes:

* The installer will check all required dependencies before continuing
* You may be prompted to install optional packages
* Cockpit is not restarted automatically — refresh your browser if needed

---

## Installed Locations

* Cockpit plugin:
  `/usr/local/share/cockpit/pi-monitor`

* History collector script:
  `/usr/local/bin/pi-monitor-history`

* Service:
  `/etc/systemd/system/pi-monitor-history.service`

* Timer:
  `/etc/systemd/system/pi-monitor-history.timer`

* Runtime history data:
  `/var/lib/pi-monitor/history.ndjson`

---

## Remove / Uninstall

```bash
sudo systemctl disable --now pi-monitor-history.timer
sudo rm -rf /usr/local/share/cockpit/pi-monitor
sudo rm -f /usr/local/bin/pi-monitor-history
sudo rm -f /etc/systemd/system/pi-monitor-history.service
sudo rm -f /etc/systemd/system/pi-monitor-history.timer
sudo systemctl daemon-reload
```

Optional:

```bash
sudo rm -rf /var/lib/pi-monitor
```

---

## Notes

* This plugin is **Pi 5-specific** and will not install on other hardware
* Some sections (NVMe, USB storage, fan data) only appear when that hardware is present
* History data is local to the system and is not included in the repository
* Re-running the installer is safe and will update existing files

---

## License

LGPL-2.1-or-later
