# Detailed PRD: Mini ERP

This document outlines the detailed product requirements for the Mini ERP system tailored for Shiv Furniture Works.

## 1. System Goal
A centralized Mini ERP that manages Products, Sales, Purchase, Manufacturing, and Bill of Materials (BoM). Every operation automatically updates a single source of truth for inventory, and shortages automatically trigger the correct downstream action (buy more or build more) without manual intervention.

## 2. Core Workflows & Logic

### 2.1 Inventory Movement Engine
Every module affects inventory:
- **Sales (Delivery)**: Decreases finished goods stock.
- **Purchase (Receipt)**: Increases raw material/component stock.
- **Manufacturing (Consumption)**: Decreases component stock.
- **Manufacturing (Production)**: Increases finished goods stock.

**Rules:**
- `free_to_use_qty` = `on_hand_qty` - `reserved_qty`.
- Any change to `on_hand_qty` MUST write an entry to the `StockLedgerEntry` table synchronously in the same transaction.

### 2.2 Procurement Automation
Triggered during Sales Order confirmation and MO Creation.
**Logic:**
If `shortage_qty > 0` and `procure_on_demand == True`:
- If `procurement_type == Manufacturing`: Auto-generate a `ManufacturingOrder` in `Draft` state for the shortage amount based on `bom_id`.
- If `procurement_type == Purchase`: Auto-generate a `PurchaseOrder` in `Draft` state for the shortage amount based on `vendor_id`.

## 3. Module Specifications

### 3.1 Product Management
- Unified catalog for Finished Goods and Components.
- Required to track stock quantities, pricing, and procurement strategies.

### 3.2 Sales Module
- Captures customer demand.
- Reserving stock upon Confirmation updates `reserved_qty`.
- Delivery updates `on_hand_qty` and `reserved_qty`, triggering a Ledger entry.

### 3.3 Purchase Module
- Receives stock from vendors.
- Receipt updates `on_hand_qty` and triggers a Ledger entry. (Does not affect `reserved_qty`).

### 3.4 Manufacturing Module & BoM
- Defines recipe (BoM) with Components (BoMLines) and Operations (BoMOperations).
- MO Creation reserves components. Triggers procurement if components are short.
- MO Completion executes atomic consumption of components and production of finished goods.

### 3.5 Dashboard
Provides high-level metrics for Owners/Admins:
- Total Sales/Purchase/Manufacturing orders.
- Pending Deliveries and Delayed Orders.
- Partial Receipts.

## 4. Open Decisions Addressed
1. **Delayed Orders**: A `expected_delivery_date` field will be added to the `SalesOrder` model to compute delays.
2. **Auto-Generated Order Confirmation**: Auto-generated MOs and POs will be created in `Draft` state to ensure human review (Safety check).
3. **BoM Operation Duration**: Assumed to be **per unit** produced for accurate scalability in forecasting.
4. **Partial Delivery**: Independent line-level deliveries are supported.
5. **MO Status Transition**: MO moves from `Draft` to `InProgress` when a user explicitly marks the first `WorkOrder` as `InProgress`.
