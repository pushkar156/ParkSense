import logging
import sqlite3
import time
from typing import Dict, Any, List, Optional, Tuple

from config import Config
from database import get_connection
from models import Reading, ParkingEventModel, SystemSettings
from services.serial_manager import SerialManager
from services.simulation_service import SimulationService

logger = logging.getLogger("parksense.parking")

class ParkingService:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path
        self._last_hardware_occupancy: Optional[bool] = None
        self._last_simulation_occupancy: Optional[bool] = None

        # Instantiate Serial Manager
        self.serial_manager = SerialManager(
            port=Config.ARDUINO_PORT,
            baud_rate=Config.ARDUINO_BAUD,
            reading_callback=self.on_hardware_reading,
            connection_callback=self.on_hardware_connection_change,
        )

        # Instantiate Simulation Service
        self.simulation_service = SimulationService(
            reading_callback=self.on_simulation_reading,
            event_callback=self.on_simulation_event,
        )

        # Load persisted settings
        self.settings = self._load_settings()

        # If simulation configured on startup, start it
        if self.settings.simulation_enabled:
            self.simulation_service.start()

    def start_services(self) -> None:
        """Starts background hardware serial worker and simulation if enabled."""
        self.serial_manager.start()
        if self.settings.simulation_enabled:
            self.simulation_service.start()

    def stop_services(self) -> None:
        self.serial_manager.stop()
        self.simulation_service.stop()

    # ------------------ Database Helpers ------------------

    def _load_settings(self) -> SystemSettings:
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT threshold_cm, mode, simulation_enabled, updated_at FROM settings WHERE id = 1")
        row = cur.fetchone()
        conn.close()
        if row:
            return SystemSettings(
                threshold_cm=float(row["threshold_cm"]),
                mode=str(row["mode"]),
                simulation_enabled=bool(row["simulation_enabled"]),
                updated_at=int(row["updated_at"]),
            )
        return SystemSettings(
            threshold_cm=Config.DEFAULT_THRESHOLD_CM,
            mode="AUTO",
            simulation_enabled=Config.SIMULATION_ENABLED,
            updated_at=int(time.time() * 1000),
        )

    def persist_reading(self, payload: Dict[str, Any]) -> int:
        """Inserts a sensor reading into the readings table."""
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO readings (
                timestamp, distance_cm, occupied, measurement_valid,
                mode, threshold_cm, red_led, green_led, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            payload["timestamp"],
            payload["distance_cm"],
            1 if payload.get("occupied") else 0 if payload.get("occupied") is not None else None,
            1 if payload.get("measurement_valid") else 0,
            payload.get("mode", "AUTO"),
            payload.get("threshold_cm", Config.DEFAULT_THRESHOLD_CM),
            1 if payload.get("red_led") else 0,
            1 if payload.get("green_led") else 0,
            payload.get("source", "hardware"),
        ))
        row_id = cur.lastrowid
        conn.commit()
        conn.close()
        return row_id

    def record_event(
        self,
        event_type: str,
        distance_cm: Optional[float],
        previous_state: str,
        new_state: str,
        mode: str,
        source: str,
        details: str,
        timestamp: Optional[int] = None,
    ) -> int:
        """Records an event into the events table."""
        now_ts = timestamp or int(time.time() * 1000)
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO events (
                timestamp, event_type, distance_cm, previous_state,
                new_state, mode, source, details
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            now_ts,
            event_type,
            distance_cm,
            previous_state,
            new_state,
            mode,
            source,
            details,
        ))
        row_id = cur.lastrowid
        conn.commit()
        conn.close()
        logger.info(f"Event recorded [{source}]: {event_type} - {details}")
        return row_id

    # ------------------ Hardware Callbacks ------------------

    def on_hardware_reading(self, payload: Dict[str, Any]) -> None:
        """Called whenever the serial reader parses a valid or invalid message."""
        self.persist_reading(payload)

        # Check occupancy change only if measurement was valid
        if payload.get("measurement_valid"):
            current_occ = bool(payload.get("occupied"))
            if self._last_hardware_occupancy is not None and self._last_hardware_occupancy != current_occ:
                event_type = "ARRIVAL" if current_occ else "DEPARTURE"
                prev_state = "OCCUPIED" if self._last_hardware_occupancy else "AVAILABLE"
                new_state = "OCCUPIED" if current_occ else "AVAILABLE"
                self.record_event(
                    event_type=event_type,
                    distance_cm=payload.get("distance_cm"),
                    previous_state=prev_state,
                    new_state=new_state,
                    mode=payload.get("mode", "AUTO"),
                    source="hardware",
                    details="Vehicle entered bay" if current_occ else "Vehicle cleared bay",
                    timestamp=payload["timestamp"],
                )
            self._last_hardware_occupancy = current_occ

    def on_hardware_connection_change(self, connected: bool, message: str) -> None:
        """Called when serial connection state flips."""
        self.record_event(
            event_type="CONNECTION_CHANGE",
            distance_cm=0.0,
            previous_state="DISCONNECTED" if connected else "CONNECTED",
            new_state="CONNECTED" if connected else "DISCONNECTED",
            mode="AUTO",
            source="hardware",
            details=message,
        )

    # ------------------ Simulation Callbacks ------------------

    def on_simulation_reading(self, payload: Dict[str, Any]) -> None:
        self.persist_reading(payload)

    def on_simulation_event(
        self,
        event_type: str,
        distance_cm: float,
        previous_state: str,
        new_state: str,
        details: str,
    ) -> None:
        self.record_event(
            event_type=event_type,
            distance_cm=distance_cm,
            previous_state=previous_state,
            new_state=new_state,
            mode=self.settings.mode,
            source="simulation",
            details=details,
        )

    # ------------------ API Service Methods ------------------

    def get_status(self, source_mode: str = "hardware") -> Dict[str, Any]:
        """Provides status response matching frontend DeviceStatus schema."""
        if source_mode == "simulation":
            sim_state = self.simulation_service.get_state()
            return {
                "connected": True,
                "mode": "simulation",
                "firmware_mode": sim_state["firmware_mode"],
                "baud_rate": sim_state["baud_rate"],
                "port": sim_state["port"],
                "sensor_health": sim_state["sensor_health"],
                "backend_reachable": True,
                "last_reading_time": sim_state["last_reading_time"],
                "red_led": sim_state["red_led"],
                "green_led": sim_state["green_led"],
                "threshold_cm": sim_state["threshold_cm"],
                "protocol_version": sim_state["protocol_version"],
            }

        hw_state = self.serial_manager.get_state()
        return {
            "connected": hw_state["connected"] and not hw_state["is_stale"],
            "mode": "hardware",
            "firmware_mode": hw_state["mode"],
            "baud_rate": hw_state["baud_rate"],
            "port": hw_state["port"],
            "sensor_health": hw_state["sensor_health"],
            "backend_reachable": True,
            "last_reading_time": hw_state["last_update"],
            "red_led": hw_state["red_led"],
            "green_led": hw_state["green_led"],
            "threshold_cm": hw_state["threshold_cm"],
            "protocol_version": hw_state["protocol_version"],
        }

    def get_latest_reading(self, source_mode: str = "hardware") -> Optional[Dict[str, Any]]:
        """Returns latest reading from live state or database."""
        if source_mode == "simulation":
            sim_state = self.simulation_service.get_state()
            return {
                "id": f"rd-{sim_state['last_reading_time']}",
                "timestamp": sim_state["last_reading_time"],
                "distance_cm": sim_state["distance_cm"],
                "occupied": sim_state["occupied"],
                "measurement_valid": sim_state["measurement_valid"],
                "mode": sim_state["firmware_mode"],
                "threshold_cm": sim_state["threshold_cm"],
                "red_led": sim_state["red_led"],
                "green_led": sim_state["green_led"],
                "source": "simulation",
            }

        # Hardware mode
        hw_state = self.serial_manager.get_state()
        if hw_state["last_update"] is not None:
            return {
                "id": f"rd-{hw_state['last_update']}",
                "timestamp": hw_state["last_update"],
                "distance_cm": hw_state["distance_cm"],
                "occupied": hw_state["occupied"],
                "measurement_valid": hw_state["measurement_valid"],
                "mode": hw_state["mode"],
                "threshold_cm": hw_state["threshold_cm"],
                "red_led": hw_state["red_led"],
                "green_led": hw_state["green_led"],
                "source": "hardware",
            }

        # Fallback to database
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("""
            SELECT id, timestamp, distance_cm, occupied, measurement_valid,
                   mode, threshold_cm, red_led, green_led, source
            FROM readings WHERE source = 'hardware' ORDER BY id DESC LIMIT 1
        """)
        row = cur.fetchone()
        conn.close()
        if row:
            r = Reading(
                id=row["id"],
                timestamp=row["timestamp"],
                distance_cm=row["distance_cm"],
                occupied=bool(row["occupied"]) if row["occupied"] is not None else False,
                measurement_valid=bool(row["measurement_valid"]),
                mode=row["mode"],
                threshold_cm=row["threshold_cm"],
                red_led=bool(row["red_led"]),
                green_led=bool(row["green_led"]),
                source=row["source"],
            )
            return r.to_dict()
        return None

    def get_readings(
        self,
        from_ts: Optional[int] = None,
        to_ts: Optional[int] = None,
        limit: int = 100,
        source: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch historical readings sorted ascending (oldest first) as expected by Recharts."""
        limit = max(1, min(limit, 2000))
        query = ["SELECT id, timestamp, distance_cm, occupied, measurement_valid, mode, threshold_cm, red_led, green_led, source FROM readings WHERE 1=1"]
        params: List[Any] = []

        if source:
            query.append("AND source = ?")
            params.append(source)
        if from_ts is not None:
            query.append("AND timestamp >= ?")
            params.append(from_ts)
        if to_ts is not None:
            query.append("AND timestamp <= ?")
            params.append(to_ts)

        query.append("ORDER BY id DESC LIMIT ?")
        params.append(limit)

        conn = get_connection(self.db_path)
        cur = conn.cursor()
        cur.execute(" ".join(query), params)
        rows = cur.fetchall()
        conn.close()

        # Reverse to chronological order (oldest to newest) for charts
        result = []
        for r in reversed(rows):
            item = Reading(
                id=r["id"],
                timestamp=r["timestamp"],
                distance_cm=r["distance_cm"],
                occupied=bool(r["occupied"]) if r["occupied"] is not None else False,
                measurement_valid=bool(r["measurement_valid"]),
                mode=r["mode"],
                threshold_cm=r["threshold_cm"],
                red_led=bool(r["red_led"]),
                green_led=bool(r["green_led"]),
                source=r["source"],
            )
            result.append(item.to_dict())
        return result

    def get_events(
        self,
        event_type: Optional[str] = None,
        from_ts: Optional[int] = None,
        to_ts: Optional[int] = None,
        page: int = 1,
        limit: int = 15,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Paginated event queries."""
        page = max(1, page)
        limit = max(1, min(limit, 200))
        offset = (page - 1) * limit

        where_clauses = ["1=1"]
        params: List[Any] = []

        if source:
            where_clauses.append("source = ?")
            params.append(source)
        if event_type and event_type != "ALL":
            where_clauses.append("event_type = ?")
            params.append(event_type)
        if from_ts is not None:
            where_clauses.append("timestamp >= ?")
            params.append(from_ts)
        if to_ts is not None:
            where_clauses.append("timestamp <= ?")
            params.append(to_ts)

        where_sql = " AND ".join(where_clauses)

        conn = get_connection(self.db_path)
        cur = conn.cursor()

        # Count total
        cur.execute(f"SELECT COUNT(*) as cnt FROM events WHERE {where_sql}", params)
        total = cur.fetchone()["cnt"]

        # Fetch page
        query_sql = f"""
            SELECT id, timestamp, event_type, distance_cm, previous_state, new_state, mode, source, details
            FROM events
            WHERE {where_sql}
            ORDER BY timestamp DESC, id DESC
            LIMIT ? OFFSET ?
        """
        cur.execute(query_sql, params + [limit, offset])
        rows = cur.fetchall()
        conn.close()

        events_list = []
        for r in rows:
            ev = ParkingEventModel(
                id=r["id"],
                timestamp=r["timestamp"],
                event_type=r["event_type"],
                distance_cm=r["distance_cm"],
                previous_state=r["previous_state"],
                new_state=r["new_state"],
                mode=r["mode"],
                source=r["source"],
                details=r["details"],
            )
            events_list.append(ev.to_dict())

        total_pages = max(1, (total + limit - 1) // limit)
        return {
            "events": events_list,
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": total_pages,
        }

    def clear_events(self, source: Optional[str] = None) -> bool:
        """Purges events for specified source or all."""
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        if source:
            cur.execute("DELETE FROM events WHERE source = ?", (source,))
        else:
            cur.execute("DELETE FROM events")
        conn.commit()
        conn.close()
        return True

    # ------------------ Commands & Settings ------------------

    def set_mode(self, new_mode: str, source: str = "hardware") -> Tuple[bool, str]:
        if new_mode not in ("AUTO", "MANUAL"):
            return False, "Mode must be either 'AUTO' or 'MANUAL'"

        if source == "simulation":
            self.simulation_service.set_mode(new_mode)
            self._update_persisted_mode(new_mode)
            self.record_event(
                event_type="MODE_CHANGE",
                distance_cm=self.simulation_service.get_state()["distance_cm"],
                previous_state=self.settings.mode,
                new_state=new_mode,
                mode=new_mode,
                source="simulation",
                details=f"Operating mode switched to {new_mode}",
            )
            return True, f"Mode set to {new_mode}"

        # Hardware mode
        ok, msg = self.serial_manager.send_command(f"MODE:{new_mode}")
        if ok:
            self._update_persisted_mode(new_mode)
            hw = self.serial_manager.get_state()
            self.record_event(
                event_type="MODE_CHANGE",
                distance_cm=hw.get("distance_cm"),
                previous_state=self.settings.mode,
                new_state=new_mode,
                mode=new_mode,
                source="hardware",
                details=f"Operating mode switched to {new_mode}",
            )
            return True, f"Mode set to {new_mode}"
        return False, msg

    def set_led(self, color: str, state: str, source: str = "hardware") -> Tuple[bool, str]:
        color = color.upper()
        state = state.upper()
        if color not in ("RED", "GREEN"):
            return False, "LED color must be 'RED' or 'GREEN'"
        if state not in ("ON", "OFF"):
            return False, "LED state must be 'ON' or 'OFF'"

        if source == "simulation":
            if self.simulation_service.get_state()["firmware_mode"] != "MANUAL":
                return False, "Cannot control LEDs in AUTO mode. Switch to MANUAL first."
            self.simulation_service.set_led(color, state)
            self.record_event(
                event_type="LED_TOGGLE",
                distance_cm=self.simulation_service.get_state()["distance_cm"],
                previous_state="",
                new_state=f"{color}_{state}",
                mode="MANUAL",
                source="simulation",
                details=f"Turned {color} LED {state}",
            )
            return True, f"Turned {color} LED {state}"

        # Hardware mode
        hw = self.serial_manager.get_state()
        if hw["mode"] != "MANUAL":
            return False, "Cannot control LEDs in AUTO mode. Switch to MANUAL first."

        ok, msg = self.serial_manager.send_command(f"LED:{color}:{state}")
        if ok:
            self.record_event(
                event_type="LED_TOGGLE",
                distance_cm=hw.get("distance_cm"),
                previous_state="",
                new_state=f"{color}_{state}",
                mode="MANUAL",
                source="hardware",
                details=f"Turned {color} LED {state}",
            )
            return True, f"Turned {color} LED {state}"
        return False, msg

    def set_threshold(self, threshold_cm: float, source: str = "hardware") -> Tuple[bool, str]:
        if not (Config.MIN_THRESHOLD_CM <= threshold_cm <= Config.MAX_THRESHOLD_CM):
            return False, f"Threshold must be between {Config.MIN_THRESHOLD_CM} and {Config.MAX_THRESHOLD_CM} cm"

        now_ts = int(time.time() * 1000)
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("UPDATE settings SET threshold_cm = ?, updated_at = ? WHERE id = 1", (threshold_cm, now_ts))
        conn.commit()
        conn.close()
        self.settings.threshold_cm = threshold_cm

        if source == "simulation":
            self.simulation_service.set_threshold(threshold_cm)
            self.record_event(
                event_type="THRESHOLD_UPDATE",
                distance_cm=self.simulation_service.get_state()["distance_cm"],
                previous_state="",
                new_state=f"{threshold_cm:.1f} cm",
                mode=self.settings.mode,
                source="simulation",
                details=f"Threshold updated to {threshold_cm:.1f} cm",
            )
            return True, f"Threshold updated to {threshold_cm:.1f} cm"

        # Hardware mode
        ok, msg = self.serial_manager.send_command(f"THRESHOLD:{threshold_cm:.1f}")
        hw = self.serial_manager.get_state()
        self.record_event(
            event_type="THRESHOLD_UPDATE",
            distance_cm=hw.get("distance_cm"),
            previous_state="",
            new_state=f"{threshold_cm:.1f} cm",
            mode=hw.get("mode", "AUTO"),
            source="hardware",
            details=f"Threshold updated to {threshold_cm:.1f} cm (Hardware: {'Transmitted' if ok else 'Offline'})",
        )
        return True, f"Threshold updated to {threshold_cm:.1f} cm"

    def reset_device(self, source: str = "hardware") -> Tuple[bool, str]:
        default_thresh = Config.DEFAULT_THRESHOLD_CM
        now_ts = int(time.time() * 1000)
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("UPDATE settings SET threshold_cm = ?, mode = 'AUTO', updated_at = ? WHERE id = 1", (default_thresh, now_ts))
        conn.commit()
        conn.close()

        self.settings.threshold_cm = default_thresh
        self.settings.mode = "AUTO"

        if source == "simulation":
            self.simulation_service.reset_defaults()
            self.record_event(
                event_type="DEVICE_RESET",
                distance_cm=self.simulation_service.get_state()["distance_cm"],
                previous_state="",
                new_state="DEFAULTS",
                mode="AUTO",
                source="simulation",
                details="Restored simulation defaults: Mode AUTO, Threshold 15 cm",
            )
            return True, "Simulation parameters reset to defaults"

        # Hardware mode
        ok, msg = self.serial_manager.send_command("RESET")
        hw = self.serial_manager.get_state()
        self.record_event(
            event_type="DEVICE_RESET",
            distance_cm=hw.get("distance_cm"),
            previous_state="",
            new_state="DEFAULTS",
            mode="AUTO",
            source="hardware",
            details="Device parameters reset: Mode AUTO, Threshold 15 cm",
        )
        if ok:
            return True, "Device reset command transmitted"
        return True, "Settings restored in database (hardware was offline)"

    def _update_persisted_mode(self, mode: str) -> None:
        self.settings.mode = mode
        now_ts = int(time.time() * 1000)
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("UPDATE settings SET mode = ?, updated_at = ? WHERE id = 1", (mode, now_ts))
        conn.commit()
        conn.close()
