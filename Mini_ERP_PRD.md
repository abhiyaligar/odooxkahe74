# Mini ERP — "Shiv Furniture Works"
## Product Requirements Document (PRD)

**Version:** 1.0
**Purpose of this document:** This PRD is written to be consumed directly by an AI coding agent (or a developer) to build the system end-to-end. Every entity, field, status flow, and business rule needed for implementation is specified explicitly. Where the original hackathon brief did not specify something, that gap is called out so it can be decided before coding, not discovered during coding.

---

## 1. Problem Statement (Plain Summary)

Shiv Furniture Works is a furniture manufacturing company currently run on Excel sheets, WhatsApp messages, manual stock registers, and paper manufacturing notes. This causes:

- Sales selling products without checking real stock
- Purchase teams not knowing when raw materials are low until it's urgent
- Manufacturing operators not knowing what to build next, with BoMs on paper
- Inaccurate stock balances because consumption/production isn't tracked
- Owners with zero visibility into pending orders, delays, shortages, or efficiency

**The system to build:** A centralized Mini ERP that manages Products, Sales, Purchase, Manufacturing, and Bill of Materials (BoM), where every operation automatically updates a single source of truth for inventory, and shortages automatically trigger the correct downstream action (buy more or build more) without manual intervention.

**The one-sentence version:** When a customer orders something, the system automatically determines whether to fulfill from existing stock, manufacture more, or purchase more raw material — and keeps every number in sync as that happens.

---

## 2. Core Concept: Inventory Movement

Every module in this system exists to move one number: **stock**. Nothing should be built that doesn't ultimately serve this loop.

| Module | Effect on Stock |
|---|---|
| Sales (Delivery) | Decreases finished goods stock |
| Purchase (Receipt) | Increases raw material / component stock |
| Manufacturing (Consumption) | Decreases component stock |
| Manufacturing (Production) | Increases finished goods stock |
| Procurement Automation | Triggers Purchase or Manufacturing to replenish stock |

If a proposed feature does not ultimately move, protect, or report on this number, it is out of scope for v1.

---

## 3. Roles & Permissions

### 3.1 Role List

| Role | Description |
|---|---|
| Super Admin | Top-level system owner. Full access, including managing Store Admins, Inventory Managers, Sales Users, and Business Owners. |
| Store Admin | Runs a store/business fully. Maps to "Admin" in the original brief. Full access to all modules including Audit Logs. |
| Sales User | Creates and manages Sales Orders only. |
| Purchase User | Creates and manages Purchase Orders and Vendors only. |
| Manufacturing User | Creates and manages Manufacturing Orders and Work Orders only. |
| Inventory Manager | Views and corrects stock; does not create commercial orders. |
| Business Owner | Read-only dashboard access. No write access anywhere. |

### 3.2 Permission Matrix

Legend: **F** = Full (create/edit/delete/view) · **E** = Edit/Act (status updates, no delete) · **V** = View only · **—** = No access · **System** = automatic backend action, not a manual user permission

| Module / Action | Super Admin | Store Admin | Sales User | Purchase User | Manufacturing User | Inventory Manager | Business Owner |
|---|---|---|---|---|---|---|---|
| User Management | F | F | — | — | — | — | — |
| Role Assignment | F | F | — | — | — | — | — |
| Product — Create/Edit/Delete | F | F | — | — | — | — | — |
| Product — View | F | F | V | V | V | V | V |
| Procurement Strategy Config (MTS/MTO, Vendor, BoM link) | F | F | — | — | — | — | — |
| BoM — Create/Edit/Delete | F | F | — | — | V | — | V |
| Vendor — Create/Edit/Delete | F | F | — | E | — | — | — |
| Vendor — View | F | F | — | F | — | V | V |
| Sales Order — Create/Edit | F | F | F | — | — | — | — |
| Sales Order — Confirm/Deliver/Cancel | F | F | E | — | — | — | — |
| Sales Order — View | F | F | F | V | — | V | V |
| Purchase Order — Create/Edit | F | F | — | F | — | — | — |
| Purchase Order — Confirm/Receive/Cancel | F | F | — | E | — | — | — |
| Purchase Order — View | F | F | — | F | V | V | V |
| Manufacturing Order — Create/Edit | F | F | — | — | F | — | — |
| Work Order — Update Status | F | F | — | — | E | — | — |
| Manufacturing Order — View | F | F | — | V | F | V | V |
| Auto-Procurement Trigger | System | System | System | System | System | System | — |
| Stock — Manual Adjustment | F | F | — | — | — | E | — |
| Stock — View | F | F | V | V | V | F | V |
| Stock Ledger — View | F | F | — | V | V | F | V |
| Audit Logs — View | F | F | — | — | — | — | — |
| Dashboard — View | F | F | — | — | — | — | F |

### 3.3 Access Enforcement Rule

Every API endpoint must check: **(a)** is the user authenticated, **(b)** does their role have at least the required access level for this action. A Sales User hitting a Purchase Order endpoint must receive a 403, not a filtered view. Role checks happen server-side; the frontend hiding a button is not sufficient.

---

## 4. Data Model

### 4.1 Entity List

1. User
2. Product
3. BoM (Bill of Materials)
4. BoMLine (component lines within a BoM)
5. BoMOperation (operation/work-step lines within a BoM)
6. Vendor
7. Customer
8. SalesOrder
9. SalesOrderLine
10. PurchaseOrder
11. PurchaseOrderLine
12. ManufacturingOrder
13. WorkOrder
14. WorkCenter
15. StockLedgerEntry
16. AuditLog

### 4.2 Entity Definitions

#### User
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| name | string | |
| email | string, unique | |
| password_hash | string | never store plaintext |
| role | enum | SuperAdmin, StoreAdmin, SalesUser, PurchaseUser, ManufacturingUser, InventoryManager, BusinessOwner |
| is_active | boolean | for archive/deactivate |
| created_at | datetime | |

#### Product
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| name | string | e.g. "Wooden Table", "Wooden Leg", "Screw" |
| type | enum | FinishedGood, Component/RawMaterial — both live in the same table per the brief |
| sales_price | decimal | |
| cost_price | decimal | |
| on_hand_qty | decimal | actual physical stock |
| reserved_qty | decimal | committed to open Sales/Manufacturing Orders |
| free_to_use_qty | computed | = on_hand_qty − reserved_qty. Do not store; always compute. |
| procurement_strategy | enum | MTS (Make To Stock), MTO (Make To Order) |
| procure_on_demand | boolean | enables auto-replenishment |
| procurement_type | enum, nullable | Purchase, Manufacturing — required if procure_on_demand is true |
| vendor_id | FK → Vendor, nullable | required if procurement_type = Purchase |
| bom_id | FK → BoM, nullable | required if procurement_type = Manufacturing |
| created_at / updated_at | datetime | |

**Rule:** `free_to_use_qty` must never be a stored, independently-editable column. It is always derived. Storing it as its own writable field is the most common bug source in this kind of system — two numbers drift out of sync the moment one update path is missed.

#### BoM (Bill of Materials)
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| product_id | FK → Product | the finished good this recipe produces |
| name / version | string | optional, e.g. "v1" |
| created_at | datetime | |

#### BoMLine
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| bom_id | FK → BoM | |
| component_product_id | FK → Product | the raw material/component needed |
| quantity_required | decimal | quantity needed per 1 unit of the finished good |

#### BoMOperation
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| bom_id | FK → BoM | |
| operation_name | string | e.g. "Assembly", "Painting", "Packing" |
| sequence | integer | order in which it must run |
| duration_minutes | integer | per unit, or per batch — decide and document this assumption in code comments |
| work_center_id | FK → WorkCenter | |

#### WorkCenter
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| name | string | e.g. "Assembly Line", "Paint Floor", "Packaging Unit" |

**Build note:** Per scope decision, seed 2–3 WorkCenter rows as fixed data. Do not build a WorkCenter CRUD UI or capacity/scheduling logic — out of scope for v1.

#### Vendor
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| name | string | |
| email | string | used for PO notifications if that stretch feature is built |
| phone | string | |
| created_at | datetime | |

#### Customer
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| name | string | |
| email | string | |
| phone | string | |

#### SalesOrder
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| order_number | string, unique | human-readable, e.g. SO-0001 |
| customer_id | FK → Customer | |
| status | enum | Draft, Confirmed, PartiallyDelivered, FullyDelivered, Cancelled |
| created_by | FK → User | |
| created_at / confirmed_at / delivered_at | datetime | |

#### SalesOrderLine
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| sales_order_id | FK → SalesOrder | |
| product_id | FK → Product | |
| quantity_ordered | decimal | |
| quantity_delivered | decimal | default 0, increments as deliveries happen |
| unit_price | decimal | snapshot of sales_price at order time |

#### PurchaseOrder
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| order_number | string, unique | e.g. PO-0001 |
| vendor_id | FK → Vendor | |
| status | enum | Draft, Confirmed, PartiallyReceived, FullyReceived, Cancelled |
| source | enum | Manual, AutoGenerated — tag whether this PO came from procurement automation |
| created_by | FK → User, nullable | nullable because System can create it |
| created_at / confirmed_at / received_at | datetime | |

#### PurchaseOrderLine
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| purchase_order_id | FK → PurchaseOrder | |
| product_id | FK → Product | |
| quantity_ordered | decimal | |
| quantity_received | decimal | default 0 |
| unit_cost | decimal | |

#### ManufacturingOrder (MO)
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| order_number | string, unique | e.g. MO-0001 |
| product_id | FK → Product | finished good being built |
| bom_id | FK → BoM | snapshot reference to the recipe used |
| quantity_to_produce | decimal | |
| status | enum | Draft, InProgress, Completed, Cancelled |
| source | enum | Manual, AutoGenerated | 
| assignee_id | FK → User, nullable | |
| created_at / started_at / completed_at | datetime | |

#### WorkOrder
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| manufacturing_order_id | FK → ManufacturingOrder | |
| operation_name | string | copied from BoMOperation at MO creation time |
| sequence | integer | copied from BoMOperation |
| work_center_id | FK → WorkCenter | |
| status | enum | Pending, InProgress, Done |
| started_at / completed_at | datetime | |

**Build note:** Per scope decision, WorkOrders are a flat list copied from the BoM's operations at MO-creation time, status-tracked individually. Do not build dynamic re-sequencing, parallel branching, or a generic scheduler.

#### StockLedgerEntry
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| product_id | FK → Product | |
| change_qty | decimal | positive or negative |
| reason | enum | SaleDelivery, PurchaseReceipt, ManufacturingConsume, ManufacturingProduce, ManualAdjustment |
| reference_type | enum | SalesOrder, PurchaseOrder, ManufacturingOrder, Manual |
| reference_id | UUID | the order that caused this movement |
| resulting_on_hand_qty | decimal | snapshot of on_hand_qty after this entry, for audit trail |
| created_at | datetime | |
| created_by | FK → User, nullable | nullable for System-driven entries |

**Rule:** Every single change to `on_hand_qty` anywhere in the system MUST create a corresponding StockLedgerEntry in the same transaction. There must be no code path that changes stock without writing a ledger row. This is the system's source of truth for "what happened to inventory and why."

#### AuditLog
| Field | Type | Notes |
|---|---|---|
| id | UUID/PK | |
| entity_type | string | e.g. "SalesOrder", "Product" |
| entity_id | UUID | |
| action | string | e.g. "StatusChanged", "QuantityUpdated", "PriceUpdated" |
| old_value | string/JSON | |
| new_value | string/JSON | |
| performed_by | FK → User, nullable | |
| performed_at | datetime | |

---

## 5. Module Specifications

### 5.1 Product Management

**Purpose:** Central catalog of everything the business tracks — both finished goods and raw materials/components live in this one table.

**Features:**
- Create / Edit / Delete products (Store Admin, Super Admin only)
- Fields on the form: Name, Sales Price, Cost Price, current Stock Qty, Procurement Strategy
- If Procurement Strategy involves auto-replenishment, also configure: Procure on Demand (toggle), Procurement Type (Purchase/Manufacturing), Vendor (if Purchase), BoM (if Manufacturing)
- Display computed: On Hand Qty, Reserved Qty, Free To Use Qty

**Validation rules:**
- If `procurement_type = Purchase`, `vendor_id` is required.
- If `procurement_type = Manufacturing`, `bom_id` is required, and that BoM's `product_id` must match this product's id.
- A product cannot be deleted if it is referenced by any non-cancelled SalesOrderLine, PurchaseOrderLine, ManufacturingOrder, or BoMLine. Soft-delete / archive instead.

### 5.2 Sales Module

**Purpose:** Capture customer demand and trigger stock movement + procurement.

**Status flow:**
```
Draft → Confirmed → Partially Delivered → Fully Delivered
Draft → Cancelled
```

**Business logic — on Confirm:**
1. For each SalesOrderLine, check `free_to_use_qty` of the product.
2. Reserve the ordered quantity: increment `reserved_qty` by `quantity_ordered` (up to what's available; see shortage handling below).
3. If `free_to_use_qty` for a line's product is less than `quantity_ordered`, a shortage exists. The shortage amount = `quantity_ordered − free_to_use_qty` (floor at 0 if negative). Trigger **Procurement Automation** (Section 6) for the shortage amount on that product.

**Business logic — on Deliver (partial or full):**
1. Increment `quantity_delivered` on the relevant SalesOrderLine(s).
2. Decrement `on_hand_qty` and `reserved_qty` on the Product by the delivered quantity.
3. Write a StockLedgerEntry with reason `SaleDelivery`.
4. If all lines have `quantity_delivered = quantity_ordered`, set SalesOrder status to `FullyDelivered`. Otherwise `PartiallyDelivered`.

**Business logic — on Cancel:**
1. Release any reserved quantity back (decrement `reserved_qty` by whatever was reserved for this order, only if not yet delivered).
2. Set status to `Cancelled`. Do not allow further transitions from `Cancelled`.

### 5.3 Purchase Module

**Purpose:** Replenish raw material/component stock from vendors.

**Status flow:**
```
Draft → Confirmed → Partially Received → Fully Received
Draft → Cancelled
```

**Business logic — on Receive (partial or full):**
1. Increment `quantity_received` on the relevant PurchaseOrderLine(s).
2. Increment `on_hand_qty` on the Product by the received quantity.
3. Write a StockLedgerEntry with reason `PurchaseReceipt`.
4. If all lines have `quantity_received = quantity_ordered`, set PurchaseOrder status to `FullyReceived`. Otherwise `PartiallyReceived`.

**Note:** Receiving does NOT touch `reserved_qty`. Reservation only applies to commitments against finished-goods demand (Sales) or component consumption (Manufacturing) — incoming purchases simply add to `on_hand_qty`, increasing `free_to_use_qty` as a side effect of the formula.

### 5.4 Bill of Materials (BoM)

**Purpose:** Define the recipe — components + quantities + operations — for manufacturing one unit of a finished good.

**Features:**
- Create a BoM tied to exactly one finished-good Product
- Add BoMLines: pick a component Product + quantity required per 1 unit of output
- Add BoMOperations: name, sequence, duration, WorkCenter

**Validation rules:**
- A BoMLine's `component_product_id` cannot equal the parent BoM's `product_id` (no self-referencing recipes).
- Circular BoMs (A requires B, B requires A) must be rejected at save time — walk the BoM tree before allowing save.
- At least one BoMLine is required to save a BoM (a recipe with zero components is not valid).

### 5.5 Manufacturing Module

**Purpose:** Convert reserved components into finished goods, tracked through discrete Work Orders.

**Status flow (Manufacturing Order):**
```
Draft → InProgress → Completed
Draft → Cancelled
```

**Status flow (Work Order, per step):**
```
Pending → InProgress → Done
```

**Business logic — on MO Creation:**
1. Fetch the BoM tied to `product_id`.
2. For each BoMLine, calculate required quantity = `BoMLine.quantity_required × MO.quantity_to_produce`.
3. Check `free_to_use_qty` for each required component.
   - If sufficient: reserve it — increment `reserved_qty` on that component Product by the required quantity.
   - If insufficient: shortage = required − free_to_use (floor at 0). Trigger **Procurement Automation** (Section 6) for that component's shortage.
4. Copy each BoMOperation into a new WorkOrder row (status = Pending), preserving sequence and work_center_id.
5. Set MO status to `InProgress` once work has actually started (first WorkOrder moves to InProgress), or leave as `Draft` until the first WorkOrder begins — decide and document this transition point in code.

**Business logic — on Work Order status change:**
- Operators move each WorkOrder Pending → InProgress → Done in sequence order. Do not allow marking step N as Done while step N−1 is still Pending (enforce sequence).

**Business logic — on MO Completion (all WorkOrders = Done):**
1. For each BoMLine, deduct the consumed quantity: decrement `on_hand_qty` AND `reserved_qty` on each component Product by the quantity that was reserved at MO creation. Write a StockLedgerEntry per component with reason `ManufacturingConsume`.
2. Increment `on_hand_qty` on the finished-good Product by `quantity_to_produce`. Write a StockLedgerEntry with reason `ManufacturingProduce`.
3. Set MO status to `Completed`.

**This is the most failure-prone part of the system — be exact:** consumption and production must happen in the same atomic transaction. If the process crashes between step 1 and step 2, you must not end up with components deducted but no finished goods produced (or vice versa). Wrap this in a DB transaction with rollback on any failure.

### 5.6 Inventory & Stock Tracking

**Concepts:**
- **On Hand Qty** — actual physical stock right now.
- **Reserved Qty** — stock already committed to open Sales Orders (post-confirm) or Manufacturing Orders (components reserved at MO creation).
- **Free To Use Qty** — what's actually available to promise to a new order. `Free To Use = On Hand − Reserved`. Always computed, never stored.

**Stock Ledger:** A permanent, append-only log. Every increment or decrement to `on_hand_qty`, anywhere in the system, for any reason, must produce exactly one StockLedgerEntry row in the same transaction as the stock change. No exceptions, no "we'll add logging later" — this is the traceability backbone the brief explicitly asks for.

### 5.7 Audit Logs

**Purpose:** A permanent diary of every meaningful change for traceability.

**Must log at minimum:**
- Any status change (SalesOrder, PurchaseOrder, ManufacturingOrder, WorkOrder)
- Any quantity change on a Product (manual adjustment)
- Any price update (sales_price, cost_price)
- Delivery events
- Manufacturing completion events

**Access:** Store Admin and Super Admin only.

### 5.8 Dashboard

**Purpose:** Real-time operational visibility for the Business Owner and Admins.

**Required metrics:**
- Total Sales Orders (and breakdown by status)
- Pending Deliveries
- Manufacturing Orders (and breakdown by status)
- Delayed Orders (define "delayed" explicitly — e.g., Confirmed SalesOrder past an expected delivery date that hasn't shipped; this needs a due-date concept added if not already present — **gap, see Section 8**)
- Total Purchase Orders
- Partial Receipts

---

## 6. Procurement Automation (Core Differentiator)

This is the centerpiece business logic of the entire system. It must be implemented as a single, reusable function — not duplicated inline in both the Sales and Manufacturing code paths.

### 6.1 Trigger Points

Procurement Automation fires whenever a shortage is detected during:
1. Sales Order confirmation (Section 5.2)
2. Manufacturing Order creation, for component shortages (Section 5.5)

### 6.2 The Rule (Pseudocode)

```
function triggerProcurement(product, shortage_qty):
    if shortage_qty <= 0:
        return  # no shortage, nothing to do

    if product.procure_on_demand == false:
        return  # this product is not configured for auto-replenishment;
                # leave the shortage as a visible gap for a human to resolve manually

    if product.procurement_type == "Manufacturing":
        assert product.bom_id is not None
        create ManufacturingOrder(
            product_id = product.id,
            bom_id = product.bom_id,
            quantity_to_produce = shortage_qty,
            source = "AutoGenerated"
        )
        # this recursively re-enters Manufacturing Order Creation logic (Section 5.5),
        # which may itself trigger further procurement for sub-components

    else if product.procurement_type == "Purchase":
        assert product.vendor_id is not None
        create PurchaseOrder(
            vendor_id = product.vendor_id,
            status = "Draft",
            source = "AutoGenerated",
            lines = [{ product_id: product.id, quantity_ordered: shortage_qty }]
        )
```

### 6.3 Worked Example (from the brief)

Customer orders 20 Dining Tables. Available stock = 5. Shortage = 15.

- If Dining Table's `procurement_type = Manufacturing` → system auto-creates a Manufacturing Order for 15 units. That MO then checks its own BoM components (legs, tops, screws) and may itself trigger further Purchase Orders if those components are short.
- If Dining Table's `procurement_type = Purchase` → system auto-creates a Purchase Order for 15 units against its configured Vendor.

### 6.4 Edge Cases to Handle Explicitly

- **Recursive shortages:** A Manufacturing Order auto-created for a shortage may itself discover component shortages, which recursively trigger more Purchase/Manufacturing Orders. The automation function must be safe to call recursively without infinite loops (a BoM cannot reference itself — enforced in Section 5.4).
- **No procurement configured:** If `procure_on_demand = false` (or fields are missing), do NOT silently fail or throw an unhandled error. The shortage should remain visible (e.g., the SalesOrder stays in a state showing unfulfilled quantity) so a human can intervene manually. This is an intentional design decision, not a bug.
- **Auto-generated orders still need human confirmation in v1:** Auto-created PurchaseOrders and ManufacturingOrders are created in `Draft` status with `source = AutoGenerated`. They are not auto-confirmed. A human (Purchase User / Manufacturing User) reviews and confirms them. This keeps a safety check in the loop and is simpler to build correctly under time pressure. **(Decision point — confirm with team before building; see Section 8.)**

---

## 7. Out of Scope for v1 (Explicitly Excluded)

These were discussed and intentionally cut to protect build time. Do not build these unless core flow is complete with time to spare:

| Feature | Reason excluded |
|---|---|
| Vendor marketplace (buyers/sellers transact directly) | Different product entirely; dilutes the core procurement-automation story; not in the original brief |
| OCR-based vendor upload | Heavy infra (OCR API/library + parsing) for a problem manual entry already solves |
| Generic Work Center capacity/scheduling engine | Scheduling problems balloon scope; flat sequential Work Orders suffice for the demo |
| AI/NLP-based "explain this product" interface | The BoM-detail view solves this with a simple read query; no LLM needed |
| Vendor-side PO confirmation portal (email + magic link) | Real value, but genuinely new scope (email infra, token security, new UI). Build only as a stretch goal after core flow + BoM detail view are done and stable. |

---

## 8. Open Decisions / Gaps to Resolve Before Coding

The original brief does not specify these. Decide as a team and update this PRD before building, so the AI agent or developers aren't guessing mid-build:

1. **"Delayed Order" definition** — the Dashboard requires showing "Delayed Orders" but no due-date field exists anywhere in the current data model. Decide: do SalesOrders get an `expected_delivery_date` field? Without one, "delayed" cannot be computed.
2. **Auto-generated order confirmation** — should AutoGenerated POs/MOs require human confirmation (current assumption in Section 6.4), or should they auto-confirm immediately? Auto-confirm is more "wow" in a demo but removes a safety check and is riskier to get right under time pressure.
3. **BoMOperation duration semantics** — is `duration_minutes` per unit produced, or a fixed duration for the whole batch regardless of quantity? This affects how "estimated completion time" would be calculated if ever shown.
4. **Partial delivery / receipt line-level granularity** — when a SalesOrder has multiple lines, can lines be delivered independently at different times, or must the whole order ship together? (Current model assumes independent line-level delivery — confirm this matches intent.)
5. **MO status transition trigger** — does MO move from Draft to InProgress automatically when the first WorkOrder starts, or does a user explicitly click "Start Manufacturing"? (Section 5.5 flags this — pick one and document it in code.)

---

## 9. Build Priority Order (If Time Runs Short)

Build top-down. If hours run out, cut from the bottom — everything above the cut line should still demo as a coherent, working story on its own.

1. **Products + Inventory core** (On Hand/Reserved/Free-to-Use, Stock Ledger) — everything else depends on this existing and being correct.
2. **Sales + Purchase** — basic CRUD + status flow, no automation yet.
3. **BoM + Manufacturing** — the technical-depth showcase.
4. **Procurement Automation** (Section 6) — the differentiator. This is what should be live and demoed working, end to end, in front of judges.
5. **Dashboard** — visual payoff, relatively cheap once data model is solid.
6. **Audit Logs** — least demo-visible; first to cut if short on time.
7. **Stretch only if all above is solid:** BoM detail/cost-breakdown view, then vendor email+confirm flow.

---

## 10. Glossary (For Anyone New to This Domain)

- **BoM (Bill of Materials):** A recipe. Lists what components and how much of each are needed to make one unit of a finished product, plus the operations required to assemble it.
- **MTS (Make To Stock):** Build/buy the product ahead of demand; customer orders are fulfilled directly from existing stock.
- **MTO (Make To Order):** Build/buy the product only when a customer order creates the need; shortages trigger automated procurement.
- **On Hand Qty:** Physical stock actually sitting in the warehouse right now.
- **Reserved Qty:** Stock already promised to an open Sales Order or already allocated to a Manufacturing Order's component needs — not available for new commitments.
- **Free To Use Qty:** What's actually available to promise to a *new* order. `On Hand − Reserved`.
- **Work Center:** A physical location where a manufacturing operation happens (e.g., Assembly Line, Paint Floor).
- **Work Order:** One discrete step within a Manufacturing Order (e.g., "Assembly" is one Work Order within the MO for 10 Wooden Tables).
- **Stock Ledger:** An append-only, permanent log of every single change to inventory and why it happened — the system's source of truth for traceability.
