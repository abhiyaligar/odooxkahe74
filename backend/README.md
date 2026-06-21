# AutoCrafERP Backend API

Welcome to the backend system of **AutoCrafERP**, a lightweight, modern, and extensible Enterprise Resource Planning (ERP) platform built with **FastAPI** and **PostgreSQL**.

---

## 💻 Tech Stack & Architecture

- **Web Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12+)
- **Database ORM**: [SQLAlchemy 2.0](https://www.sqlalchemy.org/) (AsyncIO enabled)
- **Database Engine**: [PostgreSQL](https://www.postgresql.org/) with `asyncpg` driver
- **Migration Tool**: [Alembic](https://alembic.otrablas.org/)
- **Data Validation**: [Pydantic v2](https://docs.pydantic.dev/) (strict typing and data sanitization)
- **Authentication**: JWT-based OAuth2 with Role-Based Access Control (RBAC)
- **Email Service**: Async SMTP Integration (for email verification and password resets)
- **In-Memory Caching**: Redis-ready structures

For detailed architectural layout, flowcharts, and E-R diagrams, refer to [ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 🚀 Setup & Installation

### 1. Prerequisites
- Python 3.12+ Installed
- PostgreSQL Running Instance

### 2. Quickstart
1.  **Clone the repository and navigate to the backend folder**:
    ```bash
    cd backend
    ```
2.  **Create a virtual environment**:
    - Windows:
      ```bash
      python -m venv venv
      venv\Scripts\activate
      ```
    - macOS/Linux:
      ```bash
      python3 -m venv venv
      source venv/bin/activate
      ```
3.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
4.  **Configure Environment Variables**:
    Create a `.env` file based on `.env.example` containing your database connection string and SMTP/Email server configurations.
5.  **Run migrations**:
    ```bash
    alembic upgrade head
    ```
6.  **Run the local development server**:
    ```bash
    uvicorn app.main:app --reload
    ```
    The API docs will be live at `http://127.0.0.1:8000/docs`.

---

## 🛠️ Validation, Safeguards & Workflows

- **Phone Number Normalization**: Automatically prepends `+91` to 10-digit phone numbers and enforces standard phone formats.
- **UUID Validation Guard**: Detects and translates legacy frontend identifiers (e.g. `wc1`, `wc2`, `wc3`) into corresponding static UUIDs to prevent validation errors at API boundaries.
- **Double-Entry Stock Ledger**: Tracks every stock movement in a ledger history for full auditability.
- **Circular Dependency Prevention**: Prevents infinite loops in recipes (BOMs) by detecting and blocking cyclic relations using a DFS check.
- **Atomic Stock Commitments**: Order confirmations and inventory reductions are wrapped in secure transactions to ensure database consistency.

---

## 🧪 Testing

To run the automated test suite (92 tests covering all modules including Auth, Sales, Purchase, Manufacturing, Recipes, and RBAC):
```bash
pytest
```

For a detailed step-by-step manual testing guide with payload schemas, error loop validation scenarios, and API examples, refer to [MANUAL_TESTING.md](docs/MANUAL_TESTING.md).
