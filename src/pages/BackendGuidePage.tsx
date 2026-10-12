import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  Download,
  Terminal,
  Cpu,
  Layers,
  Database,
  ArrowRight,
} from 'lucide-react';

export const BackendGuidePage: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const flaskCode = `# ==============================================================================
# ParkSense — Python Flask Hardware Serial Gateway & SQLite Persistence
# ==============================================================================
import json
import sqlite3
import threading
import time
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import serial
import serial.tools.list_ports

app = Flask(__name__)
# Enable CORS restricted to frontend dev/prod origins
CORS(app, resources={r"/api/*": {"origins": "*"}})

DB_FILE = "parksense.db"
SERIAL_PORT = "COM3"  # Windows: COM3/COM4, Linux/Mac: /dev/ttyACM0 or /dev/ttyUSB0
BAUD_RATE = 9600

# Thread-safe global hardware state cache
hardware_state = {
    "connected": False,
    "port": SERIAL_PORT,
    "baud_rate": BAUD_RATE,
    "distance_cm": 0.0,
    "occupied": False,
    "mode": "AUTO",
    "threshold_cm": 15.0,
    "red_led": False,
    "green_led": True,
    "last_update": None,
    "protocol_version": "v1.2",
    "sensor_health": "healthy"
}
state_lock = threading.Lock()
ser_conn = None

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            distance_cm REAL NOT NULL,
            occupied INTEGER NOT NULL,
            mode TEXT NOT NULL,
            threshold_cm REAL NOT NULL,
            red_led INTEGER NOT NULL,
            green_led INTEGER NOT NULL,
            source TEXT DEFAULT 'hardware'
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            distance_cm REAL NOT NULL,
            previous_state TEXT NOT NULL,
            new_state TEXT NOT NULL,
            mode TEXT NOT NULL,
            source TEXT DEFAULT 'hardware',
            details TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def serial_reader_thread():
    global ser_conn
    while True:
        try:
            if not ser_conn or not ser_conn.is_open:
                print(f"[Serial] Attempting connection on {SERIAL_PORT} @ {BAUD_RATE}...")
                ser_conn = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
                time.sleep(2)  # Wait for Arduino bootloader reset
                with state_lock:
                    hardware_state["connected"] = True
                print(f"[Serial] Connected to Arduino Uno on {SERIAL_PORT}")

            line = ser_conn.readline().decode('utf-8', errors='ignore').strip()
            if not line:
                continue

            # Expecting JSON: {"distance_cm":23.4,"occupied":false,"mode":"AUTO","threshold_cm":15.0}
            if line.startswith("{") and line.endswith("}"):
                data = json.loads(line)
                now_ts = int(time.time() * 1000)

                with state_lock:
                    prev_occ = hardware_state["occupied"]
                    now_occ = bool(data.get("occupied", False))
                    dist = float(data.get("distance_cm", 0.0))
                    mode_val = data.get("mode", "AUTO")
                    thresh = float(data.get("threshold_cm", 15.0))

                    hardware_state["distance_cm"] = dist
                    hardware_state["occupied"] = now_occ
                    hardware_state["mode"] = mode_val
                    hardware_state["threshold_cm"] = thresh
                    hardware_state["red_led"] = now_occ if mode_val == "AUTO" else hardware_state["red_led"]
                    hardware_state["green_led"] = (not now_occ) if mode_val == "AUTO" else hardware_state["green_led"]
                    hardware_state["last_update"] = now_ts
                    hardware_state["sensor_health"] = "healthy"

                # Persist to SQLite
                conn = sqlite3.connect(DB_FILE)
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO readings (timestamp, distance_cm, occupied, mode, threshold_cm, red_led, green_led, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'hardware')
                """, (now_ts, dist, 1 if now_occ else 0, mode_val, thresh, 1 if hardware_state["red_led"] else 0, 1 if hardware_state["green_led"] else 0))

                # Detect state change event
                if prev_occ != now_occ:
                    evt_type = "ARRIVAL" if now_occ else "DEPARTURE"
                    cur.execute("""
                        INSERT INTO events (timestamp, event_type, distance_cm, previous_state, new_state, mode, source, details)
                        VALUES (?, ?, ?, ?, ?, ?, 'hardware', ?)
                    """, (now_ts, evt_type, dist, "OCCUPIED" if prev_occ else "AVAILABLE", "OCCUPIED" if now_occ else "AVAILABLE", mode_val,
                          f"Vehicle entered bay" if now_occ else "Vehicle cleared bay"))

                conn.commit()
                conn.close()

        except Exception as e:
            with state_lock:
                hardware_state["connected"] = False
                hardware_state["sensor_health"] = "offline"
            time.sleep(3)

# ----------------- REST API Endpoints -----------------

@app.route("/api/health", methods=["GET"])
def health():
    with state_lock:
        return jsonify({
            "status": "healthy",
            "hardware_connected": hardware_state["connected"],
            "timestamp": int(time.time() * 1000)
        })

@app.route("/api/status", methods=["GET"])
def get_status():
    with state_lock:
        return jsonify({
            "connected": hardware_state["connected"],
            "mode": "hardware",
            "firmware_mode": hardware_state["mode"],
            "baud_rate": hardware_state["baud_rate"],
            "port": hardware_state["port"],
            "sensor_health": hardware_state["sensor_health"],
            "backend_reachable": True,
            "last_reading_time": hardware_state["last_update"],
            "red_led": hardware_state["red_led"],
            "green_led": hardware_state["green_led"],
            "threshold_cm": hardware_state["threshold_cm"],
            "protocol_version": hardware_state["protocol_version"]
        })

@app.route("/api/readings/latest", methods=["GET"])
def latest_reading():
    with state_lock:
        return jsonify({
            "id": f"rd-{hardware_state['last_update']}",
            "timestamp": hardware_state["last_update"] or int(time.time() * 1000),
            "distance_cm": hardware_state["distance_cm"],
            "occupied": hardware_state["occupied"],
            "mode": hardware_state["mode"],
            "threshold_cm": hardware_state["threshold_cm"],
            "red_led": hardware_state["red_led"],
            "green_led": hardware_state["green_led"],
            "source": "hardware"
        })

@app.route("/api/readings", methods=["GET"])
def get_readings():
    limit = min(int(request.args.get("limit", 100)), 1000)
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("SELECT id, timestamp, distance_cm, occupied, mode, threshold_cm, red_led, green_led, source FROM readings ORDER BY id DESC LIMIT ?", (limit,))
    rows = cur.fetchall()
    conn.close()

    result = [{
        "id": f"rd-{r[0]}",
        "timestamp": r[1],
        "distance_cm": r[2],
        "occupied": bool(r[3]),
        "mode": r[4],
        "threshold_cm": r[5],
        "red_led": bool(r[6]),
        "green_led": bool(r[7]),
        "source": r[8]
    } for r in reversed(rows)]
    return jsonify(result)

@app.route("/api/commands/mode", methods=["POST"])
def set_mode():
    data = request.json or {}
    new_mode = data.get("mode")
    if new_mode not in ["AUTO", "MANUAL"]:
        return jsonify({"error": "Invalid mode. Choose AUTO or MANUAL"}), 400

    if ser_conn and ser_conn.is_open:
        ser_conn.write(f"MODE:{new_mode}\\n".encode('utf-8'))
        with state_lock:
            hardware_state["mode"] = new_mode
        return jsonify({"success": True, "mode": new_mode})
    return jsonify({"error": "Arduino serial disconnected"}), 503

@app.route("/api/commands/led", methods=["POST"])
def set_led():
    with state_lock:
        if hardware_state["mode"] != "MANUAL":
            return jsonify({"error": "LED control only permitted in MANUAL mode"}), 400

    data = request.json or {}
    color = data.get("color")
    state = data.get("state")
    if color not in ["RED", "GREEN"] or state not in ["ON", "OFF"]:
        return jsonify({"error": "Invalid LED command"}), 400

    if ser_conn and ser_conn.is_open:
        ser_conn.write(f"LED:{color}:{state}\\n".encode('utf-8'))
        with state_lock:
            if color == "RED":
                hardware_state["red_led"] = (state == "ON")
            else:
                hardware_state["green_led"] = (state == "ON")
        return jsonify({"success": True, "color": color, "state": state})
    return jsonify({"error": "Arduino serial disconnected"}), 503

@app.route("/api/settings", methods=["PATCH"])
def update_settings():
    data = request.json or {}
    if "threshold_cm" in data:
        thresh = float(data["threshold_cm"])
        if thresh < 2 or thresh > 400:
            return jsonify({"error": "Threshold must be 2 - 400 cm"}), 400
        if ser_conn and ser_conn.is_open:
            ser_conn.write(f"THRESHOLD:{thresh}\\n".encode('utf-8'))
        with state_lock:
            hardware_state["threshold_cm"] = thresh
        return jsonify({"success": True, "threshold_cm": thresh})
    return jsonify({"error": "No valid parameters provided"}), 400

if __name__ == "__main__":
    init_db()
    t = threading.Thread(target=serial_reader_thread, daemon=True)
    t.start()
    app.run(host="127.0.0.1", port=5000, debug=False)
`;

  const arduinoCode = `// ==============================================================================
// ParkSense — Smart Parking IoT Firmware for Arduino Uno
// Hardware: HC-SR04 Ultrasonic Distance Sensor + Red & Green Indicator LEDs
// Baud Rate: 9600 8-N-1 | Output: Newline-delimited JSON
// ==============================================================================

const int TRIG_PIN = 9;    // HC-SR04 Trigger Pin
const int ECHO_PIN = 10;   // HC-SR04 Echo Pin
const int RED_LED_PIN = 4; // Red LED Pin (Occupied indicator, via 220Ω)
const int GRN_LED_PIN = 5; // Green LED Pin (Available indicator, via 220Ω)

// Firmware State
String currentMode = "AUTO"; // "AUTO" or "MANUAL"
float thresholdCm = 15.0;    // Distance threshold in cm
bool occupiedState = false;
bool manualRedLed = false;
bool manualGreenLed = true;

unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 1000; // 1 second report

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(GRN_LED_PIN, OUTPUT);

  // Initial LED state
  digitalWrite(RED_LED_PIN, LOW);
  digitalWrite(GRN_LED_PIN, HIGH);
}

// Measure distance in centimeters using HC-SR04
float measureDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Timeout after 30ms (~500 cm max range)
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) {
    return 200.0; // Echo timeout fallback (empty bay)
  }
  // Speed of sound = 343 m/s = 0.0343 cm/microsecond. Divide by 2 for round-trip.
  float distance = (duration * 0.0343) / 2.0;
  return distance;
}

void handleSerialCommands() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();

    if (cmd == "MODE:AUTO") {
      currentMode = "AUTO";
    } else if (cmd == "MODE:MANUAL") {
      currentMode = "MANUAL";
    } else if (cmd.startsWith("THRESHOLD:")) {
      float newThresh = cmd.substring(10).toFloat();
      if (newThresh >= 2.0 && newThresh <= 400.0) {
        thresholdCm = newThresh;
      }
    } else if (currentMode == "MANUAL") {
      if (cmd == "LED:RED:ON") manualRedLed = true;
      else if (cmd == "LED:RED:OFF") manualRedLed = false;
      else if (cmd == "LED:GREEN:ON") manualGreenLed = true;
      else if (cmd == "LED:GREEN:OFF") manualGreenLed = false;
    } else if (cmd == "RESET") {
      currentMode = "AUTO";
      thresholdCm = 15.0;
    }
  }
}

void loop() {
  handleSerialCommands();

  unsigned long currentMillis = millis();
  if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = currentMillis;

    float dist = measureDistanceCm();
    occupiedState = (dist < thresholdCm);

    // Apply LED outputs
    if (currentMode == "AUTO") {
      if (occupiedState) {
        digitalWrite(RED_LED_PIN, HIGH);
        digitalWrite(GRN_LED_PIN, LOW);
      } else {
        digitalWrite(RED_LED_PIN, LOW);
        digitalWrite(GRN_LED_PIN, HIGH);
      }
    } else {
      digitalWrite(RED_LED_PIN, manualRedLed ? HIGH : LOW);
      digitalWrite(GRN_LED_PIN, manualGreenLed ? HIGH : LOW);
    }

    // Emit newline-delimited JSON packet
    Serial.print("{\\"distance_cm\\":");
    Serial.print(dist, 1);
    Serial.print(",\\"occupied\\":");
    Serial.print(occupiedState ? "true" : "false");
    Serial.print(",\\"mode\\":\\"");
    Serial.print(currentMode);
    Serial.print("\\",\\"threshold_cm\\":");
    Serial.print(thresholdCm, 1);
    Serial.println("}");
  }
}
`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Hardware & Flask Backend Setup
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Everything needed to connect your physical Arduino Uno & HC-SR04 sensor to this dashboard.
        </p>
      </div>

      {/* Pinout & Wiring Visual Guide */}
      <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-700" />
          Circuit Pinout & Hardware Connections
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-800 block">HC-SR04 Sonar</span>
            <div className="mt-1 font-mono text-[11px] text-slate-600 space-y-0.5">
              <p>VCC → 5V</p>
              <p>GND → GND</p>
              <p>Trig → Pin 9</p>
              <p>Echo → Pin 10</p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-semibold text-rose-800 block">Red LED (Occupied)</span>
            <div className="mt-1 font-mono text-[11px] text-slate-600 space-y-0.5">
              <p>Anode (+) → Pin 4 (via 220Ω)</p>
              <p>Cathode (-) → GND</p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-semibold text-emerald-800 block">Green LED (Available)</span>
            <div className="mt-1 font-mono text-[11px] text-slate-600 space-y-0.5">
              <p>Anode (+) → Pin 5 (via 220Ω)</p>
              <p>Cathode (-) → GND</p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-semibold text-blue-800 block">Serial USB</span>
            <div className="mt-1 font-mono text-[11px] text-slate-600 space-y-0.5">
              <p>Port: COM3 / /dev/ttyACM0</p>
              <p>Baud: 9600</p>
              <p>Data Format: JSON string</p>
            </div>
          </div>
        </div>
      </div>

      {/* Step by Step Running Instructions */}
      <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-700" />
          Terminal Quickstart Commands
        </h3>

        <div className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs space-y-2 overflow-x-auto">
          <p className="text-slate-400"># 1. Install Python dependencies</p>
          <p className="text-emerald-400">pip install flask flask-cors pyserial</p>
          <p className="text-slate-400"># 2. Flash ParkSense.ino using the Arduino IDE to your Uno board</p>
          <p className="text-slate-400"># 3. Start the Flask serial bridge</p>
          <p className="text-emerald-400">python app.py</p>
          <p className="text-slate-400"># 4. In this web dashboard, toggle the top-right switch from 'Simulation' to 'Hardware'</p>
        </div>
      </div>

      {/* Code Snippets Section */}
      <div className="space-y-6">
        {/* Python Flask app.py */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-slate-700" />
              <span className="text-xs font-bold text-slate-900">Python Flask Gateway (app.py)</span>
            </div>
            <button
              onClick={() => copyToClipboard(flaskCode, 'flask')}
              className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 hover:text-slate-900 flex items-center gap-1.5 transition-colors shadow-xs"
            >
              {copiedSection === 'flask' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-4 bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
            {flaskCode}
          </pre>
        </div>

        {/* Arduino C++ parksense.ino */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-700" />
              <span className="text-xs font-bold text-slate-900">Arduino Uno Firmware (ParkSense.ino)</span>
            </div>
            <button
              onClick={() => copyToClipboard(arduinoCode, 'arduino')}
              className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 hover:text-slate-900 flex items-center gap-1.5 transition-colors shadow-xs"
            >
              {copiedSection === 'arduino' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-4 bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
            {arduinoCode}
          </pre>
        </div>
      </div>
    </div>
  );
};
