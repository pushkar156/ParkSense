import json
import logging
import threading
import time
from typing import Callable, Dict, Any, List, Optional
import serial
import serial.tools.list_ports

from config import Config

logger = logging.getLogger("parksense.serial")

# Allowed firmware commands whitelist
VALID_COMMAND_PREFIXES = (
    "MODE:AUTO",
    "MODE:MANUAL",
    "LED:RED:ON",
    "LED:RED:OFF",
    "LED:GREEN:ON",
    "LED:GREEN:OFF",
    "RESET",
)

class SerialManager:
    def __init__(
        self,
        port: str = Config.ARDUINO_PORT,
        baud_rate: int = Config.ARDUINO_BAUD,
        reading_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        connection_callback: Optional[Callable[[bool, str], None]] = None,
    ):
        self.port = port
        self.baud_rate = baud_rate
        self.reading_callback = reading_callback
        self.connection_callback = connection_callback

        self._ser: Optional[serial.Serial] = None
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._lock = threading.Lock()
        self._write_lock = threading.Lock()

        self._state = {
            "connected": False,
            "port": self.port,
            "baud_rate": self.baud_rate,
            "distance_cm": None,
            "occupied": False,
            "measurement_valid": False,
            "mode": "AUTO",
            "threshold_cm": Config.DEFAULT_THRESHOLD_CM,
            "red_led": False,
            "green_led": True,
            "last_update": None,
            "protocol_version": "v1.2",
            "sensor_health": "offline",
        }

    @staticmethod
    def list_available_ports() -> List[Dict[str, str]]:
        """Enumerates available system COM/TTY ports."""
        ports = []
        for p in serial.tools.list_ports.comports():
            ports.append({
                "port": p.device,
                "description": p.description,
                "hwid": p.hwid,
            })
        return ports

    def get_state(self) -> Dict[str, Any]:
        """Thread-safe snapshot of current device state."""
        with self._lock:
            state_copy = dict(self._state)
            # Evaluate staleness
            now_ms = int(time.time() * 1000)
            last_ts = state_copy.get("last_update")
            if last_ts is not None:
                elapsed_sec = (now_ms - last_ts) / 1000.0
                state_copy["is_stale"] = elapsed_sec > Config.STALE_THRESHOLD_SECONDS
                if state_copy["is_stale"]:
                    state_copy["sensor_health"] = "warning"
            else:
                state_copy["is_stale"] = True
                if not state_copy["connected"]:
                    state_copy["sensor_health"] = "offline"
            return state_copy

    def update_port(self, new_port: str, new_baud: Optional[int] = None) -> None:
        """Dynamically switch port or baud rate."""
        with self._lock:
            self.port = new_port
            self._state["port"] = new_port
            if new_baud is not None:
                self.baud_rate = new_baud
                self._state["baud_rate"] = new_baud

        # Close existing connection to force re-opening with new port
        with self._write_lock:
            if self._ser and self._ser.is_open:
                try:
                    self._ser.close()
                except Exception as e:
                    logger.debug(f"Error closing port during switch: {e}")
                self._ser = None

    def start(self) -> None:
        """Start the background serial reader thread if not already running."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._reader_loop, daemon=True, name="SerialReaderThread")
        self._thread.start()
        logger.info(f"SerialManager started on {self.port} @ {self.baud_rate} baud")

    def stop(self) -> None:
        """Stop serial thread and close connection cleanly."""
        self._running = False
        with self._write_lock:
            if self._ser and self._ser.is_open:
                try:
                    self._ser.close()
                except Exception as e:
                    logger.warning(f"Error closing serial port: {e}")
                self._ser = None

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        logger.info("SerialManager stopped cleanly")

    def send_command(self, cmd_str: str) -> tuple[bool, str]:
        """Safely send validated command to Arduino."""
        cmd_clean = cmd_str.strip()
        # Strict whitelist validation
        is_valid = False
        if cmd_clean in VALID_COMMAND_PREFIXES:
            is_valid = True
        elif cmd_clean.startswith("THRESHOLD:"):
            try:
                val = float(cmd_clean.split(":", 1)[1])
                if Config.MIN_THRESHOLD_CM <= val <= Config.MAX_THRESHOLD_CM:
                    is_valid = True
                    cmd_clean = f"THRESHOLD:{val:.1f}"
            except ValueError:
                is_valid = False

        if not is_valid:
            logger.warning(f"Rejected invalid serial command: {cmd_str}")
            return False, f"Invalid command: {cmd_str}"

        with self._write_lock:
            if not self._ser or not self._ser.is_open:
                return False, f"Serial port {self.port} is disconnected"
            try:
                msg = f"{cmd_clean}\n".encode("utf-8")
                self._ser.write(msg)
                self._ser.flush()
                logger.info(f"Transmitted to Arduino: {cmd_clean}")
                return True, f"Command '{cmd_clean}' transmitted"
            except Exception as e:
                logger.error(f"Failed to transmit serial command '{cmd_clean}': {e}")
                return False, f"Transmission error: {str(e)}"

    def _reader_loop(self) -> None:
        """Continuous background serial monitoring loop."""
        reconnect_delay = 3.0
        while self._running:
            try:
                if not self._ser or not self._ser.is_open:
                    with self._write_lock:
                        try:
                            logger.info(f"Attempting serial connection to {self.port} @ {self.baud_rate}...")
                            self._ser = serial.Serial(self.port, self.baud_rate, timeout=1.5)
                            # Arduino resets upon DTR assert on serial open; wait 2s for bootloader
                            time.sleep(2.0)
                            with self._lock:
                                self._state["connected"] = True
                                self._state["sensor_health"] = "healthy"
                            logger.info(f"Successfully connected to Arduino on {self.port}")
                            if self.connection_callback:
                                self.connection_callback(True, f"Connected to Arduino on {self.port}")
                        except Exception as e:
                            with self._lock:
                                was_connected = self._state["connected"]
                                self._state["connected"] = False
                                self._state["sensor_health"] = "offline"
                            if was_connected and self.connection_callback:
                                self.connection_callback(False, f"Arduino disconnected: {str(e)}")
                            time.sleep(reconnect_delay)
                            continue

                # Read line
                line_bytes = self._ser.readline()
                if not line_bytes:
                    continue

                line_str = line_bytes.decode("utf-8", errors="ignore").strip()
                if not line_str:
                    continue

                self._process_serial_line(line_str)

            except serial.SerialException as se:
                logger.warning(f"Serial communication error on {self.port}: {se}")
                with self._lock:
                    was_conn = self._state["connected"]
                    self._state["connected"] = False
                    self._state["sensor_health"] = "offline"
                with self._write_lock:
                    if self._ser:
                        try:
                            self._ser.close()
                        except Exception:
                            pass
                        self._ser = None
                if was_conn and self.connection_callback:
                    self.connection_callback(False, f"Device connection lost: {str(se)}")
                time.sleep(reconnect_delay)

            except Exception as ex:
                logger.error(f"Unexpected error in serial reader thread: {ex}", exc_info=True)
                time.sleep(1.0)

    def _process_serial_line(self, line: str) -> None:
        """Validates and parses JSON telemetry payload."""
        if not (line.startswith("{") and line.endswith("}")):
            logger.debug(f"Ignored non-JSON serial line: {line}")
            return

        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            logger.warning(f"Malformed JSON from serial: {line}")
            return

        now_ms = int(time.time() * 1000)
        raw_dist = data.get("distance_cm")
        raw_occ = data.get("occupied")
        raw_mode = str(data.get("mode", "AUTO")).upper()
        raw_thresh = data.get("threshold_cm")

        # Validation
        valid_measurement = False
        distance_val: Optional[float] = None
        if isinstance(raw_dist, (int, float)) and raw_dist >= 0:
            valid_measurement = True
            distance_val = float(raw_dist)

        threshold_val = float(raw_thresh) if isinstance(raw_thresh, (int, float)) else Config.DEFAULT_THRESHOLD_CM
        mode_val = raw_mode if raw_mode in ("AUTO", "MANUAL") else "AUTO"

        # Occupancy logic
        if valid_measurement and raw_occ is not None:
            occupied_val = bool(raw_occ)
        elif valid_measurement and distance_val is not None:
            occupied_val = distance_val < threshold_val
        else:
            with self._lock:
                occupied_val = self._state["occupied"]  # Preserve last confirmed state

        with self._lock:
            self._state["connected"] = True
            self._state["measurement_valid"] = valid_measurement
            self._state["distance_cm"] = distance_val
            self._state["occupied"] = occupied_val
            self._state["mode"] = mode_val
            self._state["threshold_cm"] = threshold_val
            self._state["last_update"] = now_ms
            self._state["sensor_health"] = "healthy" if valid_measurement else "warning"

            if mode_val == "AUTO":
                self._state["red_led"] = occupied_val
                self._state["green_led"] = not occupied_val

        reading_payload = {
            "timestamp": now_ms,
            "distance_cm": distance_val,
            "occupied": occupied_val,
            "measurement_valid": valid_measurement,
            "mode": mode_val,
            "threshold_cm": threshold_val,
            "red_led": self._state["red_led"],
            "green_led": self._state["green_led"],
            "source": "hardware",
        }

        if self.reading_callback:
            try:
                self.reading_callback(reading_payload)
            except Exception as e:
                logger.error(f"Error executing reading callback: {e}", exc_info=True)
