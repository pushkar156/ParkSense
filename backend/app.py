import logging
import sys
from pathlib import Path
from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from database import init_db
from routes.status import status_bp
from routes.readings import readings_bp
from routes.analytics import analytics_bp
from routes.events import events_bp
from routes.settings import settings_bp
from routes.commands import commands_bp
from services.parking_service import ParkingService
from services.analytics_service import AnalyticsService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (%(name)s) %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("parksense")

def create_app(test_config=None) -> Flask:
    app = Flask(__name__)

    if test_config:
        app.config.update(test_config)
    else:
        app.config["DB_PATH"] = Config.DB_PATH
        app.config["CORS_ORIGINS"] = Config.CORS_ORIGINS

    # Initialize CORS
    cors_origins = app.config.get("CORS_ORIGINS", ["*"])
    CORS(
        app,
        resources={r"/api/*": {"origins": cors_origins}},
        methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "Accept"],
    )

    # Initialize Database
    db_path = app.config.get("DB_PATH", Config.DB_PATH)
    init_db(db_path)

    # Instantiate Services
    parking_service = ParkingService(db_path=db_path)
    analytics_service = AnalyticsService(db_path=db_path)

    app.config["PARKING_SERVICE"] = parking_service
    app.config["ANALYTICS_SERVICE"] = analytics_service

    # Register Blueprints
    app.register_blueprint(status_bp, url_prefix="/api")
    app.register_blueprint(readings_bp, url_prefix="/api")
    app.register_blueprint(analytics_bp, url_prefix="/api")
    app.register_blueprint(events_bp, url_prefix="/api")
    app.register_blueprint(settings_bp, url_prefix="/api")
    app.register_blueprint(commands_bp, url_prefix="/api")

    # Global Error Handlers
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Bad request", "details": str(e)}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Endpoint not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def internal_error(e):
        logger.error(f"Internal server error: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500

    return app

if __name__ == "__main__":
    app = create_app()
    parking_service = app.config["PARKING_SERVICE"]
    parking_service.start_services()

    logger.info(f"Starting ParkSense API on http://{Config.HOST}:{Config.PORT}")
    try:
        app.run(
            host=Config.HOST,
            port=Config.PORT,
            debug=Config.DEBUG,
            use_reloader=False,  # Prevent double-starting threads in dev
        )
    finally:
        parking_service.stop_services()
