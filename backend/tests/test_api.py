import time
import pytest

def test_health_endpoint(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "healthy"
    assert "hardware_connected" in data
    assert data["database"] == "connected"
    assert isinstance(data["timestamp"], int)

def test_status_endpoint_with_no_hardware(client):
    res = client.get("/api/status")
    assert res.status_code == 200
    data = res.get_json()
    assert data["connected"] is False  # Hardware is not physically connected
    assert data["mode"] == "hardware"
    assert data["backend_reachable"] is True
    assert data["sensor_health"] == "offline"
    assert "threshold_cm" in data
    assert "protocol_version" in data

def test_status_simulation_mode(client):
    res = client.get("/api/status?mode=simulation")
    assert res.status_code == 200
    data = res.get_json()
    assert data["connected"] is True
    assert data["mode"] == "simulation"
    assert data["port"] == "SIMULATOR"
    assert data["sensor_health"] == "healthy"

def test_latest_reading_when_empty(client):
    res = client.get("/api/readings/latest")
    assert res.status_code == 404
    data = res.get_json()
    assert "error" in data

def test_ports_endpoint(client):
    res = client.get("/api/ports")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "ports" in data
