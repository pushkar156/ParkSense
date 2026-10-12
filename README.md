# ParkSense — Smart Parking IoT Monitoring & Control System

**ParkSense** is an IoT smart parking platform designed for real-time occupancy detection, live ultrasonic telemetry, actuator control, and historical analytics. Connected to an **Arduino Uno R3** equipped with an **HC-SR04 ultrasonic distance sensor** and status LEDs, ParkSense bridges physical hardware to a web dashboard.

---

## 1. System Architecture

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
1. **Simulation Mode**: Uses an autonomous backend physics engine (and client-side fallback) that simulates vehicle arrival, bay parking, sensor noise, departure, and state changes, persisting records with `source = 'simulation'` in SQLite. Ideal for demos, grading, and testing without physical hardware.
2. **Hardware Mode**: Connects through the local Python Flask backend (`http://127.0.0.1:5000/api`) to the physical Arduino USB serial port (`COM3` on Windows, `/dev/ttyUSB0` or `/dev/ttyACM0` on Linux/macOS). The UI clearly displays when the hardware or backend is offline.

---

## 2. Hardware Wiring & Pin Connections

| Component | Arduino Pin | Notes |
| :--- | :--- | :--- |
| **HC-SR04 VCC** | `5V` | Power supply |
| **HC-SR04 GND** | `GND` | Ground |
| **HC-SR04 TRIG** | `Digital Pin 9` | 10µs trigger pulse |
| **HC-SR04 ECHO** | `Digital Pin 10` | Pulse width measurement |
| **Red LED (Anode +)** | `Digital Pin 4` | Connected via **220Ω resistor** (Occupied indicator) |
| **Green LED (Anode +)** | `Digital Pin 5` | Connected via **220Ω resistor** (Available indicator) |
| **LED Cathodes (-)** | `GND` | Both connected to Ground |

> **Note:** The Arduino sketch is located at [`firmware/parksense_firmware.ino`](firmware/parksense_firmware.ino).

---

## 3. Arduino Serial Communication Protocol

- **Baud Rate:** `9600` 8-N-1
- **Interval:** 1 reading per second (1000ms)
- **Telemetry Packet (Arduino -> Python Backend):**
  ```json
  {"distance_cm":23.4,"occupied":false,"mode":"AUTO","threshold_cm":15.0}
  ```
  *(A negative distance such as `-1.0` indicates an echo timeout / invalid measurement)*

- **Supported Commands (Backend -> Arduino):**
  - `MODE:AUTO` — Automatic occupancy sensing & LED control
  - `MODE:MANUAL` — Manual dashboard override of LEDs
  - `LED:RED:ON` / `LED:RED:OFF` — Red LED control (in MANUAL mode)
  - `LED:GREEN:ON` / `LED:GREEN:OFF` — Green LED control (in MANUAL mode)
  - `THRESHOLD:15.0` — Set detection threshold between 5.0 and 100.0 cm
  - `RESET` — Reset threshold to 15.0 cm and return to AUTO mode

---

## 4. Prerequisites

- **Python:** 3.11 or higher installed (`python --version`)
- **Node.js:** v18+ or v22+ with npm (`node --version`, `npm --version`)
- **Hardware (Optional for simulation):** Arduino Uno R3, HC-SR04 sensor, Red & Green LEDs, two 220Ω resistors, breadboard, jumper wires, USB-B cable.
- **Arduino IDE:** To flash the firmware to your Uno board.

---

## 5. Step-by-Step Setup Guide

### A. Backend Setup (Flask + SQLite)

Open **Windows PowerShell** in the project root:

```powershell
# 1. Navigate to backend directory
cd backend

# 2. Create virtual environment
python -m venv .venv

# 3. Activate the virtual environment
.\.venv\Scripts\Activate.ps1
# (On Linux / macOS: source .venv/bin/activate)

# 4. Install backend dependencies
pip install -r requirements.txt

# 5. Run automated tests to verify backend integrity
pytest tests/ -v

# 6. Start the Flask backend server
python app.py
```

The backend server starts on: **`http://127.0.0.1:5000`** with the REST API under `/api`.

### B. Frontend Setup (React + Vite)

Open a **second PowerShell terminal** in the project root:

```powershell
# 1. Install frontend dependencies
npm install --legacy-peer-deps

# 2. Run typecheck & build test
npm run lint
npm run build

# 3. Start development server
npm run dev
```

Open your browser to: **`http://localhost:3000`**.

### C. Arduino Firmware Upload (Hardware Mode)

1. Open the [Arduino IDE](https://www.arduino.cc/en/software).
2. Connect your Arduino Uno to the computer via USB.
3. Open [`firmware/parksense_firmware.ino`](firmware/parksense_firmware.ino).
4. In Arduino IDE, select **Tools -> Board -> Arduino Uno**.
5. Select **Tools -> Port -> COM3** (or the detected COM port on Windows / `/dev/ttyUSB0` on Linux).
6. Click **Upload** (Ctrl+U).
7. **IMPORTANT:** Close the Arduino IDE Serial Monitor! The Python backend needs exclusive ownership of the serial port.

---

## 6. REST API Reference

Base URL: `http://127.0.0.1:5000/api`

| Endpoint | Method | Parameters / Body | Description |
| :--- | :--- | :--- | :--- |
| `/health` | `GET` | — | System health check and device connectivity status |
| `/status` | `GET` | `?mode=hardware\|simulation` | Current device state, LED status, baud, port |
| `/readings/latest` | `GET` | `?mode=hardware\|simulation` | Latest recorded sensor reading |
| `/readings` | `GET` | `?from=&to=&limit=&source=` | Historical sensor readings (chronological) |
| `/analytics` | `GET` | `?from=&to=&source=` | Aggregated metrics, occupancy rate, durations, timeline |
| `/events` | `GET` | `?type=&from=&to=&page=&limit=` | Filterable and paginated event audit log |
| `/events/clear` | `POST` | `?source=hardware\|simulation` | Clear recorded event history |
| `/settings` | `GET` | — | Get persisted threshold, mode, and serial port |
| `/settings` | `PATCH` | `{"threshold_cm": 20.0, "mode": "AUTO"}` | Update detection threshold or operating mode |
| `/commands/mode` | `POST` | `{"mode": "AUTO"\|"MANUAL"}` | Switch operating mode |
| `/commands/led` | `POST` | `{"color": "RED", "state": "ON"}` | Control LEDs in MANUAL mode |
| `/commands/reset` | `POST` | — | Reset device threshold to 15.0 cm and mode to AUTO |
| `/ports` | `GET` | — | Enumerate detected system serial ports |

---

## 7. Automated Test Suite

Run the full pytest suite from the project root:

```powershell
backend/.venv/Scripts/pytest backend/tests/ -v
```

All 21 unit & integration tests verify:
- Health endpoint status
- Disconnected hardware safety (no server crash)
- Parameter validation & bounds checking (5-100 cm)
- Mode & LED command restrictions (rejecting manual LED toggling in AUTO mode)
- Transition event debouncing (only emitting ARRIVAL/DEPARTURE when state confirms a change)
- Invalid sensor measurement policy (timeouts marked invalid and excluded from occupancy rate)
- Event pagination and filtering
- Analytics calculation correctness with zero or many records
- Deterministic simulation mode

---

## 8. Troubleshooting Guide

### 1. `ModuleNotFoundError: No module named 'serial'` or `'flask'`
- Make sure your virtual environment is activated before running:
  ```powershell
  cd backend
  .\.venv\Scripts\Activate.ps1
  pip install -r requirements.txt
  ```

### 2. Serial Port Error / "Access is denied"
- Windows allows only **one application** to open a COM port at a time.
- Make sure the **Arduino IDE Serial Monitor is closed**.
- Make sure no other serial terminal (PuTTY, TeraTerm) is open.
- Verify the correct port in Device Manager (e.g., `COM3`, `COM4`) and configure it in `backend/.env`:
  ```
  ARDUINO_PORT=COM4
  ```

### 3. Frontend Shows "Hardware Offline"
- Ensure `python app.py` is running on port 5000.
- Check that the Arduino is connected to your USB port.
- In the dashboard, switch between **Simulation** and **Hardware** mode using the TopBar switch.
- On the **Device & Settings** page (`/settings`), click **"Test Connection"** to verify communication.

### 4. CORS Errors in Browser Console
- By default, `backend/config.py` permits requests from `localhost:3000`, `127.0.0.1:3000`, `localhost:5173`, and `127.0.0.1:5173`.
- If using another port, add it to `CORS_ORIGINS` in `backend/.env`.

### 5. Ultrasonic Sensor Returns -1.0 or Stale Readings
- Check that HC-SR04 VCC is connected to `5V` (not 3.3V) and GND is connected to `GND`.
- Verify TRIG is on Pin 9 and ECHO is on Pin 10.
- Ensure the object is positioned directly in front of the ultrasonic transducers (between 2 cm and 400 cm).
