import time
import pytest

def test_reading_storage_and_retrieval(client, parking_service):
    now = int(time.time() * 1000)
    # Store reading
    parking_service.persist_reading({
        "timestamp": now,
        "distance_cm": 12.4,
        "occupied": True,
        "measurement_valid": True,
        "mode": "AUTO",
        "threshold_cm": 15.0,
        "red_led": True,
        "green_led": False,
        "source": "hardware",
    })

    # Retrieve latest reading
    res = client.get("/api/readings/latest?source=hardware")
    assert res.status_code == 200
    reading = res.get_json()
    assert reading["distance_cm"] == 12.4
    assert reading["occupied"] is True
    assert reading["measurement_valid"] is True
    assert reading["source"] == "hardware"

def test_analytics_with_no_readings(client):
    res = client.get("/api/analytics")
    assert res.status_code == 200
    data = res.get_json()
    assert data["total_recorded_readings"] == 0
    assert data["occupancy_rate"] == 0.0
    assert data["total_arrivals"] == 0
    assert data["total_departures"] == 0
    assert data["timeline"] == []

def test_analytics_with_valid_readings(client, parking_service):
    now = int(time.time() * 1000)

    # Insert 4 valid readings: 3 occupied, 1 vacant
    for i in range(3):
        parking_service.persist_reading({
            "timestamp": now - (1000 * (4 - i)),
            "distance_cm": 10.0,
            "occupied": True,
            "measurement_valid": True,
            "mode": "AUTO",
            "threshold_cm": 15.0,
            "red_led": True,
            "green_led": False,
            "source": "hardware",
        })
    parking_service.persist_reading({
        "timestamp": now,
        "distance_cm": 180.0,
        "occupied": False,
        "measurement_valid": True,
        "mode": "AUTO",
        "threshold_cm": 15.0,
        "red_led": False,
        "green_led": True,
        "source": "hardware",
    })

    res = client.get(f"/api/analytics?from={now - 10000}&to={now + 1000}&source=hardware")
    assert res.status_code == 200
    data = res.get_json()
    assert data["total_recorded_readings"] == 4
    # 3 out of 4 is 75%
    assert data["occupancy_rate"] == 75.0
    assert data["occupied_pct"] == 75.0
    assert data["available_pct"] == 25.0
    assert len(data["timeline"]) == 4

def test_invalid_sensor_measurement_policy(client, parking_service):
    now = int(time.time() * 1000)

    # 1 valid vacant reading
    parking_service.persist_reading({
        "timestamp": now - 2000,
        "distance_cm": 180.0,
        "occupied": False,
        "measurement_valid": True,
        "mode": "AUTO",
        "threshold_cm": 15.0,
        "red_led": False,
        "green_led": True,
        "source": "hardware",
    })

    # 1 invalid reading (sensor timeout, distance_cm is None, measurement_valid=False)
    parking_service.persist_reading({
        "timestamp": now - 1000,
        "distance_cm": None,
        "occupied": False,
        "measurement_valid": False,
        "mode": "AUTO",
        "threshold_cm": 15.0,
        "red_led": False,
        "green_led": False,
        "source": "hardware",
    })

    res = client.get(f"/api/analytics?from={now - 5000}&to={now + 1000}&source=hardware")
    assert res.status_code == 200
    data = res.get_json()
    # Invalid reading must be excluded from total valid readings count and occupancy rate denominator
    assert data["total_recorded_readings"] == 1
    assert data["occupancy_rate"] == 0.0

def test_occupancy_event_creation_only_on_state_change(parking_service):
    now = int(time.time() * 1000)

    # Initial state: Bay is empty (occupied=False)
    parking_service.on_hardware_reading({
        "timestamp": now,
        "distance_cm": 180.0,
        "occupied": False,
        "measurement_valid": True,
        "mode": "AUTO",
        "threshold_cm": 15.0,
        "red_led": False,
        "green_led": True,
        "source": "hardware",
    })
    ev1 = parking_service.get_events(source="hardware")["events"]
    assert len(ev1) == 0  # No transition yet

    # Second reading: Bay is STILL empty (no transition)
    parking_service.on_hardware_reading({
        "timestamp": now + 1000,
        "distance_cm": 182.0,
        "occupied": False,
        "measurement_valid": True,
        "mode": "AUTO",
        "threshold_cm": 15.0,
        "red_led": False,
        "green_led": True,
        "source": "hardware",
    })
    ev2 = parking_service.get_events(source="hardware")["events"]
    assert len(ev2) == 0  # Still no transition

    # Third reading: Car enters! (occupied=True) -> Must generate ARRIVAL event
    parking_service.on_hardware_reading({
        "timestamp": now + 2000,
        "distance_cm": 11.5,
        "occupied": True,
        "measurement_valid": True,
        "mode": "AUTO",
        "threshold_cm": 15.0,
        "red_led": True,
        "green_led": False,
        "source": "hardware",
    })
    ev3 = parking_service.get_events(source="hardware")["events"]
    assert len(ev3) == 1
    assert ev3[0]["event_type"] == "ARRIVAL"
    assert ev3[0]["new_state"] == "OCCUPIED"

    # Fourth reading: Car still parked (occupied=True) -> No new event!
    parking_service.on_hardware_reading({
        "timestamp": now + 3000,
        "distance_cm": 11.2,
        "occupied": True,
        "measurement_valid": True,
        "mode": "AUTO",
        "threshold_cm": 15.0,
        "red_led": True,
        "green_led": False,
        "source": "hardware",
    })
    ev4 = parking_service.get_events(source="hardware")["events"]
    assert len(ev4) == 1  # No duplicate event

    # Fifth reading: Car departs! (occupied=False) -> Must generate DEPARTURE event
    parking_service.on_hardware_reading({
        "timestamp": now + 4000,
        "distance_cm": 185.0,
        "occupied": False,
        "measurement_valid": True,
        "mode": "AUTO",
        "threshold_cm": 15.0,
        "red_led": False,
        "green_led": True,
        "source": "hardware",
    })
    ev5 = parking_service.get_events(source="hardware")["events"]
    assert len(ev5) == 2
    assert ev5[0]["event_type"] == "DEPARTURE"  # Newest first

def test_event_pagination_and_filtering(client, parking_service):
    now = int(time.time() * 1000)

    # Insert 5 events
    for i in range(5):
        parking_service.record_event(
            event_type="ARRIVAL" if i % 2 == 0 else "DEPARTURE",
            distance_cm=10.0 + i,
            previous_state="",
            new_state="",
            mode="AUTO",
            source="hardware",
            details=f"Test event {i}",
            timestamp=now + (i * 100),
        )

    # Query all with page size 2
    res_p1 = client.get("/api/events?page=1&limit=2&source=hardware")
    assert res_p1.status_code == 200
    data_p1 = res_p1.get_json()
    assert data_p1["total"] == 5
    assert len(data_p1["events"]) == 2
    assert data_p1["page"] == 1
    assert data_p1["totalPages"] == 3

    # Filter by ARRIVAL
    res_arr = client.get("/api/events?type=ARRIVAL&source=hardware")
    assert res_arr.status_code == 200
    data_arr = res_arr.get_json()
    assert data_arr["total"] == 3
    assert all(e["event_type"] == "ARRIVAL" for e in data_arr["events"])

def test_simulation_service_behavior(client, parking_service):
    # Step simulation
    res_step = client.post("/api/commands/simulation", json={"action": "step"})
    assert res_step.status_code == 200
    reading = res_step.get_json()["reading"]
    assert reading["source"] == "simulation"
    assert reading["measurement_valid"] is True
    assert "distance_cm" in reading

    # Check simulated status
    res_status = client.get("/api/status?mode=simulation")
    assert res_status.status_code == 200
    assert res_status.get_json()["port"] == "SIMULATOR"
