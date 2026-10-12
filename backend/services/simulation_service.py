import logging
import random
import threading
import time
from typing import Callable, Dict, Any, Optional

from config import Config

logger = logging.getLogger("parksense.simulation")

class SimulationService:
    def __init__(
        self,
        reading_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        event_callback: Optional[Callable[[str, float, str, str, str], None]] = None,
    ):
        self.reading_callback = reading_callback
        self.event_callback = event_callback

        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

        # Internal simulation physics state
        self._stage = "VACANT"  # VACANT, APPROACHING, PARKED, DEPARTING
        self._stage_ticks = 0
        self._distance_cm = 185.0
        self._threshold_cm = Config.DEFAULT_THRESHOLD_CM
        self._mode = "AUTO"
        self._red_led = False
        self._green_led = True
        self._occupied = False
        self._last_update_ms = int(time.time() * 1000)
        self._manual_override_ticks = 0

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="SimulationThread")
        self._thread.start()
        logger.info("SimulationService started")

    def stop(self) -> None:
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.5)
        logger.info("SimulationService stopped")

    def is_running(self) -> bool:
        return self._running

    def get_state(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "connected": True,
                "mode": "simulation",
                "firmware_mode": self._mode,
                "baud_rate": 9600,
                "port": "SIMULATOR",
                "sensor_health": "healthy",
                "backend_reachable": True,
                "last_reading_time": self._last_update_ms,
                "red_led": self._red_led,
                "green_led": self._green_led,
                "threshold_cm": self._threshold_cm,
                "protocol_version": "v1.2-sim",
                "distance_cm": self._distance_cm,
                "occupied": self._occupied,
                "measurement_valid": True,
                "is_stale": False,
            }

    def set_mode(self, new_mode: str) -> None:
        with self._lock:
            if new_mode in ("AUTO", "MANUAL"):
                self._mode = new_mode
                if self._mode == "AUTO":
                    self._red_led = self._occupied
                    self._green_led = not self._occupied

    def set_threshold(self, threshold_cm: float) -> None:
        with self._lock:
            self._threshold_cm = max(Config.MIN_THRESHOLD_CM, min(Config.MAX_THRESHOLD_CM, threshold_cm))
            if self._mode == "AUTO":
                self._occupied = self._distance_cm < self._threshold_cm
                self._red_led = self._occupied
                self._green_led = not self._occupied

    def set_led(self, color: str, state: str) -> bool:
        with self._lock:
            if self._mode != "MANUAL":
                return False
            is_on = state == "ON"
            if color == "RED":
                self._red_led = is_on
            elif color == "GREEN":
                self._green_led = is_on
            return True

    def reset_defaults(self) -> None:
        with self._lock:
            self._mode = "AUTO"
            self._threshold_cm = Config.DEFAULT_THRESHOLD_CM
            self._occupied = self._distance_cm < self._threshold_cm
            self._red_led = self._occupied
            self._green_led = not self._occupied

    def trigger_arrival(self) -> None:
        with self._lock:
            self._stage = "APPROACHING"
            self._stage_ticks = 0

    def trigger_departure(self) -> None:
        with self._lock:
            self._stage = "DEPARTING"
            self._stage_ticks = 0

    def set_manual_distance(self, distance_cm: float) -> None:
        with self._lock:
            self._distance_cm = round(distance_cm, 1)
            self._manual_override_ticks = 10  # hold for 10 ticks
            prev_occ = self._occupied
            self._occupied = self._distance_cm < self._threshold_cm
            if self._mode == "AUTO":
                self._red_led = self._occupied
                self._green_led = not self._occupied

            if prev_occ != self._occupied and self.event_callback:
                evt_type = "ARRIVAL" if self._occupied else "DEPARTURE"
                self.event_callback(
                    evt_type,
                    self._distance_cm,
                    "OCCUPIED" if prev_occ else "AVAILABLE",
                    "OCCUPIED" if self._occupied else "AVAILABLE",
                    "Manual simulation slider adjusted distance"
                )

    def step(self) -> Dict[str, Any]:
        """Perform one simulation step and return reading."""
        with self._lock:
            now_ms = int(time.time() * 1000)
            self._last_update_ms = now_ms

            if self._manual_override_ticks > 0:
                self._manual_override_ticks -= 1
            else:
                self._simulate_physics()

            prev_occ = self._occupied
            self._occupied = self._distance_cm < self._threshold_cm

            if self._mode == "AUTO":
                self._red_led = self._occupied
                self._green_led = not self._occupied

            payload = {
                "timestamp": now_ms,
                "distance_cm": round(self._distance_cm, 1),
                "occupied": self._occupied,
                "measurement_valid": True,
                "mode": self._mode,
                "threshold_cm": round(self._threshold_cm, 1),
                "red_led": self._red_led,
                "green_led": self._green_led,
                "source": "simulation",
            }

        # Fire callbacks outside lock
        if prev_occ != payload["occupied"] and self.event_callback:
            evt_type = "ARRIVAL" if payload["occupied"] else "DEPARTURE"
            self.event_callback(
                evt_type,
                payload["distance_cm"],
                "OCCUPIED" if prev_occ else "AVAILABLE",
                "OCCUPIED" if payload["occupied"] else "AVAILABLE",
                "Simulated vehicle state transition"
            )

        if self.reading_callback:
            self.reading_callback(payload)

        return payload

    def _simulate_physics(self) -> None:
        """Deterministic state-machine progression."""
        self._stage_ticks += 1
        noise = round(random.uniform(-0.3, 0.3), 1)

        if self._stage == "VACANT":
            self._distance_cm = 185.0 + noise
            # Auto trigger arrival after ~15 ticks
            if self._stage_ticks >= 15:
                self._stage = "APPROACHING"
                self._stage_ticks = 0

        elif self._stage == "APPROACHING":
            # Smoothly drop distance
            approach_steps = [150.0, 110.0, 75.0, 40.0, 22.0, 12.0, 8.5]
            idx = min(self._stage_ticks - 1, len(approach_steps) - 1)
            self._distance_cm = approach_steps[idx] + noise
            if idx == len(approach_steps) - 1:
                self._stage = "PARKED"
                self._stage_ticks = 0

        elif self._stage == "PARKED":
            self._distance_cm = 9.0 + noise
            # Auto trigger departure after ~15 ticks
            if self._stage_ticks >= 15:
                self._stage = "DEPARTING"
                self._stage_ticks = 0

        elif self._stage == "DEPARTING":
            depart_steps = [18.0, 45.0, 95.0, 140.0, 180.0, 188.0]
            idx = min(self._stage_ticks - 1, len(depart_steps) - 1)
            self._distance_cm = depart_steps[idx] + noise
            if idx == len(depart_steps) - 1:
                self._stage = "VACANT"
                self._stage_ticks = 0

    def _loop(self) -> None:
        while self._running:
            try:
                self.step()
            except Exception as e:
                logger.error(f"Error in simulation step: {e}", exc_info=True)
            time.sleep(1.0)
