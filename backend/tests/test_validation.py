import pytest

def test_valid_settings_update(client):
    res = client.patch("/api/settings?mode=simulation", json={"threshold_cm": 25.5})
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["threshold_cm"] == 25.5

    # Check that settings persisted
    res_get = client.get("/api/settings")
    assert res_get.status_code == 200
    assert res_get.get_json()["threshold_cm"] == 25.5

def test_invalid_settings_threshold_out_of_range(client):
    # Too small (< 5 cm)
    res_low = client.patch("/api/settings", json={"threshold_cm": 2.0})
    assert res_low.status_code == 400
    assert "threshold_cm must be between" in res_low.get_json()["error"]

    # Too high (> 100 cm)
    res_high = client.patch("/api/settings", json={"threshold_cm": 150.0})
    assert res_high.status_code == 400
    assert "threshold_cm must be between" in res_high.get_json()["error"]

def test_invalid_settings_non_numeric_threshold(client):
    res = client.patch("/api/settings", json={"threshold_cm": "invalid_number"})
    assert res.status_code == 400
    assert "threshold_cm must be a valid number" in res.get_json()["error"]

def test_invalid_mode_rejection(client):
    res = client.post("/api/commands/mode", json={"mode": "TURBO"})
    assert res.status_code == 400
    assert "Invalid operating mode" in res.get_json()["error"]

def test_valid_mode_switch(client):
    res = client.post("/api/commands/mode?mode=simulation", json={"mode": "MANUAL"})
    assert res.status_code == 200
    assert res.get_json()["mode"] == "MANUAL"

def test_invalid_led_command_in_auto_mode(client):
    # In AUTO mode, manual LED command must be rejected
    client.post("/api/commands/mode?mode=simulation", json={"mode": "AUTO"})
    res = client.post("/api/commands/led?mode=simulation", json={"color": "RED", "state": "ON"})
    assert res.status_code == 400
    assert "Cannot control LEDs in AUTO mode" in res.get_json()["error"]

def test_invalid_led_parameters(client):
    # Switch to MANUAL first
    client.post("/api/commands/mode?mode=simulation", json={"mode": "MANUAL"})

    # Invalid color
    res_col = client.post("/api/commands/led?mode=simulation", json={"color": "BLUE", "state": "ON"})
    assert res_col.status_code == 400

    # Invalid state
    res_state = client.post("/api/commands/led?mode=simulation", json={"color": "RED", "state": "BLINK"})
    assert res_state.status_code == 400

def test_valid_led_command_in_manual_mode(client):
    client.post("/api/commands/mode?mode=simulation", json={"mode": "MANUAL"})
    res = client.post("/api/commands/led?mode=simulation", json={"color": "RED", "state": "ON"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["color"] == "RED"
    assert data["state"] == "ON"

def test_reset_command(client):
    # Change threshold to 40
    client.patch("/api/settings?mode=simulation", json={"threshold_cm": 40.0})
    # Issue reset
    res = client.post("/api/commands/reset?mode=simulation")
    assert res.status_code == 200

    # Verify settings restored to default 15.0 cm and AUTO
    settings_res = client.get("/api/settings")
    assert settings_res.get_json()["threshold_cm"] == 15.0
    assert settings_res.get_json()["mode"] == "AUTO"
