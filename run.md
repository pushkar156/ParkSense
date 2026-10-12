# 🚀 Running ParkSense — Beginner-Friendly Quick Start Guide

This guide contains complete, step-by-step instructions to run **ParkSense** locally from scratch. It is designed so that anyone—including evaluators, teammates, or new developers—can get the system running in under 2 minutes.

---

## 📋 System Requirements

Ensure you have the following installed on your machine:
- **Python**: Version `3.11` or higher ([python.org](https://www.python.org/downloads/))
- **Node.js**: Version `18.x` or `22.x` ([nodejs.org](https://nodejs.org/))
- **Git**: ([git-scm.com](https://git-scm.com/))
- *(Optional for Hardware Mode)*: Arduino Uno R3, HC-SR04 ultrasonic distance sensor, Red & Green LEDs, 220Ω resistors, and [Arduino IDE](https://www.arduino.cc/en/software).

---

## ⚡ Option 1: Simulation Mode (No Hardware Needed)

You can run and test all features—live sensor waveforms, radar bay graphics, automatic vehicle transitions, analytics, and event logging—entirely in software!

### Step 1: Start the Backend (Terminal 1)

Open **Windows PowerShell** in the project root folder:

```powershell
# 1. Navigate to the backend directory
cd backend

# 2. Create Python virtual environment
python -m venv .venv

# 3. Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# 4. Install backend dependencies
pip install -r requirements.txt

# 5. Start the Flask backend server
python app.py
```

> **Linux / macOS Equivalent:**
> ```bash
> cd backend
> python3 -m venv .venv
> source .venv/bin/activate
> pip install -r requirements.txt
> python app.py
> ```

✅ The backend will start on **`http://127.0.0.1:5000`**. Keep this terminal open.

---

### Step 2: Start the Frontend Dashboard (Terminal 2)

Open a **second PowerShell terminal** in the project root folder:

```powershell
# 1. Install frontend dependencies
npm install --legacy-peer-deps

# 2. Start the Vite development server
npm run dev
```

✅ The dashboard will start on **`http://localhost:3000`**.

---

### Step 3: Open and Test the Dashboard

1. Open your browser and navigate to: **`http://localhost:3000`**
2. In the top bar, confirm the mode switch is set to **"Simulation"**.
3. **Try these features:**
   - **Simulate In / Simulate Out**: Click the quick simulation buttons in the header to simulate a vehicle parking or departing.
   - **Live Monitoring (`/monitoring`)**: Adjust the distance slider manually or toggle operating mode between `AUTO` and `MANUAL`.
   - **Analytics (`/analytics`)**: View real-time bay occupancy rate, average parking duration, and export telemetry data as CSV.
   - **Event History (`/events`)**: Audit all vehicle arrivals, departures, mode changes, and threshold calibrations.

---

## 🔌 Option 2: Physical Hardware Mode (Arduino Uno + HC-SR04)

Follow these steps when you are ready to connect physical hardware.

### Circuit Wiring

Connect the components to your Arduino Uno as follows:

| Component | Arduino Pin | Notes |
| :--- | :--- | :--- |
| **HC-SR04 VCC** | `5V` | Connect to 5V power pin |
| **HC-SR04 GND** | `GND` | Common ground |
| **HC-SR04 TRIG** | `Digital Pin 9` | Trigger pulse |
| **HC-SR04 ECHO** | `Digital Pin 10` | Echo pulse |
| **Red LED (Anode +)** | `Digital Pin 4` | Through **220Ω resistor** (Occupied indicator) |
| **Green LED (Anode +)** | `Digital Pin 5` | Through **220Ω resistor** (Available indicator) |
| **Both LED Cathodes (-)** | `GND` | Connected to ground rail |

---

### Step 1: Upload the Firmware

1. Connect your Arduino Uno to your PC using the USB cable.
2. Open the [Arduino IDE](https://www.arduino.cc/en/software).
3. Open [`firmware/parksense_firmware.ino`](firmware/parksense_firmware.ino).
4. Go to **Tools → Board → Arduino Uno**.
5. Go to **Tools → Port** and select your Arduino's COM port (e.g., `COM3`, `COM4`).
6. Click **Upload** (`Ctrl + U`).
7. ⚠️ **CRITICAL**: Close the Arduino IDE Serial Monitor window before proceeding! Windows allows only one application to access a COM port at a time.

---

### Step 2: Configure the Serial Port & Start Backend

1. In `backend/.env` (or using defaults), specify your Arduino COM port:
   ```ini
   ARDUINO_PORT=COM3
   ARDUINO_BAUD=9600
   ```
2. In **Terminal 1**, run the backend:
   ```powershell
   cd backend
   .\.venv\Scripts\Activate.ps1
   python app.py
   ```
3. In **Terminal 2**, run the frontend:
   ```powershell
   npm run dev
   ```
4. Open **`http://localhost:3000`** and toggle the header switch to **"Hardware"**.
5. The connection indicator will turn green with **"Serial Live"**, streaming physical sensor data in real time!

---

## 🧪 Running Automated Tests

To verify backend integrity, database queries, validation rules, and simulation logic:

```powershell
# From project root
backend\.venv\Scripts\pytest backend\tests\ -v
```

To run frontend typecheck and production build:

```powershell
npm run lint
npm run build
```

---

## 🛠️ Common Troubleshooting

### 1. PowerShell: "Running scripts is disabled on this system"
If `.\.venv\Scripts\Activate.ps1` produces an execution policy error, run this one-time command in PowerShell:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```
Then try activating the virtual environment again.

---

### 2. "Access is denied" / Serial Port Busy Error
- Ensure the **Arduino Serial Monitor** inside the Arduino IDE is closed.
- Ensure no other terminal application (PuTTY, TeraTerm) is connected to the same COM port.

---

### 3. Dashboard shows "Hardware Offline"
- Make sure `python app.py` is actively running in Terminal 1.
- Go to **Device & Settings** (`/settings`) in the dashboard and click **"Test Connection"** to verify communication with the Flask gateway.
- You can switch back to **Simulation** mode at any time using the header toggle.

---

### 4. Dependency conflicts during `npm install`
Always use `--legacy-peer-deps` to ensure Vite and React 19 plugins resolve smoothly:
```powershell
npm install --legacy-peer-deps
```
