from flask import Blueprint, jsonify, request, current_app

analytics_bp = Blueprint("analytics", __name__)

@analytics_bp.route("/analytics", methods=["GET"])
def get_analytics():
    analytics_service = current_app.config["ANALYTICS_SERVICE"]
    try:
        from_ts = int(request.args.get("from")) if request.args.get("from") else None
    except ValueError:
        return jsonify({"error": "Invalid 'from' timestamp parameter"}), 400

    try:
        to_ts = int(request.args.get("to")) if request.args.get("to") else None
    except ValueError:
        return jsonify({"error": "Invalid 'to' timestamp parameter"}), 400

    source = request.args.get("source") or request.args.get("mode")
    summary = analytics_service.compute_summary(from_ts=from_ts, to_ts=to_ts, source=source)
    return jsonify(summary), 200
