# API Contracts: Mini ERP

This document outlines the core REST API endpoints that the React frontend will consume from the FastAPI backend.

## 1. Authentication
- **`POST /api/v1/auth/login`**
  - Payload: `{ "email": "admin@store.com", "password": "..." }`
  - Response: `{ "access_token": "jwt...", "token_type": "bearer", "role": "StoreAdmin" }`

## 2. Products & Inventory
- **`GET /api/v1/products`**
  - Query Params: `?type=FinishedGood`
  - Response: `[ { "id": "...", "name": "...", "on_hand_qty": 10, "reserved_qty": 2, "free_to_use_qty": 8, ... } ]`
- **`POST /api/v1/products`**
  - Payload: `{ "name": "...", "type": "FinishedGood", "procurement_strategy": "MTS", ... }`
- **`GET /api/v1/stock-ledger`**
  - Response: `[ { "product_id": "...", "change_qty": -5, "reason": "SaleDelivery", ... } ]`

## 3. Bill of Materials (BoM)
- **`GET /api/v1/boms`**
  - Response: List of BoMs with their products.
- **`GET /api/v1/boms/{id}`**
  - Response: Includes nested `lines` (components) and `operations` (work center steps).
- **`POST /api/v1/boms`**
  - Payload: `{ "product_id": "...", "lines": [...], "operations": [...] }`

## 4. Sales Orders
- **`GET /api/v1/sales-orders`**
- **`POST /api/v1/sales-orders`**
  - Payload: `{ "customer_id": "...", "lines": [ { "product_id": "...", "quantity_ordered": 10 } ] }`
- **`PATCH /api/v1/sales-orders/{id}/confirm`**
  - Action: Confirms the order, reserves stock, and triggers Procurement Automation if there is a shortage.
- **`PATCH /api/v1/sales-orders/{id}/deliver`**
  - Action: Logs delivery, deducts from physical stock, writes to Stock Ledger.

## 5. Purchase Orders
- **`GET /api/v1/purchase-orders`**
- **`POST /api/v1/purchase-orders`**
- **`PATCH /api/v1/purchase-orders/{id}/receive`**
  - Action: Adds to physical stock, writes to Stock Ledger.

## 6. Manufacturing Orders
- **`GET /api/v1/manufacturing-orders`**
- **`POST /api/v1/manufacturing-orders`**
  - Payload: `{ "product_id": "...", "quantity_to_produce": 15 }`
- **`PATCH /api/v1/manufacturing-orders/{id}/work-orders/{wo_id}/status`**
  - Payload: `{ "status": "InProgress" | "Done" }`
- **`PATCH /api/v1/manufacturing-orders/{id}/complete`**
  - Action: Atomically consumes components, produces finished goods, and updates the Ledger.

## 7. Dashboard Metrics
- **`GET /api/v1/dashboard/metrics`**
  - Response: `{ "total_sales_orders": 45, "pending_deliveries": 12, "delayed_orders": 3, "active_manufacturing": 5 }`
