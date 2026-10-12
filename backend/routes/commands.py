from flask import Blueprint, jsonify, request, current_app

commands_bp = Blueprint("commands", __name__)

@commands_bp.route("/commands/mode", methods=["POST"])
def set_mode():
    parking_service = current_app.config["PARKING_SERVICE"]
    data = request.get_json(silent=True) or {}
    new_mode = str(data.get("mode", "")).upper()
    source = data.get("source") or request.args.get("source") or request.args.get("mode") or "hardware"

    if new_mode not in ("AUTO", "MANUAL"):
        return jsonify({"error": "Invalid operating mode. Allowed values: AUTO, MANUAL"}), 400

    ok, msg = parking_service.set_mode(new_mode, source=source)
    if not ok:
        return jsonify({"error": msg}), 400

    return jsonify({
        "success": True,
        "mode": new_mode,
        "message": msg,
    }), 200

@commands_bp.route("/commands/led", methods=["POST"])
def set_led():
    parking_service = current_app.config["PARKING_SERVICE"]
    data = request.get_json(silent=True) or {}

    # Support color/state or led/state
    color = str(data.get("color") or data.get("led") or "").upper()
    state = str(data.get("state") or "").upper()
    source = data.get("source") or request.args.get("source") or request.args.get("mode") or "hardware"

    if color not in ("RED", "GREEN"):
        return jsonify({"error": "Invalid LED color. Choose RED or GREEN"}), 400
    if state not in ("ON", "OFF"):
        return jsonify({"error": "Invalid LED state. Choose ON or OFF"}), 400

    ok, msg = parking_service.set_led(color, state, source=source)
    if not ok:
        return jsonify({"error": msg}), 400

    return jsonify({
        "success": True,
        "color": color,
        "state": state,
        "message": msg,
    }), 200

@commands_bp.route("/commands/reset", methods=["POST"])
def reset():
    parking_service = current_app.config["PARKING_SERVICE"]
    data = request.get_json(silent=True) or {}
    source = data.get("source") or request.args.get("source") or request.args.get("mode") or "hardware"

    ok, msg = parking_service.reset_device(source=source)
    return jsonify({
        "success": ok,
        "message": msg,
    }), 200

@commands_bp.route("/commands/simulation", methods=["POST"])
def control_simulation():
    parking_service = current_app.config["PARKING_SERVICE"]
    data = request.get_json(silent=True) or {}
    action = data.get("action", "").lower()

    if action == "start":
        parking_service.simulation_service.start()
        return jsonify({"success": True, "message": "Simulation started"}), 200
    elif action == "stop":
        parking_service.simulation_service.stop()
        return jsonify({"success": True, "message": "Simulation stopped"}), 200
    elif action == "arrival":
        parking_service.simulation_service.trigger_arrival()
        return jsonify({"success": True, "message": "Simulated vehicle arrival triggered"}), 200
    elif action == "departure":
        parking_service.simulation_service.trigger_departure()
        return jsonify({"success": True, "message": "Simulated vehicle departure triggered"}), 200
    elif action == "distance":
        try:
            val = float(data.get("value", 180.0))
            parking_service.simulation_service.set_manual_distance(val)
            return jsonify({"success": True, "distance_cm": val}), 200
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid distance value"}), 400
    elif action == "step":
        reading = parking_service.simulation_service.step()
        return jsonify({"success": True, "reading": reading}), 200
    else:
        return jsonify({"error": f"Unknown simulation action: '{action}'"}), 400
