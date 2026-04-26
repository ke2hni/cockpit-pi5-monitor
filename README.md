# Pi 5 Hardware Monitor

Cockpit plugin for monitoring Raspberry Pi 5 hardware, power, clocks, storage, and system status.

---

## 🚀 Install

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/ke2hni/cockpit-pi5-hardware-monitor.git
cd cockpit-pi5-hardware-monitor
sudo ./install.sh
```

---

## 🔄 Upgrade

```bash
cd ~/cockpit-pi5-hardware-monitor
git pull
sudo ./install.sh
```

---

## 🗑️ Uninstall

```bash
sudo systemctl disable --now pi-monitor-history.timer
sudo systemctl disable --now pi-monitor-history.service 2>/dev/null || true
sudo rm -rf /usr/local/share/cockpit/pi-monitor
sudo rm -f /usr/local/bin/pi-monitor-history
sudo rm -f /etc/systemd/system/pi-monitor-history.service
sudo rm -f /etc/systemd/system/pi-monitor-history.timer
sudo systemctl daemon-reload
```

Optional cleanup:

```bash
sudo rm -rf /var/lib/pi-monitor
```

---

## ⚙️ Features

- CPU, NVMe, and I/O temperatures  
- Power and throttling status  
- Clock speeds  
- Storage detection (NVMe / SD / USB)  
- Fan RPM / PWM (when available)  
- System summary and status  
- Optional history logging  

---

## 🖥️ Requirements

- Raspberry Pi 5  
- Cockpit (`cockpit-bridge`)  
- systemd  
- nodejs / npm  
- python3  
- make  
- vcgencmd  
- git  

---

## 📦 Installed Locations

- /usr/local/share/cockpit/pi-monitor  
- /usr/local/bin/pi-monitor-history  
- /etc/systemd/system/pi-monitor-history.service  
- /etc/systemd/system/pi-monitor-history.timer  
- /var/lib/pi-monitor/history.ndjson  

---

## 📝 Notes

- Raspberry Pi 5 only  
- No Cockpit restart required  
- Hardware sections appear only when detected  
- Safe to re-run installer  

---

## 📊 Status

- Stable  
- Live data working  
- NVMe detection working  
- History working  
- UI fully functional  

---

## 📸 Screenshots

(keep your existing images here)
