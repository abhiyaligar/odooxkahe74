import React, { useState } from 'react';
import { useErpStore } from '../store/erpStore';
import { SlideOver } from '../components/common/SlideOver';
import { 
  Plus, 
  Check, 
  AlertTriangle, 
  Calendar, 
  User, 
  DollarSign, 
  ShoppingBag, 
  PackageOpen,
  ArrowRight,
  TrendingDown
} from 'lucide-react';

export default function SalesOrders() {
  const { 
    salesOrders, 
    salesOrderLines, 
    products, 
    customers, 
    currentRole,
    createSalesOrder,
    confirmSalesOrder,
    deliverSalesOrderLine,
    cancelSalesOrder
  } = useErpStore();

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Create New Order Form States
  const [customerSelect, setCustomerSelect] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("2026-06-23T18:00");
  const [orderLines, setOrderLines] = useState([
    { product_id: "", quantity: 1, unit_price: 0 }
  ]);

  // Delivery transaction states
  const [deliveryInputs, setDeliveryInputs] = useState({});

  // Role check
  const canModify = currentRole === "SuperAdmin" || currentRole === "StoreAdmin" || currentRole === "SalesUser";

  // Filter Sales Orders based on search query
  const filteredOrders = salesOrders.filter(so => {
    const customer = customers.find(c => c.id === so.customer_id);
    return so.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (customer && customer.name.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const getOrderTotal = (soId) => {
    const lines = salesOrderLines.filter(l => l.sales_order_id === soId);
    return lines.reduce((sum, line) => sum + (line.quantity_ordered * line.unit_price), 0);
  };

  const getOrderItemCount = (soId) => {
    const lines = salesOrderLines.filter(l => l.sales_order_id === soId);
    return lines.reduce((sum, line) => sum + line.quantity_ordered, 0);
  };

  const handleRowClick = (so) => {
    setSelectedOrder(so);
    setIsCreating(false);
    
    // Reset delivery inputs
    const lines = salesOrderLines.filter(l => l.sales_order_id === so.id);
    const initialInputs = {};
    lines.forEach(l => {
      initialInputs[l.id] = l.quantity_ordered - l.quantity_delivered;
    });
    setDeliveryInputs(initialInputs);
    
    setIsSlideOverOpen(true);
  };

  const handleNewClick = () => {
    if (!canModify) return;
    setIsCreating(true);
    setSelectedOrder(null);
    setCustomerSelect(customers[0]?.id || "");
    setOrderLines([{ product_id: products[0]?.id || "", quantity: 1, unit_price: products[0]?.sales_price || 0 }]);
    setIsSlideOverOpen(true);
  };

  const handleAddLine = () => {
    const defaultProduct = products[0];
    setOrderLines([
      ...orderLines,
      { product_id: defaultProduct?.id || "", quantity: 1, unit_price: defaultProduct?.sales_price || 0 }
    ]);
  };

  const handleRemoveLine = (idx) => {
    setOrderLines(orderLines.filter((_, i) => i !== idx));
  };

  const handleLineProductChange = (idx, prodId) => {
    const product = products.find(p => p.id === prodId);
    const updated = [...orderLines];
    updated[idx] = {
      ...updated[idx],
      product_id: prodId,
      unit_price: product ? product.sales_price : 0
    };
    setOrderLines(updated);
  };

  const handleLineQtyChange = (idx, qty) => {
    const updated = [...orderLines];
    updated[idx] = { ...updated[idx], quantity: Math.max(1, Number(qty)) };
    setOrderLines(updated);
  };

  const handleLinePriceChange = (idx, price) => {
    const updated = [...orderLines];
    updated[idx] = { ...updated[idx], unit_price: Math.max(0, Number(price)) };
    setOrderLines(updated);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!canModify) return;

    if (orderLines.some(l => !l.product_id)) {
      alert("Please select a product for all lines.");
      return;
    }

    const soId = createSalesOrder(customerSelect, new Date(deliveryDate).toISOString(), orderLines);
    setIsSlideOverOpen(false);
    
    // Open the newly created order's details
    const state = useErpStore.getState();
    const createdSo = state.salesOrders.find(o => o.id === soId);
    if (createdSo) {
      handleRowClick(createdSo);
    }
  };

  const handleConfirm = () => {
    if (!canModify || !selectedOrder) return;
    confirmSalesOrder(selectedOrder.id);
    // Refresh local selected order reference
    const state = useErpStore.getState();
    setSelectedOrder(state.salesOrders.find(o => o.id === selectedOrder.id));
  };

  const handleCancel = () => {
    if (!canModify || !selectedOrder) return;
    if (window.confirm("Are you sure you want to cancel this Sales Order? All reserved stock will be released.")) {
      cancelSalesOrder(selectedOrder.id);
      const state = useErpStore.getState();
      setSelectedOrder(state.salesOrders.find(o => o.id === selectedOrder.id));
    }
  };

  const handleDeliver = (lineId) => {
    if (!canModify || !selectedOrder) return;
    const qty = Number(deliveryInputs[lineId] || 0);
    try {
      deliverSalesOrderLine(selectedOrder.id, lineId, qty);
      // Refresh local references
      const state = useErpStore.getState();
      setSelectedOrder(state.salesOrders.find(o => o.id === selectedOrder.id));
      
      // Update input placeholder to reflect remaining qty
      const updatedLine = state.salesOrderLines.find(l => l.id === lineId);
      if (updatedLine) {
        setDeliveryInputs(prev => ({
          ...prev,
          [lineId]: updatedLine.quantity_ordered - updatedLine.quantity_delivered
        }));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Helper to compute pre-confirmation stock shortage status
  const calculateShortageDetails = (linesList) => {
    return linesList.map(line => {
      const product = products.find(p => p.id === line.product_id);
      if (!product) return null;
      
      const freeToUse = product.on_hand_qty - product.reserved_qty;
      const needed = Number(line.quantity_ordered || line.quantity || 0);
      const shortage = Math.max(0, needed - freeToUse);

      return {
        product,
        needed,
        freeToUse,
        shortage,
        route: product.procurement_type,
        procureActive: product.procure_on_demand
      };
    }).filter(Boolean);
  };

  const getShortageStatus = (soStatus) => {
    if (soStatus === "Draft") {
      const lines = salesOrderLines.filter(l => l.sales_order_id === selectedOrder?.id);
      return calculateShortageDetails(lines);
    }
    return [];
  };

  const activeShortages = selectedOrder ? getShortageStatus(selectedOrder.status) : [];
  const hasShortages = activeShortages.some(s => s.shortage > 0);

  // Stepper Stage Helpers
  const renderStepper = (status) => {
    if (status === "Cancelled") {
      return (
        <div className="flex items-center justify-center p-3 bg-statusRed/10 border border-statusRed/20 text-statusRed rounded-custom text-xs font-semibold uppercase tracking-wider font-mono">
          Cancelled: Order Voided
        </div>
      );
    }

    const stages = [
      { key: "Draft", label: "Draft" },
      { key: "Confirmed", label: "Confirmed" },
      { key: "Delivered", label: "Delivered" }
    ];

    const currentStageIdx = 
      status === "Draft" ? 0 : 
      status === "Confirmed" || status === "PartiallyDelivered" ? 1 : 
      status === "FullyDelivered" ? 2 : 0;

    return (
      <div className="flex items-center justify-between w-full px-6 py-4 bg-card border border-border rounded-custom">
        {stages.map((stage, idx) => {
          const isCompleted = idx < currentStageIdx;
          const isActive = idx === currentStageIdx;
          const isFuture = idx > currentStageIdx;

          return (
            <React.Fragment key={stage.key}>
              <div className="flex items-center space-x-2">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all duration-150 ${
                  isActive ? 'bg-accent text-background border border-accent' :
                  isCompleted ? 'bg-elevated text-textSecondary border border-border' :
                  'bg-background text-textMuted border border-border'
                }`}>
                  {isCompleted ? <Check size={12} strokeWidth={3} className="text-textSecondary" /> : (idx + 1)}
                </div>
                <span className={`text-xs font-semibold tracking-wide ${
                  isActive ? 'text-textPrimary' : 
                  isCompleted ? 'text-textSecondary font-medium' : 
                  'text-textMuted'
                }`}>
                  {stage.key === "Delivered" && status === "PartiallyDelivered" ? "Partially Shipped" : stage.label}
                </span>
              </div>
              {idx < stages.length - 1 && (
                <div className="flex-1 h-[1px] bg-border mx-4" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search and Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="Search orders (Order # or Customer)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-custom py-1.5 px-3 text-xs focus:outline-none"
          />
        </div>

        {canModify && (
          <button
            onClick={handleNewClick}
            className="flex items-center space-x-1.5 bg-accent hover:bg-accent/90 text-background rounded-custom px-4 py-2 text-xs font-semibold transition-all duration-150 shrink-0 shadow-lg"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>New Sales Order</span>
          </button>
        )}
      </div>

      {/* Orders List Table */}
      <div className="w-full border border-border bg-card rounded-custom overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-elevated/40 border-b border-border text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              <th className="py-3 px-4">Order#</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Date Created</th>
              <th className="py-3 px-4">Expected Delivery</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Items Count</th>
              <th className="py-3 px-4 text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-textMuted font-mono">
                  No sales orders found. Click "+ New Sales Order" to start a commercial transaction.
                </td>
              </tr>
            ) : (
              filteredOrders.map((so) => {
                const customer = customers.find(c => c.id === so.customer_id);
                const itemsCount = getOrderItemCount(so.id);
                const total = getOrderTotal(so.id);
                
                return (
                  <tr 
                    key={so.id}
                    onClick={() => handleRowClick(so)}
                    className="hover:bg-elevated/30 cursor-pointer transition-colors duration-150"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-textPrimary">{so.order_number}</td>
                    <td className="py-3 px-4 text-textSecondary">{customer ? customer.name : 'Unknown'}</td>
                    <td className="py-3 px-4 text-textSecondary">{new Date(so.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-textSecondary">{new Date(so.expected_delivery_date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block text-[9px] font-mono font-bold uppercase rounded-full px-2.5 py-0.5 tracking-wider border ${
                        so.status === "Draft" ? 'border-border text-textSecondary bg-elevated/30' :
                        so.status === "Confirmed" ? 'border-statusAmber/40 text-statusAmber bg-statusAmber/5' :
                        so.status === "PartiallyDelivered" ? 'border-statusAmber/40 text-statusAmber bg-statusAmber/5' :
                        so.status === "FullyDelivered" ? 'border-statusGreen/40 text-statusGreen bg-statusGreen/5' :
                        'border-statusRed/40 text-statusRed bg-statusRed/5'
                      }`}>
                        {so.status === "PartiallyDelivered" ? "Part Shipped" : 
                         so.status === "FullyDelivered" ? "Shipped" : so.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-textSecondary">{itemsCount}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">${total.toFixed(2)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Slide-over Panel */}
      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        title={isCreating ? "Create Sales Order" : `Sales Order Details: ${selectedOrder?.order_number}`}
        subtitle={isCreating ? "Initialize a new commercial sales flow" : `Customer ID: ${selectedOrder?.customer_id}`}
      >
        {isCreating ? (
          /* CREATE SALES ORDER FORM */
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1.5">
                <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Select Customer</label>
                <select 
                  value={customerSelect} 
                  onChange={(e) => setCustomerSelect(e.target.value)}
                  required
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Expected Delivery Date</label>
                <input 
                  type="datetime-local" 
                  value={deliveryDate} 
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  required
                  className="font-mono text-xs"
                />
              </div>
            </div>

            {/* Form Order Lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-textSecondary">Order Line Items</span>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="text-[10px] bg-elevated hover:bg-card border border-border text-textPrimary px-2.5 py-1 rounded-custom font-semibold transition-all duration-150"
                >
                  + Add Line
                </button>
              </div>

              <div className="space-y-2">
                {orderLines.map((line, idx) => (
                  <div key={idx} className="flex items-center space-x-2 bg-card/25 p-2 border border-border rounded-custom">
                    {/* Pick Product */}
                    <div className="flex-1">
                      <select
                        value={line.product_id}
                        onChange={(e) => handleLineProductChange(idx, e.target.value)}
                        className="w-full text-xs"
                        required
                      >
                        <option value="">Select Product...</option>
                        {products.filter(p => p.type === "FinishedGood").map(p => (
                          <option key={p.id} value={p.id}>{p.name} (${p.sales_price})</option>
                        ))}
                      </select>
                    </div>

                    {/* Qty */}
                    <div className="w-20">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) => handleLineQtyChange(idx, e.target.value)}
                        className="w-full text-xs font-mono text-center"
                        required
                      />
                    </div>

                    {/* Price */}
                    <div className="w-28">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Price ($)"
                        value={line.unit_price}
                        onChange={(e) => handleLinePriceChange(idx, e.target.value)}
                        className="w-full text-xs font-mono"
                        required
                      />
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      disabled={orderLines.length === 1}
                      className="text-textMuted hover:text-statusRed disabled:opacity-40 p-1.5 rounded"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Live pre-save Stock Check visualizer */}
            <div className="p-4 border border-border bg-card/20 rounded-custom space-y-2">
              <span className="text-[10px] font-bold text-textSecondary uppercase tracking-wider block">Live Stock Check (Pre-Save Simulation)</span>
              <div className="divide-y divide-border/60">
                {calculateShortageDetails(orderLines).map((detail, idx) => {
                  if (!detail.product) return null;
                  return (
                    <div key={idx} className="py-2 flex items-center justify-between text-xs font-mono">
                      <span className="text-textPrimary">{detail.product.name} (Qty: {detail.needed})</span>
                      <div className="flex items-center space-x-1.5">
                        {detail.shortage > 0 ? (
                          <>
                            <span className="text-statusRed flex items-center"><TrendingDown size={11} className="mr-0.5" /> -{detail.shortage} Short</span>
                            <span className="text-[10px] text-textMuted bg-elevated px-1.5 py-0.5 rounded">
                              {detail.procureActive ? `Auto-${detail.route}` : 'Needs Manual Resolving'}
                            </span>
                          </>
                        ) : (
                          <span className="text-statusGreen flex items-center"><Check size={11} className="mr-0.5" /> Stock OK (Free: {detail.freeToUse})</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-border flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsSlideOverOpen(false)}
                className="bg-card hover:bg-elevated border border-border text-textPrimary text-xs rounded-custom py-2 px-4 font-semibold transition-all duration-150"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-accent hover:bg-accent/90 text-background text-xs rounded-custom py-2 px-6 font-semibold transition-all duration-150"
              >
                Save Draft Order
              </button>
            </div>
          </form>
        ) : (
          /* VIEW & ACT ON EXISTING ORDER */
          selectedOrder && (
            <div className="space-y-6">
              {/* Stepper */}
              {renderStepper(selectedOrder.status)}

              {/* Order Meta Data */}
              <div className="bg-card border border-border rounded-custom p-4 grid grid-cols-2 gap-4 text-xs">
                <div className="flex items-center space-x-3">
                  <User size={16} className="text-textMuted" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-textMuted font-semibold uppercase">Customer</span>
                    <span className="font-medium text-textPrimary">
                      {customers.find(c => c.id === selectedOrder.customer_id)?.name || 'Unknown'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Calendar size={16} className="text-textMuted" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-textMuted font-semibold uppercase">Delivery Promise</span>
                    <span className="font-medium text-textPrimary font-mono">
                      {new Date(selectedOrder.expected_delivery_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Line Items Detail Table */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-textSecondary block">Ordered Line Items</span>
                <div className="border border-border bg-card rounded-custom overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-elevated/40 border-b border-border text-[10px] font-semibold text-textSecondary uppercase tracking-wider">
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-right">Delivered</th>
                        <th className="py-2.5 px-3 text-right">Price</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {salesOrderLines
                        .filter(l => l.sales_order_id === selectedOrder.id)
                        .map(line => {
                          const prod = products.find(p => p.id === line.product_id);
                          return (
                            <tr key={line.id} className="hover:bg-elevated/10">
                              <td className="py-2 px-3 text-textPrimary font-sans font-medium">{prod?.name || 'Unknown'}</td>
                              <td className="py-2 px-3 text-right">{line.quantity_ordered}</td>
                              <td className="py-2 px-3 text-right text-textSecondary">{line.quantity_delivered}</td>
                              <td className="py-2 px-3 text-right text-textSecondary">${line.unit_price.toFixed(2)}</td>
                              <td className="py-2 px-3 text-right text-textPrimary font-bold">
                                ${(line.quantity_ordered * line.unit_price).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pre-Confirmation Stock Check Panel (For Draft Orders Only) */}
              {selectedOrder.status === "Draft" && (
                <div className="border border-border rounded-custom p-4 bg-card/10 space-y-3">
                  <div className="flex items-center space-x-2 text-textSecondary border-b border-border/60 pb-2">
                    <ShoppingBag size={14} className="text-textSecondary" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Stock Pre-Confirmation Review</span>
                  </div>

                  <div className="space-y-2">
                    {activeShortages.map((detail, idx) => (
                      <div key={idx} className="flex flex-col space-y-1 text-xs">
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-textPrimary font-semibold">{detail.product.name}</span>
                          <span className="text-textSecondary">Ordered: {detail.needed} | Free-to-use: {detail.freeToUse}</span>
                        </div>

                        {detail.shortage > 0 ? (
                          <div className="flex items-center space-x-1.5 text-[11px] text-statusAmber pl-2 border-l border-statusAmber/40 py-0.5">
                            <AlertTriangle size={12} className="text-statusAmber flex-shrink-0" />
                            <span>
                              {detail.procureActive 
                                ? `Shortage of ${detail.shortage} units will auto-trigger a ${detail.route} Order (Draft).`
                                : `Shortage of ${detail.shortage} units. No auto-replenishment configured.`
                              }
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1.5 text-[11px] text-statusGreen pl-2 border-l border-statusGreen/40 py-0.5">
                            <Check size={12} className="text-statusGreen flex-shrink-0" />
                            <span>Stock allocated successfully. Sufficient inventory free-to-use.</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fulfillment delivery inputs panel (For Confirmed or PartiallyDelivered Orders) */}
              {(selectedOrder.status === "Confirmed" || selectedOrder.status === "PartiallyDelivered") && (
                <div className="border border-border rounded-custom p-4 bg-card/10 space-y-3">
                  <div className="flex items-center space-x-2 text-textSecondary border-b border-border/60 pb-2">
                    <PackageOpen size={14} className="text-textSecondary" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Ship / Register Deliveries</span>
                  </div>

                  <div className="space-y-3">
                    {salesOrderLines
                      .filter(l => l.sales_order_id === selectedOrder.id)
                      .map(line => {
                        const prod = products.find(p => p.id === line.product_id);
                        const remaining = line.quantity_ordered - line.quantity_delivered;
                        
                        if (remaining <= 0) return null;
                        
                        // Check if we have on-hand items to ship
                        const onHandAvailable = prod ? prod.on_hand_qty : 0;
                        const maxShip = Math.min(remaining, onHandAvailable);

                        return (
                          <div key={line.id} className="flex items-center justify-between text-xs">
                            <div className="flex flex-col">
                              <span className="font-semibold text-textPrimary">{prod?.name}</span>
                              <span className="text-[10px] text-textMuted font-mono">
                                Awaiting: {remaining} unit(s) (Physical Stock: {onHandAvailable})
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min="1"
                                max={maxShip}
                                value={deliveryInputs[line.id] || 0}
                                onChange={(e) => setDeliveryInputs({
                                  ...deliveryInputs,
                                  [line.id]: Math.min(maxShip, Math.max(1, Number(e.target.value)))
                                })}
                                disabled={maxShip <= 0 || !canModify}
                                className="w-16 font-mono text-center py-1 text-xs"
                              />
                              <button
                                type="button"
                                disabled={maxShip <= 0 || !canModify}
                                onClick={() => handleDeliver(line.id)}
                                className="bg-elevated hover:bg-card border border-border text-textPrimary text-[11px] rounded-custom px-3 py-1 font-semibold disabled:opacity-40 disabled:hover:bg-elevated transition-all duration-150 font-mono"
                              >
                                Ship
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    {salesOrderLines
                      .filter(l => l.sales_order_id === selectedOrder.id)
                      .every(l => l.quantity_ordered === l.quantity_delivered) && (
                        <p className="text-[11px] text-statusGreen italic text-center font-semibold">All items have been successfully delivered to the customer.</p>
                      )}
                  </div>
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                {canModify && selectedOrder.status === "Draft" && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="hover:text-statusRed text-xs text-textMuted py-2 transition-colors duration-150"
                  >
                    Void Order
                  </button>
                )}

                <div className="flex items-center space-x-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsSlideOverOpen(false)}
                    className="bg-card hover:bg-elevated border border-border text-textPrimary text-xs rounded-custom py-2 px-4 font-semibold transition-all duration-150"
                  >
                    Close Panel
                  </button>
                  
                  {canModify && selectedOrder.status === "Draft" && (
                    <button
                      type="button"
                      onClick={handleConfirm}
                      className="bg-accent hover:bg-accent/90 text-background text-xs rounded-custom py-2 px-6 font-semibold transition-all duration-150"
                    >
                      Confirm Order
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </SlideOver>
    </div>
  );
}
