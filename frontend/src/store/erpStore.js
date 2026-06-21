import { create } from 'zustand';

const initialVendors = [];
const initialCustomers = [];
const initialWorkCenters = [
  { id: "00000000-0000-0000-0000-000000000001", name: "Wood Shop" },
  { id: "00000000-0000-0000-0000-000000000002", name: "Assembly Line" },
  { id: "00000000-0000-0000-0000-000000000003", name: "Paint Floor" }
];
const initialBoms = [];
const initialBomLines = [];
const initialBomOperations = [];
const initialProducts = [];
const initialSalesOrders = [];
const initialSalesOrderLines = [];
const initialPurchaseOrders = [];
const initialPurchaseOrderLines = [];
const initialManufacturingOrders = [];
const initialWorkOrders = [];
const initialStockLedger = [];
const initialAuditLogs = [];

// Run Procurement Automation has been removed.

export const useErpStore = create((set, get) => ({
  // Core Database Tables
  isAuthenticated: false,
  currentRole: "StoreAdmin", // default
  globalSearch: "",
  vendors: initialVendors,
  customers: initialCustomers,
  workCenters: initialWorkCenters,
  boms: initialBoms,
  bomLines: initialBomLines,
  bomOperations: initialBomOperations,
  products: initialProducts,
  salesOrders: initialSalesOrders,
  salesOrderLines: initialSalesOrderLines,
  purchaseOrders: initialPurchaseOrders,
  purchaseOrderLines: initialPurchaseOrderLines,
  manufacturingOrders: initialManufacturingOrders,
  workOrders: initialWorkOrders,
  stockLedger: initialStockLedger,
  auditLogs: initialAuditLogs,

  // Global Setters
  login: (role) => set({ isAuthenticated: true, currentRole: role }),
  logout: () => set({ isAuthenticated: false }),
  setCurrentRole: (role) => set({ currentRole: role }),
  setGlobalSearch: (search) => set({ globalSearch: search }),

  // Add Audit Log Entry
  addAuditLog: (entityType, entityId, action, oldValue, newValue) => {
    const newLog = {
      id: `al_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      entity_type: entityType,
      entity_id: entityId,
      action: action,
      old_value: String(oldValue),
      new_value: String(newValue),
      performed_by: get().currentRole,
      performed_at: new Date().toISOString()
    };
    set((state) => ({ auditLogs: [newLog, ...state.auditLogs] }));
  },

  // Stock Adjustment (Manual)
  adjustStock: (productId, newOnHandQty) => {
    const state = get();
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const oldQty = product.on_hand_qty;
    const diff = newOnHandQty - oldQty;

    const newLedgerEntry = {
      id: `sl_${Date.now()}`,
      product_id: productId,
      change_qty: diff,
      reason: "ManualAdjustment",
      reference_type: "Manual",
      reference_id: productId,
      resulting_on_hand_qty: newOnHandQty,
      created_at: new Date().toISOString(),
      created_by: state.currentRole
    };

    const updatedProducts = state.products.map(p => 
      p.id === productId ? { ...p, on_hand_qty: newOnHandQty } : p
    );

    set({
      products: updatedProducts,
      stockLedger: [newLedgerEntry, ...state.stockLedger]
    });

    get().addAuditLog("Product", productId, "QuantityUpdated", oldQty, newOnHandQty);
  },

  // Product CRUD
  addProduct: (productData) => {
    const newId = `p_${Date.now()}`;
    const newProduct = {
      id: newId,
      on_hand_qty: 0,
      reserved_qty: 0,
      bom_id: productData.procurement_type === "Manufacturing" ? productData.bom_id : null,
      vendor_id: productData.procurement_type === "Purchase" ? productData.vendor_id : null,
      created_at: new Date().toISOString(),
      ...productData
    };

    set((state) => ({ products: [...state.products, newProduct] }));
    get().addAuditLog("Product", newId, "Created", "None", newProduct.name);
    return newId;
  },

  editProduct: (productId, productData) => {
    const oldProduct = get().products.find(p => p.id === productId);
    if (!oldProduct) return;

    set((state) => ({
      products: state.products.map(p => 
        p.id === productId ? { 
          ...p, 
          ...productData,
          bom_id: productData.procurement_type === "Manufacturing" ? productData.bom_id : null,
          vendor_id: productData.procurement_type === "Purchase" ? productData.vendor_id : null
        } : p
      )
    }));

    get().addAuditLog("Product", productId, "Updated", oldProduct.name, productData.name || oldProduct.name);
  },

  deleteProduct: (productId) => {
    const state = get();
    // Enforce deletion rule: cannot delete if referenced in active transactions
    const isInSales = state.salesOrderLines.some(sol => {
      const parentOrder = state.salesOrders.find(so => so.id === sol.sales_order_id);
      return sol.product_id === productId && parentOrder && parentOrder.status !== "Cancelled";
    });

    const isInPurchase = state.purchaseOrderLines.some(pol => {
      const parentOrder = state.purchaseOrders.find(po => po.id === pol.purchase_order_id);
      return pol.product_id === productId && parentOrder && parentOrder.status !== "Cancelled";
    });

    const isInMO = state.manufacturingOrders.some(mo => 
      mo.product_id === productId && mo.status !== "Cancelled"
    );

    const isInBoM = state.bomLines.some(bl => bl.component_product_id === productId);

    if (isInSales || isInPurchase || isInMO || isInBoM) {
      throw new Error("Product cannot be deleted because it is referenced in active orders or Bill of Materials.");
    }

    set((state) => ({
      products: state.products.filter(p => p.id !== productId)
    }));

    get().addAuditLog("Product", productId, "Deleted", "Active", "Archived/Deleted");
  },

  // Sales Order CRUD
  createSalesOrder: (customerId, expectedDeliveryDate, lines) => {
    const state = get();
    const newSoId = `so_${Date.now()}`;
    const newSoNumber = `SO-${String(state.salesOrders.length + 1).padStart(4, '0')}`;

    const newSo = {
      id: newSoId,
      order_number: newSoNumber,
      customer_id: customerId,
      status: "Draft",
      created_at: new Date().toISOString(),
      expected_delivery_date: expectedDeliveryDate,
      delivered_at: null
    };

    const newSoLines = lines.map((line, idx) => ({
      id: `sol_${newSoId}_${idx}`,
      sales_order_id: newSoId,
      product_id: line.product_id,
      quantity_ordered: Number(line.quantity),
      quantity_delivered: 0,
      unit_price: Number(line.unit_price)
    }));

    set({
      salesOrders: [...state.salesOrders, newSo],
      salesOrderLines: [...state.salesOrderLines, ...newSoLines]
    });

    get().addAuditLog("SalesOrder", newSoId, "Created", "Draft", newSoNumber);
    return newSoId;
  },

  confirmSalesOrder: (soId) => {
    // Deprecated for now, using React Query
  },

  deliverSalesOrderLine: (soId, lineId, qtyToDeliver) => {
    const state = get();
    const orderIndex = state.salesOrders.findIndex(so => so.id === soId);
    if (orderIndex === -1) return;
    const order = state.salesOrders[orderIndex];

    const lineIndex = state.salesOrderLines.findIndex(sol => sol.id === lineId);
    if (lineIndex === -1) return;
    const line = state.salesOrderLines[lineIndex];

    const productIdx = state.products.findIndex(p => p.id === line.product_id);
    if (productIdx === -1) return;
    const product = state.products[productIdx];

    // Enforce limits: cannot deliver more than remaining ordered, nor more than reserved
    const remainingToDeliver = line.quantity_ordered - line.quantity_delivered;
    const actualDeliver = Math.min(qtyToDeliver, remainingToDeliver, product.on_hand_qty, product.reserved_qty);

    if (actualDeliver <= 0) return;

    // Deduct stock on-hand and reserved
    const updatedProducts = state.products.map(p => 
      p.id === product.id ? { 
        ...p, 
        on_hand_qty: p.on_hand_qty - actualDeliver,
        reserved_qty: p.reserved_qty - actualDeliver
      } : p
    );

    // Update Sales Order Line
    const newDelivered = line.quantity_delivered + actualDeliver;
    const updatedLines = state.salesOrderLines.map(sol => 
      sol.id === lineId ? { ...sol, quantity_delivered: newDelivered } : sol
    );

    // Stock ledger entry
    const newLedgerEntry = {
      id: `sl_${Date.now()}`,
      product_id: product.id,
      change_qty: -actualDeliver,
      reason: "SaleDelivery",
      reference_type: "SalesOrder",
      reference_id: soId,
      resulting_on_hand_qty: product.on_hand_qty - actualDeliver,
      created_at: new Date().toISOString(),
      created_by: state.currentRole
    };

    set({
      products: updatedProducts,
      salesOrderLines: updatedLines,
      stockLedger: [newLedgerEntry, ...state.stockLedger]
    });

    // Check if whole order is delivered
    const allLines = updatedLines.filter(sol => sol.sales_order_id === soId);
    const allFullyDelivered = allLines.every(sol => sol.quantity_delivered === sol.quantity_ordered);
    const someDelivered = allLines.some(sol => sol.quantity_delivered > 0);

    let nextStatus = "Confirmed";
    if (allFullyDelivered) nextStatus = "FullyDelivered";
    else if (someDelivered) nextStatus = "PartiallyDelivered";

    const updatedOrders = state.salesOrders.map(o => 
      o.id === soId ? { 
        ...o, 
        status: nextStatus,
        delivered_at: nextStatus === "FullyDelivered" ? new Date().toISOString() : o.delivered_at
      } : o
    );

    set({ salesOrders: updatedOrders });
    get().addAuditLog("SalesOrder", soId, "DeliveryRegistered", `Line ${lineId} delivered ${actualDeliver}`, nextStatus);
  },

  cancelSalesOrder: (soId) => {
    const state = get();
    const orderIndex = state.salesOrders.findIndex(so => so.id === soId);
    if (orderIndex === -1) return;
    const order = state.salesOrders[orderIndex];

    const orderLines = state.salesOrderLines.filter(sol => sol.sales_order_id === soId);
    let updatedProducts = [...state.products];

    // Release reservations
    orderLines.forEach(line => {
      const prodIdx = updatedProducts.findIndex(p => p.id === line.product_id);
      if (prodIdx === -1) return;
      const product = updatedProducts[prodIdx];

      // Calculate how much we had reserved for this order (ordered - delivered, capped by reserved_qty)
      const remainingToDeliver = line.quantity_ordered - line.quantity_delivered;
      const releaseReserved = Math.min(remainingToDeliver, product.reserved_qty);

      updatedProducts[prodIdx] = {
        ...product,
        reserved_qty: Math.max(0, product.reserved_qty - releaseReserved)
      };
    });

    const updatedOrders = state.salesOrders.map(o => 
      o.id === soId ? { ...o, status: "Cancelled" } : o
    );

    set({
      products: updatedProducts,
      salesOrders: updatedOrders
    });

    get().addAuditLog("SalesOrder", soId, "StatusChanged", order.status, "Cancelled");
  },

  // Purchase Order CRUD - Migrated to backend REST APIs

  // BoM CRUD
  createBoM: (bomData) => {
    const state = get();
    const newBomId = `bom_${Date.now()}`;

    // Circular dependency checker
    const checkCircular = (finishedId, components) => {
      const visited = new Set();
      const checkNode = (prodId) => {
        if (prodId === finishedId) return true;
        if (visited.has(prodId)) return false;
        visited.add(prodId);

        // find BoMs for this sub component
        const subBom = state.boms.find(b => b.product_id === prodId);
        if (!subBom) return false;

        const subLines = state.bomLines.filter(bl => bl.bom_id === subBom.id);
        for (let line of subLines) {
          if (checkNode(line.component_product_id)) return true;
        }
        return false;
      };

      for (let line of components) {
        if (checkNode(line.component_product_id)) return true;
      }
      return false;
    };

    if (bomData.components.length === 0) {
      throw new Error("At least one component line is required to save a Bill of Materials.");
    }

    if (bomData.components.some(c => c.component_product_id === bomData.product_id)) {
      throw new Error("A Bill of Materials cannot contain its parent product as a component (no self-referencing).");
    }

    if (checkCircular(bomData.product_id, bomData.components)) {
      throw new Error("Circular dependency detected! This product cannot be created because a subcomponent requires it recursively.");
    }

    const newBom = {
      id: newBomId,
      product_id: bomData.product_id,
      name: bomData.name || `${state.products.find(p => p.id === bomData.product_id)?.name} BoM`,
      version: bomData.version || "v1",
      created_at: new Date().toISOString()
    };

    const newBomLines = bomData.components.map((c, idx) => ({
      id: `bl_${newBomId}_${idx}`,
      bom_id: newBomId,
      component_product_id: c.component_product_id,
      quantity_required: Number(c.quantity_required)
    }));

    const newBomOperations = bomData.operations.map((op, idx) => ({
      id: `bo_${newBomId}_${idx}`,
      bom_id: newBomId,
      operation_name: op.operation_name,
      sequence: idx + 1,
      duration_minutes: Number(op.duration_minutes),
      work_center_id: op.work_center_id
    }));

    set({
      boms: [...state.boms, newBom],
      bomLines: [...state.bomLines, ...newBomLines],
      bomOperations: [...state.bomOperations, ...newBomOperations]
    });

    // Link the product to this BoM
    const updatedProducts = state.products.map(p => 
      p.id === bomData.product_id ? { ...p, bom_id: newBomId } : p
    );
    set({ products: updatedProducts });

    get().addAuditLog("BoM", newBomId, "Created", "None", newBom.name);
    return newBomId;
  },

  // Manufacturing Order actions - Migrated to backend REST APIs
}));
