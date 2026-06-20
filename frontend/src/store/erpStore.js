import { create } from 'zustand';

const initialVendors = [];
const initialCustomers = [];
const initialWorkCenters = [
  { id: "wc1", name: "Wood Shop" },
  { id: "wc2", name: "Assembly Line" },
  { id: "wc3", name: "Paint Floor" }
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

  // Purchase Order CRUD
  createPurchaseOrder: (vendorId, lines) => {
    const state = get();
    const newPoId = `po_${Date.now()}`;
    const newPoNumber = `PO-${String(state.purchaseOrders.length + 1).padStart(4, '0')}`;

    const newPo = {
      id: newPoId,
      order_number: newPoNumber,
      vendor_id: vendorId,
      status: "Draft",
      source: "Manual",
      created_by: state.currentRole,
      created_at: new Date().toISOString(),
      confirmed_at: null,
      received_at: null
    };

    const newPoLines = lines.map((line, idx) => ({
      id: `pol_${newPoId}_${idx}`,
      purchase_order_id: newPoId,
      product_id: line.product_id,
      quantity_ordered: Number(line.quantity),
      quantity_received: 0,
      unit_cost: Number(line.unit_cost)
    }));

    set({
      purchaseOrders: [...state.purchaseOrders, newPo],
      purchaseOrderLines: [...state.purchaseOrderLines, ...newPoLines]
    });

    get().addAuditLog("PurchaseOrder", newPoId, "Created", "Draft", newPoNumber);
    return newPoId;
  },

  confirmPurchaseOrder: (poId) => {
    const state = get();
    const poIndex = state.purchaseOrders.findIndex(p => p.id === poId);
    if (poIndex === -1) return;
    const po = state.purchaseOrders[poIndex];

    const updatedOrders = state.purchaseOrders.map(o => 
      o.id === poId ? { ...o, status: "Confirmed", confirmed_at: new Date().toISOString() } : o
    );

    set({ purchaseOrders: updatedOrders });
    get().addAuditLog("PurchaseOrder", poId, "StatusChanged", po.status, "Confirmed");
  },

  receivePurchaseOrderLine: (poId, lineId, qtyToReceive) => {
    const state = get();
    const orderIndex = state.purchaseOrders.findIndex(po => po.id === poId);
    if (orderIndex === -1) return;
    const order = state.purchaseOrders[orderIndex];

    const lineIndex = state.purchaseOrderLines.findIndex(pol => pol.id === lineId);
    if (lineIndex === -1) return;
    const line = state.purchaseOrderLines[lineIndex];

    const productIdx = state.products.findIndex(p => p.id === line.product_id);
    if (productIdx === -1) return;
    const product = state.products[productIdx];

    const remainingToReceive = line.quantity_ordered - line.quantity_received;
    const actualReceive = Math.min(qtyToReceive, remainingToReceive);

    if (actualReceive <= 0) return;

    // Increment physical stock on-hand
    const updatedProducts = state.products.map(p => 
      p.id === product.id ? { ...p, on_hand_qty: p.on_hand_qty + actualReceive } : p
    );

    // Update Purchase Order Line
    const newReceived = line.quantity_received + actualReceive;
    const updatedLines = state.purchaseOrderLines.map(pol => 
      pol.id === lineId ? { ...pol, quantity_received: newReceived } : pol
    );

    // Stock ledger entry
    const newLedgerEntry = {
      id: `sl_${Date.now()}`,
      product_id: product.id,
      change_qty: actualReceive,
      reason: "PurchaseReceipt",
      reference_type: "PurchaseOrder",
      reference_id: poId,
      resulting_on_hand_qty: product.on_hand_qty + actualReceive,
      created_at: new Date().toISOString(),
      created_by: state.currentRole
    };

    set({
      products: updatedProducts,
      purchaseOrderLines: updatedLines,
      stockLedger: [newLedgerEntry, ...state.stockLedger]
    });

    // Check if whole order is received
    const allLines = updatedLines.filter(pol => pol.purchase_order_id === poId);
    const allFullyReceived = allLines.every(pol => pol.quantity_received === pol.quantity_ordered);
    const someReceived = allLines.some(pol => pol.quantity_received > 0);

    let nextStatus = "Confirmed";
    if (allFullyReceived) nextStatus = "FullyReceived";
    else if (someReceived) nextStatus = "PartiallyReceived";

    const updatedOrders = state.purchaseOrders.map(o => 
      o.id === poId ? { 
        ...o, 
        status: nextStatus,
        received_at: nextStatus === "FullyReceived" ? new Date().toISOString() : o.received_at
      } : o
    );

    set({ purchaseOrders: updatedOrders });
    get().addAuditLog("PurchaseOrder", poId, "ReceiptRegistered", `Line ${lineId} received ${actualReceive}`, nextStatus);
  },

  cancelPurchaseOrder: (poId) => {
    const state = get();
    const poIndex = state.purchaseOrders.findIndex(p => p.id === poId);
    if (poIndex === -1) return;
    const po = state.purchaseOrders[poIndex];

    const updatedOrders = state.purchaseOrders.map(o => 
      o.id === poId ? { ...o, status: "Cancelled" } : o
    );

    set({ purchaseOrders: updatedOrders });
    get().addAuditLog("PurchaseOrder", poId, "StatusChanged", po.status, "Cancelled");
  },

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

  // Manufacturing Order actions
  createManufacturingOrder: (productId, qtyToProduce) => {
    const state = get();
    const product = state.products.find(p => p.id === productId);
    if (!product || !product.bom_id) return;

    const bomId = product.bom_id;
    const bomLinesNeeded = state.bomLines.filter(bl => bl.bom_id === bomId);
    const operationsNeeded = state.bomOperations.filter(bo => bo.bom_id === bomId).sort((a, b) => a.sequence - b.sequence);

    const newMoNumber = `MO-${String(state.manufacturingOrders.length + 1).padStart(4, '0')}`;
    const newMoId = `mo_${Date.now()}`;

    // Components required calculations and reservations
    let updatedProducts = [...state.products];
    const newMoComponents = [];

    bomLinesNeeded.forEach(bl => {
      const compIdx = updatedProducts.findIndex(p => p.id === bl.component_product_id);
      if (compIdx === -1) return;
      const comp = updatedProducts[compIdx];

      const qtyNeeded = bl.quantity_required * qtyToProduce;
      const freeToUse = comp.on_hand_qty - comp.reserved_qty;
      const toReserve = Math.min(qtyNeeded, Math.max(0, freeToUse));
      const compShortage = Math.max(0, qtyNeeded - freeToUse);

      updatedProducts[compIdx] = {
        ...comp,
        reserved_qty: comp.reserved_qty + toReserve
      };

      newMoComponents.push({
        component_product_id: comp.id,
        quantity_required: qtyNeeded,
        quantity_reserved: toReserve,
        status: compShortage > 0 ? "Shortage" : "Available"
      });
    });

    const newWorkOrders = operationsNeeded.map((op, idx) => ({
      id: `wo_${newMoId}_${idx}`,
      manufacturing_order_id: newMoId,
      operation_name: op.operation_name,
      sequence: op.sequence,
      work_center_id: op.work_center_id,
      status: "Pending",
      started_at: null,
      completed_at: null
    }));

    const newMo = {
      id: newMoId,
      order_number: newMoNumber,
      product_id: productId,
      bom_id: bomId,
      quantity_to_produce: qtyToProduce,
      status: "Draft",
      source: "Manual",
      assignee_id: null,
      created_at: new Date().toISOString(),
      components: newMoComponents,
      reference_type: "Manual",
      reference_id: null,
      reference_number: null
    };

    set({
      products: updatedProducts,
      manufacturingOrders: [...state.manufacturingOrders, newMo],
      workOrders: [...state.workOrders, ...newWorkOrders]
    });

    get().addAuditLog("ManufacturingOrder", newMoId, "Created", "Draft", newMoNumber);

    // Trigger procurement automation for shortages
    bomLinesNeeded.forEach(bl => {
      const comp = get().products.find(p => p.id === bl.component_product_id);
      if (!comp) return;

      const qtyNeeded = bl.quantity_required * qtyToProduce;
      const moCompInfo = newMoComponents.find(c => c.component_product_id === comp.id);
      const prevReserved = comp.reserved_qty - (moCompInfo ? moCompInfo.quantity_reserved : 0);
      const freeToUseBeforeMo = comp.on_hand_qty - prevReserved;
      const compShortage = Math.max(0, qtyNeeded - freeToUseBeforeMo);

      if (compShortage > 0 && comp.procure_on_demand) {
        runProcurementAutomation(get, set, comp, compShortage, "ManufacturingOrder", newMoId, newMoNumber);
      }
    });

    return newMoId;
  },

  confirmManufacturingOrder: (moId) => {
    const state = get();
    const moIndex = state.manufacturingOrders.findIndex(mo => mo.id === moId);
    if (moIndex === -1) return;
    const mo = state.manufacturingOrders[moIndex];

    const updatedOrders = state.manufacturingOrders.map(o => 
      o.id === moId ? { ...o, status: "InProgress" } : o
    );

    set({ manufacturingOrders: updatedOrders });
    get().addAuditLog("ManufacturingOrder", moId, "StatusChanged", mo.status, "InProgress");
  },

  startWorkOrder: (woId) => {
    const state = get();
    const woIdx = state.workOrders.findIndex(w => w.id === woId);
    if (woIdx === -1) return;
    const wo = state.workOrders[woIdx];

    const moId = wo.manufacturing_order_id;
    const mo = state.manufacturingOrders.find(o => o.id === moId);
    if (!mo) return;

    // Enforce sequence: cannot start step N if N-1 is not Done
    const allWosForMo = state.workOrders.filter(w => w.manufacturing_order_id === moId).sort((a, b) => a.sequence - b.sequence);
    const stepIndex = allWosForMo.findIndex(w => w.id === woId);

    if (stepIndex > 0) {
      const prevStep = allWosForMo[stepIndex - 1];
      if (prevStep.status !== "Done") {
        throw new Error(`Enforce sequence error: Step '${wo.operation_name}' cannot be started until previous step '${prevStep.operation_name}' is completed.`);
      }
    }

    // Update Work Order Status to InProgress
    const updatedWos = state.workOrders.map(w => 
      w.id === woId ? { ...w, status: "InProgress", started_at: new Date().toISOString() } : w
    );

    // Update Manufacturing Order Status to InProgress if Draft
    const updatedMos = state.manufacturingOrders.map(o => 
      o.id === moId && o.status === "Draft" ? { ...o, status: "InProgress" } : o
    );

    set({
      workOrders: updatedWos,
      manufacturingOrders: updatedMos
    });

    get().addAuditLog("WorkOrder", woId, "StatusChanged", wo.status, "InProgress");
  },

  completeWorkOrder: (woId) => {
    const state = get();
    const woIdx = state.workOrders.findIndex(w => w.id === woId);
    if (woIdx === -1) return;
    const wo = state.workOrders[woIdx];

    if (wo.status !== "InProgress") return;

    const moId = wo.manufacturing_order_id;

    // Update Work Order to Done
    const updatedWos = state.workOrders.map(w => 
      w.id === woId ? { ...w, status: "Done", completed_at: new Date().toISOString() } : w
    );

    set({ workOrders: updatedWos });
    get().addAuditLog("WorkOrder", woId, "StatusChanged", wo.status, "Done");

    // Check if all work orders are now completed
    const allMoWos = updatedWos.filter(w => w.manufacturing_order_id === moId);
    const allCompleted = allMoWos.every(w => w.status === "Done");

    if (allCompleted) {
      // Auto-trigger completion of MO
      get().completeManufacturingOrder(moId);
    }
  },

  completeManufacturingOrder: (moId) => {
    const state = get();
    const moIdx = state.manufacturingOrders.findIndex(m => m.id === moId);
    if (moIdx === -1) return;
    const mo = state.manufacturingOrders[moIdx];

    if (mo.status === "Completed" || mo.status === "Cancelled") return;

    // Verify all Work Orders are Done
    const wos = state.workOrders.filter(w => w.manufacturing_order_id === moId);
    const allDone = wos.every(w => w.status === "Done");
    if (!allDone) {
      throw new Error("Cannot complete Manufacturing Order while some work orders are still pending or in progress.");
    }

    let updatedProducts = [...state.products];
    const newLedgerEntries = [];

    // 1. Deduct component stocks (consumes component)
    mo.components.forEach(compLine => {
      const compIdx = updatedProducts.findIndex(p => p.id === compLine.component_product_id);
      if (compIdx === -1) return;
      const comp = updatedProducts[compIdx];

      const consumedQty = compLine.quantity_required; // or amount actually reserved
      const nextOnHand = comp.on_hand_qty - consumedQty;
      const nextReserved = Math.max(0, comp.reserved_qty - compLine.quantity_reserved);

      updatedProducts[compIdx] = {
        ...comp,
        on_hand_qty: nextOnHand,
        reserved_qty: nextReserved
      };

      newLedgerEntries.push({
        id: `sl_${Date.now()}_consume_${comp.id}`,
        product_id: comp.id,
        change_qty: -consumedQty,
        reason: "ManufacturingConsume",
        reference_type: "ManufacturingOrder",
        reference_id: moId,
        resulting_on_hand_qty: nextOnHand,
        created_at: new Date().toISOString(),
        created_by: state.currentRole
      });
    });

    // 2. Increment finished good stock (produces finished good)
    const fgIdx = updatedProducts.findIndex(p => p.id === mo.product_id);
    if (fgIdx !== -1) {
      const fg = updatedProducts[fgIdx];
      const addedQty = mo.quantity_to_produce;
      const nextOnHand = fg.on_hand_qty + addedQty;

      updatedProducts[fgIdx] = {
        ...fg,
        on_hand_qty: nextOnHand
      };

      newLedgerEntries.push({
        id: `sl_${Date.now()}_produce_${fg.id}`,
        product_id: fg.id,
        change_qty: addedQty,
        reason: "ManufacturingProduce",
        reference_type: "ManufacturingOrder",
        reference_id: moId,
        resulting_on_hand_qty: nextOnHand,
        created_at: new Date().toISOString(),
        created_by: state.currentRole
      });
    }

    const updatedMos = state.manufacturingOrders.map(o => 
      o.id === moId ? { ...o, status: "Completed", completed_at: new Date().toISOString() } : o
    );

    set({
      products: updatedProducts,
      manufacturingOrders: updatedMos,
      stockLedger: [...newLedgerEntries, ...state.stockLedger]
    });

    get().addAuditLog("ManufacturingOrder", moId, "StatusChanged", mo.status, "Completed");
  },

  cancelManufacturingOrder: (moId) => {
    const state = get();
    const moIdx = state.manufacturingOrders.findIndex(mo => mo.id === moId);
    if (moIdx === -1) return;
    const mo = state.manufacturingOrders[moIdx];

    let updatedProducts = [...state.products];
    // Release component reservations
    mo.components.forEach(compLine => {
      const compIdx = updatedProducts.findIndex(p => p.id === compLine.component_product_id);
      if (compIdx === -1) return;
      const comp = updatedProducts[compIdx];

      updatedProducts[compIdx] = {
        ...comp,
        reserved_qty: Math.max(0, comp.reserved_qty - compLine.quantity_reserved)
      };
    });

    const updatedMos = state.manufacturingOrders.map(o => 
      o.id === moId ? { ...o, status: "Cancelled" } : o
    );

    // Cancel all work orders that are not Done
    const updatedWos = state.workOrders.map(w => 
      w.manufacturing_order_id === moId && w.status !== "Done" ? { ...w, status: "Pending" } : w
    );

    set({
      products: updatedProducts,
      manufacturingOrders: updatedMos,
      workOrders: updatedWos
    });

    get().addAuditLog("ManufacturingOrder", moId, "StatusChanged", mo.status, "Cancelled");
  }
}));
