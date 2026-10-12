import os
import sys
from pathlib import Path
import pytest

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app import create_app

@pytest.fixture
def app(tmp_path):
    test_db = tmp_path / "test_parksense.db"
    test_config = {
        "TESTING": True,
        "DB_PATH": test_db,
        "CORS_ORIGINS": ["http://localhost:3000"],
    }
    app = create_app(test_config=test_config)
    yield app

    # Cleanup services
    if "PARKING_SERVICE" in app.config:
        app.config["PARKING_SERVICE"].stop_services()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def parking_service(app):
    return app.config["PARKING_SERVICE"]

@pytest.fixture
def analytics_service(app):
    return app.config["ANALYTICS_SERVICE"]
