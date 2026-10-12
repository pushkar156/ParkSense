import time
from flask import Blueprint, jsonify, request, current_app

status_bp = Blueprint("status", __name__)

@status_bp.route("/health", methods=["GET"])
def health():
    parking_service = current_app.config["PARKING_SERVICE"]
    hw_state = parking_service.serial_manager.get_state()
    return jsonify({
        "status": "healthy",
        "hardware_connected": bool(hw_state["connected"] and not hw_state["is_stale"]),
        "database": "connected",
        "simulation_running": parking_service.simulation_service.is_running(),
        "timestamp": int(time.time() * 1000),
    }), 200

@status_bp.route("/status", methods=["GET"])
def get_status():
    parking_service = current_app.config["PARKING_SERVICE"]
    source_mode = request.args.get("mode") or request.args.get("source") or "hardware"
    data = parking_service.get_status(source_mode=source_mode)
    data["success"] = True
    return jsonify(data), 200

@status_bp.route("/ports", methods=["GET"])
def list_ports():
    parking_service = current_app.config["PARKING_SERVICE"]
    ports = parking_service.serial_manager.list_available_ports()
    return jsonify({
        "success": True,
        "ports": ports,
        "active_port": parking_service.serial_manager.port,
        "active_baud": parking_service.serial_manager.baud_rate,
    }), 200
