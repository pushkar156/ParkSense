# ParkSense — Backend Architecture & Service Documentation

Python Flask hardware gateway, SQLite persistence, and REST API service for the ParkSense Smart Parking IoT System.

## Architecture

```
backend/
├── app.py                     # Flask application factory, routes registration & error handling
├── config.py                  # Environment-driven configuration
├── database.py                # SQLite schema creation & WAL-mode connections
├── models.py                  # Domain models (Reading, Event, Settings)
├── requirements.txt           # Python dependencies
├── .env.example               # Template environment configuration
├── routes/
│   ├── status.py              # GET /api/status, GET /api/health, GET /api/ports
│   ├── readings.py            # GET /api/readings/latest, GET /api/readings
│   ├── analytics.py           # GET /api/analytics
│   ├── events.py              # GET /api/events, POST /api/events/clear
│   ├── settings.py            # GET /api/settings, PATCH /api/settings
│   └── commands.py            # POST /api/commands/mode, /led, /reset, /simulation
├── services/
│   ├── serial_manager.py      # Thread-safe USB serial reader, whitelist validator & auto-reconnect
│   ├── simulation_service.py  # Realistic vehicle physics simulator (VACANT -> APPROACHING -> PARKED -> DEPARTING)
│   ├── parking_service.py     # State coordinator, transition event emitter & persistence
│   └── analytics_service.py   # Statistical aggregation over stored readings and events
└── tests/
    ├── conftest.py            # Isolated test database fixture
    ├── test_api.py            # Baseline endpoint tests
    ├── test_analytics.py      # Aggregation, duration & event deduplication tests
    └── test_validation.py     # Parameter validation & bounds checking
```

## Quick Start (PowerShell)

```powershell
# 1. Navigate to backend directory
cd backend

# 2. Create virtual environment
python -m venv .venv

# 3. Activate virtual environment
.\.venv\Scripts\Activate.ps1

# 4. Install dependencies
pip install -r requirements.txt

# 5. Run automated test suite
pytest tests/ -v

# 6. Start backend server
python app.py
```

API is served on `http://127.0.0.1:5000/api`.
