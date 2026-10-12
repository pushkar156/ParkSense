# 🚗 ParkSense — Smart Parking IoT Monitoring & Analytics Platform

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%208-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Language-TypeScript%20%7C%20Python%203.11-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript Python" />
  <img src="https://img.shields.io/badge/Backend-Flask%203.1-000000?style=for-the-badge&logo=flask&logoColor=white" alt="Flask" />
  <img src="https://img.shields.io/badge/Database-SQLite%20(WAL)-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Hardware-Arduino%20Uno%20R3-00979D?style=for-the-badge&logo=arduino&logoColor=white" alt="Arduino Uno" />
  <img src="https://img.shields.io/badge/Sensor-HC--SR04%20Ultrasonic-FFA500?style=for-the-badge" alt="HC-SR04" />
</p>

---

## 📌 Overview

**ParkSense** is an end-to-end IoT smart parking monitoring system designed for real-time bay occupancy detection, live ultrasonic telemetry streaming, actuator override, and historical analytics. 

Connected to an **Arduino Uno R3** equipped with an **HC-SR04 ultrasonic distance sensor** and dual LED indicators, ParkSense bridges physical microcontrollers with an interactive web dashboard powered by **React 19** and a **Python Flask** gateway with **SQLite persistence**.

> 📖 **Looking for step-by-step instructions to run this project?**  
> Check out the [**Beginner-Friendly Quick Start Guide (`run.md`)**](run.md).

---

## ✨ Key Features

- **⚡ Live Ultrasonic Telemetry**: Near real-time measurement updates (1 Hz) streaming distance, bay occupancy, and sensor health.
- **🎯 Intelligent State Debouncing**: Confirmed state transitions emit historical `ARRIVAL` and `DEPARTURE` events without repetitive noise.
- **🔄 Dual Operation Modes**:
  - **Simulation Mode**: Full offline physics simulation generating realistic vehicle approach, parking, and departure cycles with SQLite database persistence.
  - **Hardware Mode**: Direct USB serial integration with the Arduino Uno microcontroller (`9600` baud).
- **💡 Dual Operating Control**:
  - `AUTO` Mode: Arduino autonomously toggles Green/Red LEDs based on the distance threshold.
  - `MANUAL` Mode: Web dashboard user can independently toggle physical or virtual LEDs.
- **📊 Comprehensive Analytics**: Bay occupancy rate, total arrivals/departures, average parking duration, 24-hour histogram, and CSV export.
- **🔍 Event Audit Log**: Filterable, paginated audit records for vehicle transitions, mode switches, and threshold calibrations.
- **🛡️ Data Quality & Fault Tolerance**: Sensor timeouts (-1.0 cm) are safely handled as invalid measurements and excluded from analytics denominators without crashing the gateway.

---

## 🏛️ System Architecture

```
  ┌────────────────────────────────────────────────────────┐
  │                 Physical IoT Circuit                   │
  │  Arduino Uno R3 + HC-SR04 Ultrasonic Sonar             │
  │  Red LED (Pin 4)  |  Green LED (Pin 5)                 │
  └──────────────────────────┬─────────────────────────────┘
                             │  USB Serial (9600 8-N-1)
                             │  Newline JSON Protocol
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │               Python Flask API Gateway                 │
  │  • PySerial Manager (Thread-Safe & Auto-Reconnect)     │
  │  • Parking Service (Debounce & State Coordinator)      │
  │  • Simulation Service (Realistic Vehicle Physics)      │
  │  • Analytics Engine (Statistical Aggregation)          │
  │  • SQLite Database (WAL Mode Concurrency)              │
  └──────────────────────────┬─────────────────────────────┘
                             │  REST API / JSON
                             │  http://127.0.0.1:5000/api
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │              ParkSense Web Application                 │
  │  React 19 + TypeScript + Vite + Recharts + Tailwind    │
  │  Live Telemetry • Radar Visualizer • Trends • Settings │
  └────────────────────────────────────────────────────────┘
```

---

## 🔌 Hardware Circuit & Pinout

| Component | Arduino Pin | Description |
| :--- | :--- | :--- |
| **HC-SR04 VCC** | `5V` | 5V Power rail |
| **HC-SR04 GND** | `GND` | Common ground rail |
| **HC-SR04 TRIG** | `Digital Pin 9` | 10µs ultrasonic trigger pulse |
| **HC-SR04 ECHO** | `Digital Pin 10` | High pulse duration measured in microseconds |
| **Red LED (Anode +)** | `Digital Pin 4` | Occupied state indicator (via **220Ω resistor**) |
| **Green LED (Anode +)** | `Digital Pin 5` | Available state indicator (via **220Ω resistor**) |
| **Both Cathodes (-)** | `GND` | Common ground rail |

> The complete Arduino sketch is located at [`firmware/parksense_firmware.ino`](firmware/parksense_firmware.ino).

---

## 📡 Arduino Serial Protocol

### 1. Telemetry Packet (Arduino → Backend)
Broadcast at 1-second intervals as newline-delimited JSON:
```json
{"distance_cm":12.4,"occupied":true,"mode":"AUTO","threshold_cm":15.0}
```
*(A distance of `-1.0` signifies an echo timeout or out-of-range condition)*

### 2. Supported Serial Commands (Backend → Arduino)
| Command | Mode | Description |
| :--- | :--- | :--- |
| `MODE:AUTO` | Any | Enables automatic sensor-driven LED control |
| `MODE:MANUAL` | Any | Enables manual actuator control via web dashboard |
| `LED:RED:ON` / `OFF` | `MANUAL` | Sets Red LED state |
| `LED:GREEN:ON` / `OFF` | `MANUAL` | Sets Green LED state |
| `THRESHOLD:<value>` | Any | Updates detection threshold (`5.0` to `100.0` cm) |
| `RESET` | Any | Restores defaults: Mode = `AUTO`, Threshold = `15.0` cm |

---

## 🌐 REST API Endpoints

All endpoints are hosted under `http://127.0.0.1:5000/api`:

| Method | Endpoint | Query / Body | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | — | Server status, database health, hardware connectivity |
| `GET` | `/status` | `?mode=hardware\|simulation` | Current sensor telemetry, LEDs, mode, threshold |
| `GET` | `/readings/latest` | `?mode=hardware\|simulation` | Latest valid reading object |
| `GET` | `/readings` | `?from=&to=&limit=&mode=` | Chronological sensor readings for charting |
| `GET` | `/analytics` | `?from=&to=&mode=` | Occupancy %, arrival/departure counts, durations |
| `GET` | `/events` | `?type=&from=&to=&page=&limit=` | Filterable and paginated event audit log |
| `POST` | `/events/clear` | `?mode=hardware\|simulation` | Purge recorded historical events |
| `GET` | `/settings` | — | Read persisted system configuration |
| `PATCH` | `/settings` | `{"threshold_cm": 20.0, "mode": "AUTO"}` | Update detection threshold or operating mode |
| `POST` | `/commands/mode` | `{"mode": "AUTO"\|"MANUAL"}` | Switch system operating mode |
| `POST` | `/commands/led` | `{"color": "RED", "state": "ON"}` | Control indicator LEDs in MANUAL mode |
| `POST` | `/commands/reset` | — | Restore factory defaults |
| `GET` | `/ports` | — | Enumerate available host COM/TTY ports |

---

## ⚡ Quick Start

```powershell
# 1. Start Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py

# 2. Start Frontend (in a new terminal)
npm install --legacy-peer-deps
npm run dev
```

👉 **For complete details, hardware upload steps, and troubleshooting, read [`run.md`](run.md).**

---

## 🧪 Testing & Validation

Run the automated backend test suite:
```powershell
backend\.venv\Scripts\pytest backend/tests/ -v
```

Run frontend linting and production build:
```powershell
npm run lint
npm run build
```

---

## 📂 Project Structure

```
ParkSense/
├── backend/                       # Python Flask API Gateway
│   ├── app.py                     # Flask application factory
│   ├── config.py                  # Environment-driven configuration
│   ├── database.py                # SQLite schema creation & WAL connections
│   ├── models.py                  # Domain dataclasses & serializers
│   ├── requirements.txt           # Python dependencies
│   ├── routes/                    # Blueprint route handlers
│   ├── services/                  # Business logic, PySerial & Simulation engines
│   └── tests/                     # 21 unit & integration pytest tests
├── firmware/
│   └── parksense_firmware.ino     # Arduino Uno R3 C++ firmware
├── src/                           # React 19 Frontend Dashboard
│   ├── components/                # UI Layout, status badges, banners
│   ├── context/                   # Global state, polling cycle & controls
│   ├── pages/                     # Overview, Live Monitoring, Analytics, Events, Settings
│   ├── services/                  # API client and local simulation fallback
│   └── types/                     # Shared TypeScript schemas
├── run.md                         # Detailed, beginner-friendly execution guide
└── README.md                      # Project documentation
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE). Developed as a smart IoT parking monitoring prototype.
