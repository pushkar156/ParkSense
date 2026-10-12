import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend directory or project root if present
backend_dir = Path(__file__).resolve().parent
load_dotenv(backend_dir / ".env")
load_dotenv(backend_dir.parent / ".env")

class Config:
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = FLASK_ENV == "development"
    HOST = os.getenv("HOST", "127.0.0.1")
    PORT = int(os.getenv("PORT", "5000"))

    # Serial port configuration
    ARDUINO_PORT = os.getenv("ARDUINO_PORT", "COM3")
    ARDUINO_BAUD = int(os.getenv("ARDUINO_BAUD", "9600"))

    # Database
    db_env = os.getenv("DB_PATH", "parksense.db")
    if os.path.isabs(db_env):
        DB_PATH = Path(db_env)
    else:
        DB_PATH = backend_dir / db_env

    # CORS
    cors_raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
    )
    CORS_ORIGINS = [origin.strip() for origin in cors_raw.split(",") if origin.strip()]

    # Simulation mode
    SIMULATION_ENABLED = os.getenv("SIMULATION_ENABLED", "false").lower() in ("true", "1", "yes")

    # Timeouts and thresholds
    STALE_THRESHOLD_SECONDS = float(os.getenv("STALE_THRESHOLD_SECONDS", "3.5"))
    MIN_THRESHOLD_CM = 5.0
    MAX_THRESHOLD_CM = 100.0
    DEFAULT_THRESHOLD_CM = 15.0
