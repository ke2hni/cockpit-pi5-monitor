# Pi 5 Hardware Monitor

![Platform](https://img.shields.io/badge/Platform-Raspberry%20Pi%205-blue)
![AllStarLink](https://img.shields.io/badge/AllStarLink%203-Compatible-purple)
![Cockpit](https://img.shields.io/badge/Cockpit-Plugin-green)
![Status](https://img.shields.io/badge/Status-Stable-brightgreen)

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

<img width="1600" height="900" alt="Screenshot 2026-04-09 213701" src="https://github.com/user-attachments/assets/069aa46e-e94c-4259-ac21-f5585030d4ef" />
<img width="1600" height="900" alt="Screenshot 2026-04-09 213720" src="https://github.com/user-attachments/assets/b05785af-968e-44dc-965b-f3a3a6328aae" />
<img width="1600" height="900" alt="Screenshot 2026-04-09 213729" src="https://github.com/user-attachments/assets/97135124-f9f0-42bc-ba12-fe835c56fd12" />
<img width="1600" height="900" alt="Screenshot 2026-04-09 213736" src="https://github.com/user-attachments/assets/cc1f8715-bb2e-45f8-aef5-8398085f050e" />
<img width="1600" height="900" alt="Screenshot 2026-04-09 213752" src="https://github.com/user-attachments/assets/dc0110ea-e1e7-4889-bfea-939436d46e71" />

