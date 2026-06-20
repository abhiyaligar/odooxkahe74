# Setup & Development Guide: Mini ERP

This guide explains how to initialize and run the Mini ERP project locally using Docker Compose, which is the recommended way to handle the multi-container architecture.

## 1. Prerequisites
- **Docker** and **Docker Compose** installed on your machine.
- **Node.js** (v18+) (if you prefer to run the frontend locally outside of Docker for faster HMR).
- **Python** (3.10+) (if you prefer to run the backend locally outside of Docker for debugging).

---

## 2. Running the Full Stack via Docker Compose (Recommended)

To spin up the entire ecosystem (PostgreSQL, MongoDB, Redis, FastAPI, Celery, and React):

1. **Navigate to the project root:**
   Ensure you are in the directory containing `docker-compose.yml`.
2. **Create Environment Files:**
   Create a `.env` file in the root based on `.env.example` (or define standard variables):
   ```env
   DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/minierp
   MONGO_URI=mongodb://mongo:27017/minierp_audit
   REDIS_URL=redis://redis:6379/0
   SECRET_KEY=your_super_secret_jwt_key
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   ```
3. **Build and Start:**
   ```bash
   docker-compose up --build
   ```
   
**Services Available:**
- **Frontend App**: http://localhost:5173
- **Backend API & Docs**: http://localhost:8000/docs
- **PostgreSQL**: `localhost:5432`
- **MongoDB**: `localhost:27017`
- **Redis**: `localhost:6379`

---

## 3. Manual Local Setup (Alternative)

If you prefer to run the services bare-metal (without Docker for the app code):

### Backend (FastAPI + Celery)
1. Navigate to `/backend`.
2. `python -m venv venv`
3. `source venv/bin/activate` (or `venv\Scripts\activate` on Windows)
4. `pip install -r requirements.txt`
5. Run migrations: `alembic upgrade head`
6. Start API: `uvicorn app.main:app --reload`
7. Start Celery Worker (requires a running Redis instance): 
   `celery -A app.core.celery_app worker --loglevel=info`

### Frontend (React + Vite)
1. Navigate to `/frontend`.
2. `npm install`
3. Start dev server: `npm run dev`

---

## 4. Database Migrations
Whenever you update a SQLAlchemy model in `app/models/pg_models.py`:
1. Generate migration:
   ```bash
   alembic revision --autogenerate -m "Add new feature"
   ```
2. Apply migration:
   ```bash
   alembic upgrade head
   ```
*(If using Docker Compose, you may need to execute these commands inside the `backend` container).*

---

## 5. Running Tests

The backend includes a comprehensive suite of unit and integration tests using Pytest. The tests run against an in-memory SQLite database (`aiosqlite`), isolating test runs from development and production environments.

### Running Backend Tests
1. Navigate to the `/backend` directory.
2. Ensure you have activated your virtual environment.
3. Run the following command:

#### Windows (PowerShell)
```powershell
.\venv\Scripts\pytest
```

#### Windows (Command Prompt)
```cmd
venv\Scripts\pytest
```

#### macOS / Linux
```bash
./venv/bin/pytest
```

### Pytest Configuration
The pytest environment is configured via `pytest.ini` in the `backend` root. It sets:
- **`asyncio_mode = auto`**: Automatically runs async test functions using the `pytest-asyncio` plugin.
- **`testpaths = tests`**: Looks for tests inside the `tests` directory.

