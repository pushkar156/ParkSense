# ParkSense — Smart Parking IoT Monitoring & Analytics Platform

**ParkSense** is an IoT smart parking platform designed for real-time occupancy detection, live ultrasonic telemetry, actuator control, and historical analytics. Connected to an **Arduino Uno R3** equipped with an **HC-SR04 ultrasonic distance sensor** and status LEDs, ParkSense bridges physical hardware to a web dashboard.

---

## 1. Architecture Overview

```
+-------------------+        USB Serial (9600 8-N-1)        +----------------------+
|   Arduino Uno     | <==================================> |  Python Flask Server |
|  + HC-SR04 Sonar  |   Newline JSON:                      |  (Local REST API)    |
|  + Red/Green LEDs |   {"distance_cm":12.4,...}           |  SQLite: parksense.db|
+-------------------+                                      +----------------------+
                                                                      ^
                                            HTTP Fetch / JSON        |
                                            (http://127.0.0.1:5000)  v
                                                           +----------------------+
                                                           |   ParkSense Web UI   |
                                                           |   (React 19 + Vite)  |
                                                           |   Simulation / Live  |
                                                           +----------------------+
```

### Modes
1. **Simulation Mode**: Uses an autonomous in-browser physics engine that simulates vehicle arrival, bay parking, sensor noise, departure, and state changes. Ideal for demos, grading, and testing without physical hardware.
2. **Hardware Mode**: Connects through the local Python Flask backend (`http://127.0.0.1:5000/api`) to the physical Arduino USB serial port (`COM3` or `/dev/ttyACM0`). The UI clearly displays when the hardware or backend is offline.

---

## 2. Project File Structure

```
├── .env.example                     # Environment variables template
├── index.html                       # HTML5 entry with Plus Jakarta Sans & JetBrains Mono
├── metadata.json                    # Project description and metadata
├── package.json                     # NPM dependencies (React, Recharts, Lucide, Tailwind)
├── README.md                        # Documentation & setup instructions
├── src/
│   ├── App.tsx                      # Top-level routing and providers
│   ├── main.tsx                     # React DOM root mounting
│   ├── index.css                    # Tailwind CSS imports and typography
│   ├── types/
│   │   └── index.ts                 # TypeScript types (SensorReading, Event, Status, etc.)
│   ├── services/
│   │   ├── api.ts                   # REST API client for Flask backend
│   │   └── simulator.ts             # Ultrasonic physics and event simulator
│   ├── context/
│   │   └── ParkingContext.tsx       # Global state, polling cycle, and hardware controls
│   ├── components/
│   │   ├── common/
│   │   │   ├── StatusBadge.tsx      # Semantic accessible status badges
│   │   │   └── FeedbackBanner.tsx   # Command toast feedback banner
│   │   └── layout/
│   │       ├── Sidebar.tsx          # Collapsible persistent sidebar
│   │       ├── TopBar.tsx           # Contextual breadcrumbs, mode toggle & quick actions
│   │       └── AppLayout.tsx        # Shell container layout
│   └── pages/
│       ├── OverviewPage.tsx         # Real-time metrics, bay radar visualizer, 24h timeline
│       ├── LiveMonitoringPage.tsx   # Fast waveform stream, threshold slider, LED commands
│       ├── AnalyticsPage.tsx        # Aggregated statistics, hourly histogram, CSV export
│       ├── EventHistoryPage.tsx     # Filterable and searchable event audit table
│       ├── DeviceSettingsPage.tsx   # Baud rate, sensor calibration, backend health ping
│       └── BackendGuidePage.tsx     # Complete Python Flask and Arduino source code
```

---

## 3. Installation & Run Commands

### Frontend Dashboard
```bash
# Install dependencies
npm install

# Start Vite dev server on port 3000
npm run dev

# Production build
npm run build
```

### Python Flask Hardware Backend (Optional for Hardware Mode)
```bash
# 1. Install Python packages
pip install flask flask-cors pyserial

# 2. Upload the Arduino sketch:
# Open src/pages/BackendGuidePage.tsx (or copy the code from the guide tab)
# and flash ParkSense.ino via Arduino IDE to your Uno.

# 3. Start the Flask serial gateway
python app.py
```

---

## 4. Environment Variables

Create `.env` in the root:
```env
# Optional API override (defaults to http://127.0.0.1:5000/api)
VITE_API_URL="http://127.0.0.1:5000/api"
```

---

## 5. Serial Protocol Specification

- **Baud Rate**: `9600`, 8 data bits, no parity, 1 stop bit (`8-N-1`).
- **Telemetry Format**: Newline-delimited JSON string transmitted every 1000 ms:
  ```json
  {"distance_cm":12.4,"occupied":true,"mode":"AUTO","threshold_cm":15.0}
  ```
- **Supported ASCII Commands**:
  - `MODE:AUTO`: Switch to autonomous threshold-driven LED control.
  - `MODE:MANUAL`: Switch to manual command mode.
  - `LED:RED:ON` / `LED:RED:OFF`: Actuate Red LED (MANUAL mode only).
  - `LED:GREEN:ON` / `LED:GREEN:OFF`: Actuate Green LED (MANUAL mode only).
  - `THRESHOLD:<cm>`: Update occupancy trigger distance (e.g. `THRESHOLD:15.0`).
  - `RESET`: Restore factory settings (Threshold: 15 cm, Mode: AUTO).
