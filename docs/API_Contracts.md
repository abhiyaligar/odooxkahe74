# API Contracts: Mini ERP

This document outlines the core REST API endpoints that the React frontend consumes from the FastAPI backend. It reflects the exact paths, HTTP methods, and payload structures implemented in the backend codebase.

---

## 1. Authentication (`/api/v1/auth`)

### Sign Up
- **`POST /api/v1/auth/signup`**
  - **Request Body (JSON):**
    ```json
    {
      "name": "Abhishek",
      "email": "abhijyaligar@gmail.com",
      "password": "securepassword123",
      "role": "SalesUser"
    }
    ```
  - **Response (JSON - `201 Created`):**
    ```json
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Abhishek",
      "email": "abhijyaligar@gmail.com",
      "role": "SalesUser",
      "is_active": true,
      "created_at": "2026-06-20T14:29:00"
    }
    ```

### Log In (OAuth2 Standard Form-Data)
- **`POST /api/v1/auth/login`**
  - **Request Body (multipart/form-data):**
    - `username`: Email of the user (e.g. `abhijyaligar@gmail.com`)
    - `password`: Password (automatically truncated at 72 bytes to prevent bcrypt limits)
  - **Response (JSON - `200 OK`):**
    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "bearer"
    }
    ```

---

## 2. Products & Inventory (`/api/v1/products`)

### List Products
- **`GET /api/v1/products/`**
  - **Query Params:** `skip` (default 0), `limit` (default 100)
  - **Response (JSON - `200 OK`):**
    ```json
    [
      {
        "id": "d0be22f7-e438-4e80-8777-160fa47c7c34",
        "name": "Finished Good Chair",
        "type": "FinishedGood",
        "sales_price": 120.0,
        "cost_price": 70.0,
        "on_hand_qty": 50.0,
        "reserved_qty": 10.0,
        "free_to_use_qty": 40.0,
        "procurement_strategy": "MTS",
        "procure_on_demand": false,
        "procurement_type": null,
        "vendor_id": null,
        "bom_id": null,
        "created_at": "2026-06-20T14:00:00",
        "updated_at": "2026-06-20T14:00:00"
      }
    ]
    ```

### Create Product
- **`POST /api/v1/products/`**
  - **Request Body (JSON):**
    ```json
    {
      "name": "Finished Good Table",
      "type": "FinishedGood",
      "sales_price": 250.0,
      "cost_price": 150.0,
      "procurement_strategy": "MTO",
      "procure_on_demand": true,
      "procurement_type": "Manufacturing",
      "bom_id": "8e36780c-e277-4933-9114-1e0e8549e5d1"
    }
    ```
  - **Response (JSON - `201 Created`):** Returns the created product with `free_to_use_qty` calculated.
  - **Business Rules:**
    - If `procurement_type = "Purchase"`, `vendor_id` must be provided.
    - If `procurement_type = "Manufacturing"`, `bom_id` must be provided.

### Get Single Product
- **`GET /api/v1/products/{product_id}`**
  - **Response (JSON - `200 OK`):** Product object with computed `free_to_use_qty`.

### Update Product
- **`PUT /api/v1/products/{product_id}`**
  - **Request Body (JSON):** Partial fields to update.
  - **Response (JSON - `200 OK`):** Updated product object.
  - **Business Rules:** Validates that procurement type rules are satisfied if updated.

### Delete Product
- **`DELETE /api/v1/products/{product_id}`**
  - **Response (`204 No Content`)**

---

## 3. Sales Orders (`/api/v1/sales-orders`)

### Create Sales Order
- **`POST /api/v1/sales-orders/`**
  - **Request Body (JSON):**
    ```json
    {
      "customer_id": "97e685f4-3453-4876-b9cf-2b0e8c76fa96",
      "expected_delivery_date": "2026-06-30T12:00:00",
      "lines": [
        {
          "product_id": "d0be22f7-e438-4e80-8777-160fa47c7c34",
          "quantity_ordered": 5.0
        }
      ]
    }
    ```
  - **Response (JSON - `201 Created`):**
    ```json
    {
      "id": "e81d771b-d1e9-4e32-9df7-285642a8b274",
      "customer_id": "97e685f4-3453-4876-b9cf-2b0e8c76fa96",
      "expected_delivery_date": "2026-06-30T12:00:00",
      "order_number": "SO-A4D8E2B5",
      "status": "Draft",
      "created_by": "8f8c7b8e-3c2b-4d5e-9e7f-b2b5a1c3d5e7",
      "created_at": "2026-06-20T14:29:00",
      "confirmed_at": null,
      "delivered_at": null
    }
    ```
  - **Business Rules:** Unit prices for lines are automatically snapshotted from the Product master's `sales_price` at the moment of creation.

### List Sales Orders
- **`GET /api/v1/sales-orders/`**
  - **Response (JSON - `200 OK`):** List of Sales Orders.

### Confirm Sales Order
- **`POST /api/v1/sales-orders/{order_id}/confirm`**
  - **Response (JSON - `200 OK`):** `{"message": "Order confirmed and stock reserved."}`
  - **Business Rules:**
    - Changes status from `Draft` to `Confirmed`.
    - Increments the `reserved_qty` on each product in the order lines by `quantity_ordered`.
    - Returns HTTP 400 if order status is not `Draft`.

### Deliver Sales Order
- **`POST /api/v1/sales-orders/{order_id}/deliver`**
  - **Response (JSON - `200 OK`):** `{"message": "Order delivered and stock ledger updated."}`
  - **Business Rules:**
    - Changes status from `Confirmed` to `FullyDelivered` and sets `delivered_at`.
    - Decrements `reserved_qty` and `on_hand_qty` on each product in the order lines by `quantity_ordered`.
    - Automatically adds a `StockLedgerEntry` record in the database tracking the change (e.g. negative quantity change with reason `SaleDelivery`).
    - Returns HTTP 400 if order status is not `Confirmed`.

---

## 4. Bills of Materials (BoM) & Recipes (`/api/v1/boms` & `/api/v1/recipes`)

These routers operate on the same recipe tables. The `/api/v1/recipes` route restricts write access (`POST`, `PUT`, `DELETE`) to `SuperAdmin` and `StoreAdmin` roles.

### Create Recipe (or BoM)
- **`POST /api/v1/recipes/`** or **`POST /api/v1/boms/`**
  - **Request Body (JSON):**
    ```json
    {
      "product_id": "d0be22f7-e438-4e80-8777-160fa47c7c34",
      "name": "Cabinet Recipe",
      "version": "1.0",
      "lines": [
        {
          "component_product_id": "8f8c7b8e-3c2b-4d5e-9e7f-b2b5a1c3d5e7",
          "quantity_required": 8.0
        }
      ]
    }
    ```
  - **Response (JSON - `201 Created`):** Returns the created recipe with lines. Runs circular validation checks.

### List and Filter Recipes
- **`GET /api/v1/recipes/`** or **`GET /api/v1/boms/`**
  - Optional Query Parameter: `product_id`

### Update Recipe
- **`PUT /api/v1/recipes/{recipe_id}`** or **`PUT /api/v1/boms/{bom_id}`**
  - Update fields and component arrays.

### Delete Recipe
- **`DELETE /api/v1/recipes/{recipe_id}`** or **`DELETE /api/v1/boms/{bom_id}`**
  - **Response (`204 No Content`)**
  - **Business Rules:** Blocks deletion if referenced by active (Draft / InProgress) Manufacturing Orders.

---

## 5. Manufacturing Orders (`/api/v1/manufacturing-orders`)

### Create Manufacturing Order
- **`POST /api/v1/manufacturing-orders/`**
  - **Request Body (JSON):**
    ```json
    {
      "product_id": "d0be22f7-e438-4e80-8777-160fa47c7c34",
      "bom_id": "8e36780c-e277-4933-9114-1e0e8549e5d1",
      "quantity_to_produce": 10.0
    }
    ```
  - **Response (JSON - `201 Created`):** Returns the Draft MO. Automatically generates child `WorkOrder` steps based on BoM operations.

### Confirm Manufacturing Order
- **`POST /api/v1/manufacturing-orders/{mo_id}/confirm`**
  - **Business Rules:** Checks component stocks. Reserves quantities using non-blocking SQL. Triggers procurement if shortage exists and `procure_on_demand` is active.

### Start Production Run
- **`POST /api/v1/manufacturing-orders/{mo_id}/start`**
  - Transitions MO status to `InProgress`.

### Update Work Order Status
- **`POST /api/v1/manufacturing-orders/{mo_id}/work-orders/{wo_id}/start`**
- **`POST /api/v1/manufacturing-orders/{mo_id}/work-orders/{wo_id}/complete`**
  - **Business Rules:** Enforces sequence constraints. Previous steps must be `Done` before next step can start.

### Complete Manufacturing Order
- **`POST /api/v1/manufacturing-orders/{mo_id}/complete`**
  - **Business Rules:** Asserts all work orders are completed. Deducts component stocks, increments finished goods stock, and writes Stock Ledger entries in a single transaction.

---

## 6. Purchase Orders (`/api/v1/purchase-orders` - Integrations)

Auto-replenishment automatically inserts draft Purchase Orders with `source = "AutoGenerated"` when raw material shortages are triggered.
- **`GET /api/v1/purchase-orders`** -> Lists all POs.
- **`POST /api/v1/purchase-orders`** -> Create a PO.

