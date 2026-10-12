// ==============================================================================
// ParkSense — Smart Parking IoT Firmware for Arduino Uno R3
// Hardware: HC-SR04 Ultrasonic Distance Sensor + Red & Green Indicator LEDs
// Baud Rate: 9600 8-N-1 | Output: Newline-delimited JSON
// ==============================================================================

// Pin Definitions according to Hardware Specification:
const int TRIG_PIN = 9;    // HC-SR04 Trigger Pin
const int ECHO_PIN = 10;   // HC-SR04 Echo Pin
const int RED_LED_PIN = 4; // Red LED Pin (Occupied indicator, via 220 ohm resistor)
const int GRN_LED_PIN = 5; // Green LED Pin (Available indicator, via 220 ohm resistor)

// System Configuration & Default Parameters
const float DEFAULT_THRESHOLD_CM = 15.0;
const float MIN_THRESHOLD_CM = 5.0;
const float MAX_THRESHOLD_CM = 100.0;
const unsigned long TELEMETRY_INTERVAL_MS = 1000; // 1 second report rate

// System Runtime State
String currentMode = "AUTO";            // "AUTO" or "MANUAL"
float thresholdCm = DEFAULT_THRESHOLD_CM; // Distance threshold in cm
bool occupiedState = false;             // True if bay is occupied
bool manualRedLed = false;              // Red LED state in MANUAL mode
bool manualGreenLed = true;             // Green LED state in MANUAL mode
unsigned long lastTelemetryTime = 0;

void setup() {
  Serial.begin(9600);
  while (!Serial && millis() < 3000) {
    // Wait for serial interface ready
  }

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(GRN_LED_PIN, OUTPUT);

  // Initialize pins to safe default: Available (Green ON, Red OFF)
  digitalWrite(RED_LED_PIN, LOW);
  digitalWrite(GRN_LED_PIN, HIGH);
}

// Measure distance in centimeters using HC-SR04 ultrasonic sensor.
// Returns -1.0 if echo times out or measurement is invalid.
float measureDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Timeout after 30ms (~500 cm max range)
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) {
    // Echo timeout / out of range
    return -1.0;
  }

  // Speed of sound = 343 m/s = 0.0343 cm/microsecond. Divide by 2 for round-trip.
  float distance = (duration * 0.0343) / 2.0;
  if (distance < 2.0 || distance > 450.0) {
    return -1.0;
  }
  return distance;
}

// Parse and execute supported serial commands sent from Python backend
void handleSerialCommands() {
  while (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.length() == 0) continue;

    if (cmd == "MODE:AUTO") {
      currentMode = "AUTO";
    } else if (cmd == "MODE:MANUAL") {
      currentMode = "MANUAL";
    } else if (cmd.startsWith("THRESHOLD:")) {
      float newThresh = cmd.substring(10).toFloat();
      if (newThresh >= MIN_THRESHOLD_CM && newThresh <= MAX_THRESHOLD_CM) {
        thresholdCm = newThresh;
      }
    } else if (cmd == "LED:RED:ON") {
      if (currentMode == "MANUAL") manualRedLed = true;
    } else if (cmd == "LED:RED:OFF") {
      if (currentMode == "MANUAL") manualRedLed = false;
    } else if (cmd == "LED:GREEN:ON") {
      if (currentMode == "MANUAL") manualGreenLed = true;
    } else if (cmd == "LED:GREEN:OFF") {
      if (currentMode == "MANUAL") manualGreenLed = false;
    } else if (cmd == "RESET") {
      currentMode = "AUTO";
      thresholdCm = DEFAULT_THRESHOLD_CM;
      manualRedLed = false;
      manualGreenLed = true;
    }
  }
}

void loop() {
  // Process any incoming serial commands
  handleSerialCommands();

  unsigned long currentMillis = millis();
  if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = currentMillis;

    float dist = measureDistanceCm();
    bool validMeasurement = (dist >= 0.0);

    // In AUTO mode, update occupancy based on valid distance measurement
    if (validMeasurement) {
      occupiedState = (dist < thresholdCm);
    }

    // Apply LED outputs based on mode
    if (currentMode == "AUTO") {
      if (occupiedState) {
        digitalWrite(RED_LED_PIN, HIGH);
        digitalWrite(GRN_LED_PIN, LOW);
      } else {
        digitalWrite(RED_LED_PIN, LOW);
        digitalWrite(GRN_LED_PIN, HIGH);
      }
    } else {
      // MANUAL mode: directly obey commanded LED states
      digitalWrite(RED_LED_PIN, manualRedLed ? HIGH : LOW);
      digitalWrite(GRN_LED_PIN, manualGreenLed ? HIGH : LOW);
    }

    // Emit newline-delimited JSON telemetry packet
    Serial.print("{\"distance_cm\":");
    if (validMeasurement) {
      Serial.print(dist, 1);
    } else {
      Serial.print("-1.0");
    }
    Serial.print(",\"occupied\":");
    Serial.print(occupiedState ? "true" : "false");
    Serial.print(",\"mode\":\"");
    Serial.print(currentMode);
    Serial.print("\",\"threshold_cm\":");
    Serial.print(thresholdCm, 1);
    Serial.println("}");
  }
}
