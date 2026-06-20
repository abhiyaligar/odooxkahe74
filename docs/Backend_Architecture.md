# Backend Architecture: Mini ERP

## 1. Technology Stack
- **Framework**: FastAPI (Python 3.10+) for high-performance, async RESTful APIs.
- **Primary Database**: PostgreSQL (for structured transactional data).
- **Secondary Database**: MongoDB (for unstructured data, primarily Audit Logs).
- **Message Broker & Cache**: Redis (for background task queues).
- **Background Workers**: Celery (to offload heavy operations like Procurement Automation).
- **ORM & Drivers**: 
  - PostgreSQL: SQLAlchemy (async) with `asyncpg`.
  - MongoDB: `Motor` (async MongoDB driver) or `Beanie` (async ODM).
- **DB Migration**: Alembic (for PostgreSQL schema migrations).
- **Data Validation**: Pydantic v2.
- **Authentication**: JWT (JSON Web Tokens) with Passlib (Bcrypt) for password hashing.

## 2. Directory Structure

```text
app/
├── api/             # API Routers (Endpoints)
│   ├── v1/
│   │   ├── auth.py
│   │   ├── products.py
│   │   ├── sales.py
│   │   └── ...
│   └── dependencies.py # FastAPI dependencies (e.g., get_db, get_current_user)
├── core/            # Core configurations
│   ├── config.py    # Environment variables
│   ├── security.py  # Hashing and JWT logic
│   └── celery_app.py# Celery instance and configuration
├── db/              # Database setups
│   ├── session.py   # Async PostgreSQL and MongoDB connection setup
│   └── base.py      # SQLAlchemy Base
├── models/          # SQLAlchemy and MongoDB models
│   ├── pg_models.py # PostgreSQL models (User, Product, SalesOrder, etc.)
│   └── mongo_models.py # MongoDB models (AuditLog)
├── schemas/         # Pydantic schemas for Request/Response validation
├── services/        # Sync/Async Business logic layer
│   ├── inventory.py # Stock movement logic
│   └── audit.py     # Writing to MongoDB audit logs
├── tasks/           # Celery background tasks
│   └── procurement_tasks.py # Async automation logic
├── main.py          # FastAPI application instance
└── alembic/         # Alembic migration scripts
```

## 3. Core Principles
1. **Asynchronous Execution**: Utilize `async/await` end-to-end (from FastAPI routes to database drivers like `asyncpg` and `motor`) to handle high concurrency.
2. **Background Automation**: Operations that take time or trigger cascading changes (like Procurement Automation generating multiple nested POs/MOs) are handed off to Celery workers via Redis to ensure the main API remains perfectly responsive.
3. **Database Transactions**: Any operation involving stock movement (e.g., Manufacturing Order Completion) MUST be wrapped in an async database transaction.
4. **Hybrid Database Approach**: PostgreSQL handles the rigid relational demands (Orders, Inventory), while MongoDB handles the flexible document needs (AuditLogs where old/new value shapes vary drastically).
