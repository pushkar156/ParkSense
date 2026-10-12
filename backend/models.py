from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any

@dataclass
class Reading:
    id: Optional[int]
    timestamp: int
    distance_cm: Optional[float]
    occupied: Optional[bool]
    measurement_valid: bool
    mode: str
    threshold_cm: float
    red_led: bool
    green_led: bool
    source: str = "hardware"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": f"rd-{self.id}" if self.id is not None else "",
            "timestamp": self.timestamp,
            "distance_cm": round(self.distance_cm, 1) if self.distance_cm is not None else None,
            "occupied": bool(self.occupied) if self.occupied is not None else False,
            "measurement_valid": bool(self.measurement_valid),
            "mode": self.mode,
            "threshold_cm": round(self.threshold_cm, 1),
            "red_led": bool(self.red_led),
            "green_led": bool(self.green_led),
            "source": self.source,
        }

@dataclass
class ParkingEventModel:
    id: Optional[int]
    timestamp: int
    event_type: str
    distance_cm: Optional[float]
    previous_state: str
    new_state: str
    mode: str
    source: str
    details: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": f"evt-{self.id}" if self.id is not None else "",
            "timestamp": self.timestamp,
            "event_type": self.event_type,
            "distance_cm": round(self.distance_cm, 1) if self.distance_cm is not None else 0.0,
            "previous_state": self.previous_state,
            "new_state": self.new_state,
            "mode": self.mode,
            "source": self.source,
            "details": self.details,
        }

@dataclass
class SystemSettings:
    threshold_cm: float
    mode: str
    simulation_enabled: bool
    updated_at: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "threshold_cm": round(self.threshold_cm, 1),
            "mode": self.mode,
            "simulation_enabled": bool(self.simulation_enabled),
            "updated_at": self.updated_at,
        }
