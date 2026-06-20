# Mini ERP API: Comprehensive Manual Testing Guide

This documentation provides a step-by-step walkthrough to manually test all workflows of the **Mini ERP API** using **cURL** or the interactive **Swagger UI** (`http://127.0.0.1:8000/docs`).

---

## 1. Setup & Authentication

Before running any requests, ensure your development server is running:

```bash
.\venv\Scripts\uvicorn app.main:app --reload
```

### A. Signup (Create a User)
All operational endpoints require authentication. Register a user first:
* **Endpoint**: `POST /api/v1/auth/signup`
* **cURL**:
  ```bash
  curl -X POST "http://127.0.0.1:8000/api/v1/auth/signup" \
       -H "Content-Type: application/json" \
       -d "{\"name\": \"ERP Manager\", \"email\": \"manager@example.com\", \"password\": \"securepassword123\", \"role\": \"SuperAdmin\"}"
  ```
* Save the returned `"id"` (User ID).

### B. Login (Get Access Token)
* **Endpoint**: `POST /api/v1/auth/login`
* **cURL** (sent as form-data):
  ```bash
  curl -X POST "http://127.0.0.1:8000/api/v1/auth/login" \
       -F "username=manager@example.com" \
       -F "password=securepassword123"
  ```
* Copy the returned `"access_token"`. Substitute this for `<TOKEN>` in all headers: `Authorization: Bearer <TOKEN>`.

---

## 2. Core ERP Data Setup

### A. Create a Vendor
* **Endpoint**: `POST /api/v1/vendors/`
* **cURL**:
  ```bash
  curl -X POST "http://127.0.0.1:8000/api/v1/vendors/" \
       -H "Authorization: Bearer <TOKEN>" \
       -H "Content-Type: application/json" \
       -d "{\"name\": \"Global Wood Supplier\", \"email\": \"sales@woodsupplies.com\", \"phone\": \"9876543210\", \"category\": \"RawMaterials\", \"payment_terms\": \"Net30\"}"
  ```
* Save the returned vendor `"id"` (referred to below as `<VENDOR_ID>`).

### B. Create Component Products
Let's create two raw material items that will be used in our Bill of Materials:
* **Endpoint**: `POST /api/v1/products/`
* **cURL (Component 1 - Wood Panel)**:
  ```bash
  curl -X POST "http://127.0.0.1:8000/api/v1/products/" \
       -H "Authorization: Bearer <TOKEN>" \
       -H "Content-Type: application/json" \
       -d "{\"name\": \"Wood Panel\", \"type\": \"Component\", \"sales_price\": 80.0, \"cost_price\": 50.0, \"on_hand_qty\": 100.0, \"reserved_qty\": 0.0, \"procurement_strategy\": \"MTS\"}"
  ```
* **cURL (Component 2 - Metal Screws)**:
  ```bash
  curl -X POST "http://127.0.0.1:8000/api/v1/products/" \
       -H "Authorization: Bearer <TOKEN>" \
       -H "Content-Type: application/json" \
       -d "{\"name\": \"Metal Screws\", \"type\": \"Component\", \"sales_price\": 5.0, \"cost_price\": 2.0, \"on_hand_qty\": 100.0, \"reserved_qty\": 0.0, \"procurement_strategy\": \"MTS\"}"
  ```
* Save the component IDs: `<COMP1_ID>` and `<COMP2_ID>`.

### C. Create Finished Good Product
Create the final product that will use a Bill of Materials recipe:
* **cURL**:
  ```bash
  curl -X POST "http://127.0.0.1:8000/api/v1/products/" \
       -H "Authorization: Bearer <TOKEN>" \
       -H "Content-Type: application/json" \
       -d "{\"name\": \"Wooden Cabinet\", \"type\": \"FinishedGood\", \"sales_price\": 300.0, \"cost_price\": 180.0, \"on_hand_qty\": 50.0, \"reserved_qty\": 0.0, \"procurement_strategy\": \"MTS\"}"
  ```
* Save the finished good ID: `<FINISHED_GOOD_ID>`.

### D. Create a Customer
* **Endpoint**: `POST /api/v1/customers/`
* **cURL**:
  ```bash
  curl -X POST "http://127.0.0.1:8000/api/v1/customers/" \
       -H "Authorization: Bearer <TOKEN>" \
       -H "Content-Type: application/json" \
       -d "{\"name\": \"Main Street Furnitures\", \"email\": \"buy@mainstreet.com\", \"phone\": \"8765432109\", \"category\": \"Wholesale\"}"
  ```
* Save the customer ID: `<CUSTOMER_ID>`.

---

## 3. Bill of Materials (BoM) Operations

### A. Create a BoM
Create a recipe for the "Wooden Cabinet" requiring 1 Wood Panel and 8 Metal Screws:
* **Endpoint**: `POST /api/v1/boms/`
* **cURL**:
  ```bash
  curl -X POST "http://127.0.0.1:8000/api/v1/boms/" \
       -H "Authorization: Bearer <TOKEN>" \
       -H "Content-Type: application/json" \
       -d "{\"product_id\": \"<FINISHED_GOOD_ID>\", \"name\": \"Wooden Cabinet Recipe\", \"version\": \"1.0\", \"lines\": [{\"component_product_id\": \"<COMP1_ID>\", \"quantity_required\": 1.0}, {\"component_product_id\": \"<COMP2_ID>\", \"quantity_required\": 8.0}]}"
  ```
* Save the returned BoM `"id"`: `<BOM_ID>`.

### B. Test Cycle / Circular Dependency Check
1. Create a second Finished Good product, e.g., "Finished Drawer" (`<DRAWER_ID>`).
2. Create a BoM for the Drawer requiring the "Wooden Cabinet" as a component:
   ```bash
   curl -X POST "http://127.0.0.1:8000/api/v1/boms/" \
        -H "Authorization: Bearer <TOKEN>" \
        -H "Content-Type: application/json" \
        -d "{\"product_id\": \"<DRAWER_ID>\", \"name\": \"Drawer BoM\", \"version\": \"1.0\", \"lines\": [{\"component_product_id\": \"<FINISHED_GOOD_ID>\", \"quantity_required\": 1.0}]}"
   ```
3. Attempt to update the Cabinet BoM to require the "Finished Drawer" as a component, which creates a circular loop (Cabinet $\to$ Drawer $\to$ Cabinet):
   ```bash
   curl -X PUT "http://127.0.0.1:8000/api/v1/boms/<BOM_ID>" \
        -H "Authorization: Bearer <TOKEN>" \
        -H "Content-Type: application/json" \
        -d "{\"lines\": [{\"component_product_id\": \"<COMP1_ID>\", \"quantity_required\": 1.0}, {\"component_product_id\": \"<COMP2_ID>\", \"quantity_required\": 8.0}, {\"component_product_id\": \"<DRAWER_ID>\", \"quantity_required\": 1.0}]}"
   ```
* **Expected Response (400 Bad Request)**:
  ```json
  {
    "detail": "Circular dependency detected: Product <DRAWER_ID> recursively depends on <FINISHED_GOOD_ID>"
  }
  ```

---

## 4. Sales Orders & Stock Validations

### A. Create a Sales Order
* **Endpoint**: `POST /api/v1/sales-orders/`
* **cURL**:
  ```bash
  curl -X POST "http://127.0.0.1:8000/api/v1/sales-orders/" \
       -H "Authorization: Bearer <TOKEN>" \
       -H "Content-Type: application/json" \
       -d "{\"customer_id\": \"<CUSTOMER_ID>\", \"lines\": [{\"product_id\": \"<FINISHED_GOOD_ID>\", \"quantity_ordered\": 10.0}]}"
  ```
* Save the returned Sales Order `"id"`: `<SO_ID>`. The response will serialize the nested product lines.

### B. Confirm the Order (Reserve Stock)
* **Endpoint**: `POST /api/v1/sales-orders/{order_id}/confirm`
* **cURL**:
  ```bash
  curl -X POST "http://127.0.0.1:8000/api/v1/sales-orders/<SO_ID>/confirm" \
       -H "Authorization: Bearer <TOKEN>"
  ```
* The order status is updated to `"Confirmed"`, and the cabinet product's `reserved_qty` is incremented by `10.0`.

### C. Deliver the Order (Success Path)
* **Endpoint**: `POST /api/v1/sales-orders/{order_id}/deliver`
* **cURL**:
  ```bash
  curl -X POST "http://127.0.0.1:8000/api/v1/sales-orders/<SO_ID>/deliver" \
       -H "Authorization: Bearer <TOKEN>"
  ```
* The order status shifts to `"FullyDelivered"`. The cabinet's `on_hand_qty` is decremented to `40.0` (50.0 - 10.0), `reserved_qty` resets to `0.0`, and a `StockLedgerEntry` record is logged.

### D. Deliver the Order (Insufficient Stock Failure Path)
1. Place a new order for `150.0` units of the "Wooden Cabinet" (since only `40.0` units remain in stock).
2. Confirm the order (`POST /api/v1/sales-orders/<NEW_SO_ID>/confirm`).
3. Attempt to deliver the order:
   ```bash
   curl -X POST "http://127.0.0.1:8000/api/v1/sales-orders/<NEW_SO_ID>/deliver" \
        -H "Authorization: Bearer <TOKEN>"
   ```
* **Expected Response (400 Bad Request)**:
  ```json
  {
    "detail": "Insufficient stock for product Wooden Cabinet. Available: 40.0, Required: 150.0"
  }
  ```
  The API blocks the execution, preventing negative counts.
