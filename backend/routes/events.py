from flask import Blueprint, jsonify, request, current_app

events_bp = Blueprint("events", __name__)

@events_bp.route("/events", methods=["GET"])
def get_events():
    parking_service = current_app.config["PARKING_SERVICE"]
    event_type = request.args.get("type")

    try:
        from_ts = int(request.args.get("from")) if request.args.get("from") else None
    except ValueError:
        return jsonify({"error": "Invalid 'from' timestamp"}), 400

    try:
        to_ts = int(request.args.get("to")) if request.args.get("to") else None
    except ValueError:
        return jsonify({"error": "Invalid 'to' timestamp"}), 400

    try:
        page = int(request.args.get("page", 1))
    except ValueError:
        page = 1

    try:
        limit = int(request.args.get("limit", 15))
    except ValueError:
        limit = 15

    source = request.args.get("source") or request.args.get("mode")
    result = parking_service.get_events(
        event_type=event_type,
        from_ts=from_ts,
        to_ts=to_ts,
        page=page,
        limit=limit,
        source=source,
    )
    return jsonify(result), 200

@events_bp.route("/events/clear", methods=["POST"])
def clear_events():
    parking_service = current_app.config["PARKING_SERVICE"]
    data = request.get_json(silent=True) or {}
    source = data.get("source") or request.args.get("source") or request.args.get("mode")
    parking_service.clear_events(source=source)
    return jsonify({
        "success": True,
        "message": "Event history cleared successfully"
    }), 200
