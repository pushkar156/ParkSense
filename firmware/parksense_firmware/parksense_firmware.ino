// ==============================================================================
// ParkSense — Smart Parking IoT Firmware for Arduino Uno
// Hardware Pins: Red LED=13, Green LED=12, Trig=7, Echo=6
// Baud Rate: 9600 8-N-1 | Output: Newline-delimited JSON
// ==============================================================================

const int redLED = 13;
const int greenLED = 12;
const int trigPin = 7;
const int echoPin = 6;
const float threshold = 15.0;

void setup() {
  pinMode(redLED, OUTPUT);
  pinMode(greenLED, OUTPUT);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  // Initial state: Available (Green ON, Red OFF)
  digitalWrite(redLED, LOW);
  digitalWrite(greenLED, HIGH);

  Serial.begin(9600);
}

void loop() {
  // Send ultrasonic pulse
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // Read returning echo
  long duration = pulseIn(echoPin, HIGH, 30000);

  // Calculate distance in centimetres
  float distance = duration * 0.0343 / 2.0;
  bool valid = (duration > 0 && distance >= 2.0 && distance <= 400.0);
  bool occupied = (valid && distance <= threshold);

  // Control LEDs physically
  if (occupied) {
    digitalWrite(redLED, HIGH);
    digitalWrite(greenLED, LOW);
  } else {
    digitalWrite(redLED, LOW);
    digitalWrite(greenLED, HIGH);
  }

  // Output JSON telemetry for Python backend & Web Dashboard
  Serial.print("{\"distance_cm\":");
  if (valid) {
    Serial.print(distance, 1);
  } else {
    Serial.print("-1.0");
  }
  Serial.print(",\"occupied\":");
  Serial.print(occupied ? "true" : "false");
  Serial.println(",\"mode\":\"AUTO\",\"threshold_cm\":15.0}");

  delay(500); // 500ms telemetry interval
}
