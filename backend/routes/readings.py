from flask import Blueprint, jsonify, request, current_app

readings_bp = Blueprint("readings", __name__)

@readings_bp.route("/readings/latest", methods=["GET"])
def get_latest_reading():
    parking_service = current_app.config["PARKING_SERVICE"]
    source = request.args.get("source") or request.args.get("mode") or "hardware"
    reading = parking_service.get_latest_reading(source_mode=source)
    if not reading:
        return jsonify({
            "error": "No sensor readings available",
            "message": "Device has not recorded any readings yet."
        }), 404
    return jsonify(reading), 200

@readings_bp.route("/readings", methods=["GET"])
def get_readings():
    parking_service = current_app.config["PARKING_SERVICE"]
    try:
        from_ts = int(request.args.get("from")) if request.args.get("from") else None
    except ValueError:
        return jsonify({"error": "Invalid 'from' timestamp"}), 400

    try:
        to_ts = int(request.args.get("to")) if request.args.get("to") else None
    except ValueError:
        return jsonify({"error": "Invalid 'to' timestamp"}), 400

    try:
        limit = int(request.args.get("limit", 100))
    except ValueError:
        limit = 100

    source = request.args.get("source") or request.args.get("mode")
    readings = parking_service.get_readings(from_ts=from_ts, to_ts=to_ts, limit=limit, source=source)
    return jsonify(readings), 200
