# Technical Architecture: Mini ERP

## 1. System Overview
The Mini ERP is a web-based client-server application utilizing a modern, fully asynchronous, decoupled architecture. It relies heavily on background workers for complex automation to maintain a snappy user experience.

## 2. High-Level Architecture Diagram
```text
[ Client (Browser / React) ]
            │
            │ REST API (JSON)
            ▼
[ Backend (FastAPI App) ] ──(Queues Tasks)──> [ Redis (Message Broker) ]
  │           │                                       │
  │ (SQL)     │ (NoSQL)                               ▼
  ▼           ▼                             [ Celery Workers ]
[ PostgreSQL] [ MongoDB ]                             │
(Primary DB)  (Audit Log)                             │
  ▲                                                   │
  └──────────────────(Executes Tasks)─────────────────┘
```

## 3. Component Interaction
1. **Frontend (React + React Query)**: Communicates with the backend. Caches responses locally and performs optimistic UI updates for instantaneous user feedback.
2. **Backend (FastAPI)**: Serves endpoints. Validates data with Pydantic. Directly handles synchronous CRUD.
3. **Task Queue (Redis + Celery)**: FastAPI delegates the "Procurement Automation" algorithm to Celery. Celery workers pick up the task from Redis, compute the required supply chain actions, and write the resulting auto-generated POs/MOs back to PostgreSQL.
4. **Databases**: 
   - **PostgreSQL**: Strict schema for business entities and stock ledger.
   - **MongoDB**: Append-only log for system events and entity changes.

## 4. Procurement Automation Flow (Updated)
- User confirms a `SalesOrder` via the React frontend.
- FastAPI validates and updates the DB synchronously, reserving available stock.
- FastAPI detects a shortage and dispatches a background task: `trigger_procurement.delay(product_id, shortage_qty)`.
- FastAPI returns `200 OK` to the frontend immediately.
- A Celery worker picks up the task from Redis, calculates the necessary auto-generated `PurchaseOrder` or `ManufacturingOrder`, and persists it to PostgreSQL.

## 5. Containerized Infrastructure
The entire local development and production environment is managed via Docker.
- **Docker Compose** spins up 6 containers:
  1. Frontend (Vite dev server or Nginx)
  2. Backend (FastAPI Uvicorn)
  3. Celery Worker
  4. PostgreSQL
  5. MongoDB
  6. Redis
