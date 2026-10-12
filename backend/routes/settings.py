from flask import Blueprint, jsonify, request, current_app
from config import Config

settings_bp = Blueprint("settings", __name__)

@settings_bp.route("/settings", methods=["GET"])
def get_settings():
    parking_service = current_app.config["PARKING_SERVICE"]
    settings_dict = parking_service.settings.to_dict()
    settings_dict["success"] = True
    settings_dict["active_port"] = parking_service.serial_manager.port
    settings_dict["active_baud"] = parking_service.serial_manager.baud_rate
    return jsonify(settings_dict), 200

@settings_bp.route("/settings", methods=["PATCH"])
def update_settings():
    parking_service = current_app.config["PARKING_SERVICE"]
    data = request.get_json(silent=True) or {}
    source = data.get("source") or request.args.get("source") or request.args.get("mode") or "hardware"

    updated_fields = {}

    # Threshold update
    if "threshold_cm" in data:
        try:
            val = float(data["threshold_cm"])
        except (ValueError, TypeError):
            return jsonify({"error": "threshold_cm must be a valid number"}), 400

        if not (Config.MIN_THRESHOLD_CM <= val <= Config.MAX_THRESHOLD_CM):
            return jsonify({
                "error": f"threshold_cm must be between {Config.MIN_THRESHOLD_CM} and {Config.MAX_THRESHOLD_CM} cm"
            }), 400

        ok, msg = parking_service.set_threshold(val, source=source)
        if not ok:
            return jsonify({"error": msg}), 400
        updated_fields["threshold_cm"] = val

    # Mode update
    if "mode" in data:
        mode_val = str(data["mode"]).upper()
        if mode_val not in ("AUTO", "MANUAL"):
            return jsonify({"error": "mode must be 'AUTO' or 'MANUAL'"}), 400
        ok, msg = parking_service.set_mode(mode_val, source=source)
        if not ok:
            return jsonify({"error": msg}), 400
        updated_fields["mode"] = mode_val

    # Port update
    if "port" in data:
        new_port = str(data["port"]).strip()
        new_baud = int(data.get("baud_rate", parking_service.serial_manager.baud_rate))
        parking_service.serial_manager.update_port(new_port, new_baud)
        updated_fields["port"] = new_port
        updated_fields["baud_rate"] = new_baud

    # Simulation enabled toggle
    if "simulation_enabled" in data:
        sim_en = bool(data["simulation_enabled"])
        parking_service.settings.simulation_enabled = sim_en
        if sim_en:
            parking_service.simulation_service.start()
        else:
            parking_service.simulation_service.stop()
        updated_fields["simulation_enabled"] = sim_en

    if not updated_fields:
        return jsonify({"error": "No valid configuration fields provided"}), 400

    return jsonify({
        "success": True,
        **updated_fields,
    }), 200
