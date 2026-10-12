import datetime
import sqlite3
import time
from typing import Dict, Any, List, Optional
from database import get_connection

class AnalyticsService:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path

    def compute_summary(
        self,
        from_ts: Optional[int] = None,
        to_ts: Optional[int] = None,
        source: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Calculates authentic analytics summary from SQLite database."""
        now_ms = int(time.time() * 1000)
        if to_ts is None:
            to_ts = now_ms
        if from_ts is None:
            from_ts = to_ts - (24 * 60 * 60 * 1000)

        conn = get_connection(self.db_path)
        cur = conn.cursor()

        # Source filter clause
        src_clause = ""
        params_base: List[Any] = [from_ts, to_ts]
        if source:
            src_clause = " AND source = ?"
            params_base.append(source)

        # 1. Total valid and occupied readings
        cur.execute(f"""
            SELECT
                COUNT(*) as total_valid,
                SUM(CASE WHEN occupied = 1 THEN 1 ELSE 0 END) as total_occ,
                AVG(distance_cm) as avg_dist,
                MIN(distance_cm) as min_dist,
                MAX(distance_cm) as max_dist
            FROM readings
            WHERE measurement_valid = 1
              AND timestamp >= ? AND timestamp <= ?
              {src_clause}
        """, params_base)
        stats_row = cur.fetchone()

        total_valid = stats_row["total_valid"] if stats_row and stats_row["total_valid"] else 0
        total_occ = stats_row["total_occ"] if stats_row and stats_row["total_occ"] else 0

        if total_valid > 0:
            occupancy_rate = round((total_occ / total_valid) * 100.0, 1)
            occupied_pct = occupancy_rate
            available_pct = round(100.0 - occupied_pct, 1)
        else:
            occupancy_rate = 0.0
            occupied_pct = 0.0
            available_pct = 100.0

        # 2. Event counts (Arrivals & Departures)
        cur.execute(f"""
            SELECT
                SUM(CASE WHEN event_type = 'ARRIVAL' THEN 1 ELSE 0 END) as arrivals,
                SUM(CASE WHEN event_type = 'DEPARTURE' THEN 1 ELSE 0 END) as departures
            FROM events
            WHERE timestamp >= ? AND timestamp <= ?
              {src_clause}
        """, params_base)
        evt_row = cur.fetchone()
        total_arrivals = evt_row["arrivals"] if evt_row and evt_row["arrivals"] else 0
        total_departures = evt_row["departures"] if evt_row and evt_row["departures"] else 0

        # 3. Durations between sequential ARRIVAL and DEPARTURE events
        cur.execute(f"""
            SELECT event_type, timestamp
            FROM events
            WHERE event_type IN ('ARRIVAL', 'DEPARTURE')
              AND timestamp >= ? AND timestamp <= ?
              {src_clause}
            ORDER BY timestamp ASC
        """, params_base)
        evt_rows = cur.fetchall()

        durations_sec: List[float] = []
        last_arrival_ts: Optional[int] = None
        for r in evt_rows:
            if r["event_type"] == "ARRIVAL":
                last_arrival_ts = r["timestamp"]
            elif r["event_type"] == "DEPARTURE" and last_arrival_ts is not None:
                duration_s = (r["timestamp"] - last_arrival_ts) / 1000.0
                if duration_s > 0:
                    durations_sec.append(duration_s)
                last_arrival_ts = None

        if durations_sec:
            avg_occupied_duration = round(sum(durations_sec) / len(durations_sec), 0)
            longest_occupied_duration = round(max(durations_sec), 0)
        else:
            avg_occupied_duration = 0
            longest_occupied_duration = 0

        # 4. Hourly Distribution (24-hour summary)
        # Create standard hourly buckets
        hourly_map: Dict[str, Dict[str, Any]] = {}
        # Fetch readings grouped by hour
        cur.execute(f"""
            SELECT
                timestamp,
                occupied,
                measurement_valid
            FROM readings
            WHERE timestamp >= ? AND timestamp <= ?
              {src_clause}
            ORDER BY timestamp ASC
        """, params_base)
        hourly_readings = cur.fetchall()

        for r in hourly_readings:
            dt = datetime.datetime.fromtimestamp(r["timestamp"] / 1000.0)
            hour_str = f"{dt.hour:02d}:00"
            if hour_str not in hourly_map:
                hourly_map[hour_str] = {"arrivals": 0, "departures": 0, "total": 0, "occ": 0}
            hourly_map[hour_str]["total"] += 1
            if r["occupied"] == 1:
                hourly_map[hour_str]["occ"] += 1

        for r in evt_rows:
            dt = datetime.datetime.fromtimestamp(r["timestamp"] / 1000.0)
            hour_str = f"{dt.hour:02d}:00"
            if hour_str not in hourly_map:
                hourly_map[hour_str] = {"arrivals": 0, "departures": 0, "total": 0, "occ": 0}
            if r["event_type"] == "ARRIVAL":
                hourly_map[hour_str]["arrivals"] += 1
            elif r["event_type"] == "DEPARTURE":
                hourly_map[hour_str]["departures"] += 1

        hourly_distribution = []
        for hour in sorted(hourly_map.keys()):
            h_data = hourly_map[hour]
            pct = round((h_data["occ"] / h_data["total"]) * 100.0, 1) if h_data["total"] > 0 else 0.0
            hourly_distribution.append({
                "hour": hour,
                "arrivals": h_data["arrivals"],
                "departures": h_data["departures"],
                "occupancy_pct": pct,
            })

        # 5. Timeline points for chart (sample up to 150 points)
        cur.execute(f"""
            SELECT timestamp, distance_cm, occupied, threshold_cm
            FROM readings
            WHERE timestamp >= ? AND timestamp <= ?
              {src_clause}
            ORDER BY timestamp ASC
        """, params_base)
        timeline_rows = cur.fetchall()

        timeline = []
        step = max(1, len(timeline_rows) // 100) if len(timeline_rows) > 100 else 1
        for idx in range(0, len(timeline_rows), step):
            row = timeline_rows[idx]
            dt = datetime.datetime.fromtimestamp(row["timestamp"] / 1000.0)
            timeline.append({
                "timestamp": row["timestamp"],
                "time": dt.strftime("%H:%M:%S"),
                "distance_cm": round(row["distance_cm"], 1) if row["distance_cm"] is not None else 0.0,
                "occupied": bool(row["occupied"]) if row["occupied"] is not None else False,
                "threshold_cm": round(row["threshold_cm"], 1),
            })

        conn.close()

        return {
            "occupancy_rate": occupancy_rate,
            "total_arrivals": total_arrivals,
            "total_departures": total_departures,
            "avg_occupied_duration_sec": int(avg_occupied_duration),
            "longest_occupied_duration_sec": int(longest_occupied_duration),
            "total_recorded_readings": total_valid,
            "available_pct": available_pct,
            "occupied_pct": occupied_pct,
            "hourly_distribution": hourly_distribution,
            "timeline": timeline,
        }
