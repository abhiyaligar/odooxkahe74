import React, { useState } from 'react';
import { useErpStore } from '../store/erpStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { SlideOver } from '../components/common/SlideOver';
import { 
  Plus, 
  Check, 
  ArrowRight, 
  Calendar, 
  User, 
  ShoppingCart, 
  PackageCheck,
  PackageOpen,
  TrendingUp,
  Filter,
  List,
  LayoutGrid
} from 'lucide-react';

export default function PurchaseOrders() {
  const queryClient = useQueryClient();

  const { 
    currentRole
  } = useErpStore();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products/')
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get('/vendors/')
  });

  const { data: purchaseOrders = [], refetch: refetchPos } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => api.get('/purchase-orders/')
  });

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("table"); // "table" or "grid"
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [vendorFilter, setVendorFilter] = useState("ALL");
  
  // Create Form States
  const [vendorSelect, setVendorSelect] = useState("");
  const [orderLines, setOrderLines] = useState([
    { product_id: "", quantity: 1, unit_cost: 0 }
  ]);

  // Receipts transaction states
  const [receiptInputs, setReceiptInputs] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('Wallet');

  // Role permissions check (Purchase User, Admin)
  const canModify = currentRole === "SuperAdmin" || currentRole === "StoreAdmin" || currentRole === "PurchaseUser";

  // Store wallet balance — shown as warning when confirming Wallet POs
  const STORE_WALLET_ID = '00000000-0000-0000-0000-000000000000';
  const { data: storeWallet } = useQuery({
    queryKey: ['wallet', STORE_WALLET_ID],
    queryFn: () => api.get(`/wallets/${STORE_WALLET_ID}`),
    enabled: canModify,
  });

  // Filter Purchase Orders
  const filteredOrders = purchaseOrders.filter(po => {
    const vendor = vendors.find(v => v.id === po.vendor_id);
    const matchesSearch = po.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (vendor && vendor.name.toLowerCase().includes(searchQuery.toLowerCase()));
           
    const matchesStatus = statusFilter === "ALL" || po.status === statusFilter;
    const matchesVendor = vendorFilter === "ALL" || po.vendor_id === vendorFilter;
    
    return matchesSearch && matchesStatus && matchesVendor;
  });

  const getOrderTotal = (po) => {
    const lines = po?.lines || [];
    return lines.reduce((sum, line) => sum + (line.quantity_ordered * line.unit_cost), 0);
  };

  const getOrderItemCount = (po) => {
    const lines = po?.lines || [];
    return lines.reduce((sum, line) => sum + line.quantity_ordered, 0);
  };

  const createPoMutation = useMutation({
    mutationFn: (newPo) => api.post('/purchase-orders/', newPo),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      handleRowClick(data);
    },
    onError: (err) => alert("Failed to create order: " + err.message)
  });

  const confirmPoMutation = useMutation({
    mutationFn: (id) => api.post(`/purchase-orders/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      refetchPos().then(res => {
        if (selectedOrder && res.data) {
          setSelectedOrder(res.data.find(o => o.id === selectedOrder.id));
        }
      });
    },
    onError: (err) => alert("Failed to confirm order: " + err.message)
  });

  const receiveLineMutation = useMutation({
    mutationFn: ({ lineId, qty }) => api.post(`/purchase-orders/lines/${lineId}/receive`, { quantity_received: qty }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSelectedOrder(data);
      const updatedInputs = { ...receiptInputs };
      (data.lines || []).forEach(l => {
        updatedInputs[l.id] = l.quantity_ordered - l.quantity_received;
      });
      setReceiptInputs(updatedInputs);
    },
    onError: (err) => alert("Failed to receive goods: " + err.message)
  });

  const cancelPoMutation = useMutation({
    mutationFn: (id) => api.post(`/purchase-orders/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      refetchPos().then(res => {
        if (selectedOrder && res.data) {
          setSelectedOrder(res.data.find(o => o.id === selectedOrder.id));
        }
      });
    },
    onError: (err) => alert("Failed to cancel order: " + err.message)
  });

  const handleRowClick = (po) => {
    setSelectedOrder(po);
    setIsCreating(false);
    
    // Reset receipt inputs
    const lines = po.lines || [];
    const initialInputs = {};
    lines.forEach(l => {
      initialInputs[l.id] = l.quantity_ordered - l.quantity_received;
    });
    setReceiptInputs(initialInputs);
    
    setIsSlideOverOpen(true);
  };

  const handleNewClick = () => {
    if (!canModify) return;
    setIsCreating(true);
    setSelectedOrder(null);
    setVendorSelect(vendors[0]?.id || "");
    setPaymentMethod('Wallet');
    // Default to the first component/raw material
    const firstComp = products.find(p => p.type === "Component") || products[0];
    setOrderLines([{ product_id: firstComp?.id || "", quantity: 1, unit_cost: firstComp?.cost_price || 0 }]);
    setIsSlideOverOpen(true);
  };

  const handleAddLine = () => {
    const firstComp = products.find(p => p.type === "Component") || products[0];
    setOrderLines([
      ...orderLines,
      { product_id: firstComp?.id || "", quantity: 1, unit_cost: firstComp?.cost_price || 0 }
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
      unit_cost: product ? product.cost_price : 0
    };
    setOrderLines(updated);
  };

  const handleLineQtyChange = (idx, qty) => {
    const updated = [...orderLines];
    updated[idx] = { ...updated[idx], quantity: Math.max(1, Number(qty)) };
    setOrderLines(updated);
  };

  const handleLinePriceChange = (idx, cost) => {
    const updated = [...orderLines];
    updated[idx] = { ...updated[idx], unit_cost: Math.max(0, Math.round(Number(cost)) || 0) };
    setOrderLines(updated);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!canModify) return;

    if (orderLines.some(l => !l.product_id)) {
      alert("Please select a product for all lines.");
      return;
    }

    createPoMutation.mutate({
      vendor_id: vendorSelect,
      payment_method: paymentMethod,
      lines: orderLines.map(l => ({
        product_id: l.product_id,
        quantity_ordered: Number(l.quantity),
        unit_cost: Number(l.unit_cost)
      }))
    });
    setIsSlideOverOpen(false);
  };

  const handleConfirm = () => {
    if (!canModify || !selectedOrder) return;
    confirmPoMutation.mutate(selectedOrder.id);
  };

  const handleCancel = () => {
    if (!canModify || !selectedOrder) return;
    if (window.confirm("Are you sure you want to cancel this Purchase Order?")) {
      cancelPoMutation.mutate(selectedOrder.id);
    }
  };

  const handleReceive = (lineId) => {
    if (!canModify || !selectedOrder) return;
    const qty = Number(receiptInputs[lineId] || 0);
    receiveLineMutation.mutate({ lineId, qty });
  };

  // Stepper Stages for PO
  const renderStepper = (status) => {
    if (status === "Cancelled") {
      return (
        <div className="flex items-center justify-center p-3 bg-danger/10 border border-danger/20 text-danger rounded-custom text-xs font-semibold uppercase tracking-wider font-mono">
          Cancelled: Order Voided
        </div>
      );
    }

    const stages = [
      { key: "Draft", label: "Draft" },
      { key: "Confirmed", label: "Confirmed" },
      { key: "Received", label: "Received" }
    ];

    const currentStageIdx = 
      status === "Draft" ? 0 : 
      status === "Confirmed" || status === "PartiallyReceived" ? 1 : 
      status === "FullyReceived" ? 2 : 0;

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
                  {stage.key === "Received" && status === "PartiallyReceived" ? "Part Received" : stage.label}
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
      {/* Filters and Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="w-full sm:w-80">
            <input
              type="text"
              placeholder="Search purchases (Order # or Vendor)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-custom py-1.5 px-3 text-xs focus:outline-none"
            />
          </div>

          {/* View Switcher */}
          <div className="flex bg-elevated border border-border p-0.5 rounded-custom text-textSecondary shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="List View"
              className={`p-1.5 rounded-custom transition-all duration-150 ${
                viewMode === 'table'
                  ? 'bg-card text-textPrimary shadow-sm border border-border/40'
                  : 'hover:text-textPrimary border border-transparent'
              }`}
            >
              <List size={13} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-1.5 rounded-custom transition-all duration-150 ${
                viewMode === 'grid'
                  ? 'bg-card text-textPrimary shadow-sm border border-border/40'
                  : 'hover:text-textPrimary border border-transparent'
              }`}
            >
              <LayoutGrid size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {canModify && (
          <button
            onClick={handleNewClick}
            className="flex items-center space-x-1.5 bg-accent hover:bg-accent/90 text-background rounded-custom px-4 py-2 text-xs font-semibold transition-all duration-150 shrink-0 shadow-lg"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>New Purchase Order</span>
          </button>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status Filter */}
        <div className="relative min-w-[150px] bg-card flex items-center">
          <Filter className="absolute left-3 text-textMuted" size={12} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-background border border-border rounded-custom py-1.5 pl-8 pr-3 text-[11px] text-textPrimary focus:outline-none focus:border-accent appearance-none cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Confirmed">Confirmed</option>
            <option value="PartiallyReceived">Partially Received</option>
            <option value="FullyReceived">Received</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {/* Vendor Filter */}
        <div className="relative min-w-[180px] bg-card flex items-center">
          <Filter className="absolute left-3 text-textMuted" size={12} />
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="w-full bg-background border border-border rounded-custom py-1.5 pl-8 pr-3 text-[11px] text-textPrimary focus:outline-none focus:border-accent appearance-none cursor-pointer"
          >
            <option value="ALL">All Vendors</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Purchase List Table / Grid Wrapper */}
      {viewMode === "table" ? (
        <div className="w-full border border-border bg-card rounded-custom overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-elevated/40 border-b border-border text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                <th className="py-3 px-4">Order#</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Date Created</th>
                <th className="py-3 px-4 text-center">Source</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Items Count</th>
                <th className="py-3 px-4 text-right">Cost Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-textMuted font-mono">
                    No purchase orders found. Manual POs or auto-generated replenishment requests will list here.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((po) => {
                  const vendor = vendors.find(v => v.id === po.vendor_id);
                  const itemsCount = getOrderItemCount(po);
                  const total = getOrderTotal(po);
                  
                  return (
                    <tr 
                      key={po.id}
                      onClick={() => handleRowClick(po)}
                      className="hover:bg-elevated/30 cursor-pointer transition-colors duration-150"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-textPrimary">{po.order_number}</td>
                      <td className="py-3 px-4 text-textSecondary">{vendor ? vendor.name : 'Unknown'}</td>
                      <td className="py-3 px-4 text-textSecondary">{new Date(po.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded border border-border font-mono ${
                          po.source === "AutoGenerated" ? 'text-accent bg-elevated/50' : 'text-textSecondary'
                        }`}>
                          {po.source}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block text-[9px] font-mono font-bold uppercase rounded-full px-2.5 py-0.5 tracking-wider border ${
                          po.status === "Draft" ? 'border-border text-textSecondary bg-elevated/30' :
                          po.status === "Confirmed" ? 'border-warning/40 text-warning bg-warning/5' :
                          po.status === "PartiallyReceived" ? 'border-warning/40 text-warning bg-warning/5' :
                          po.status === "FullyReceived" ? 'border-success/40 text-success bg-success/5' :
                          'border-danger/40 text-danger bg-danger/5'
                        }`}>
                          {po.status === "PartiallyReceived" ? "Part Received" : 
                           po.status === "FullyReceived" ? "Received" : po.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-textSecondary">{itemsCount}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">₹{total.toFixed(2)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.length === 0 ? (
            <div className="col-span-full py-8 text-center text-textMuted font-mono bg-card border border-border rounded-custom">
              No purchase orders found. Manual POs or auto-generated replenishment requests will list here.
            </div>
          ) : (
            filteredOrders.map((po) => {
              const vendor = vendors.find(v => v.id === po.vendor_id);
              const itemsCount = getOrderItemCount(po);
              const total = getOrderTotal(po);

              return (
                <div
                  key={po.id}
                  onClick={() => handleRowClick(po)}
                  className="bg-card border border-border rounded-custom p-4 flex flex-col space-y-4 hover:border-textSecondary hover:shadow-md cursor-pointer transition-all duration-150"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-mono font-bold text-xs text-textPrimary">{po.order_number}</span>
                    <span className={`inline-block text-[9px] font-mono font-bold uppercase rounded-full px-2.5 py-0.5 tracking-wider border ${
                      po.status === "Draft" ? 'border-border text-textSecondary bg-elevated/30' :
                      po.status === "Confirmed" ? 'border-warning/40 text-warning bg-warning/5' :
                      po.status === "PartiallyReceived" ? 'border-warning/40 text-warning bg-warning/5' :
                      po.status === "FullyReceived" ? 'border-success/40 text-success bg-success/5' :
                      'border-danger/40 text-danger bg-danger/5'
                    }`}>
                      {po.status === "PartiallyReceived" ? "Part Received" : 
                       po.status === "FullyReceived" ? "Received" : po.status}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] text-textMuted font-bold uppercase tracking-wider">Vendor Partner</div>
                    <div className="text-xs font-semibold text-textPrimary">{vendor ? vendor.name : 'Unknown'}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-3">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-textMuted uppercase tracking-wide block">Created</span>
                      <span className="text-xs font-medium text-textSecondary font-mono">{new Date(po.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-textMuted uppercase tracking-wide block">Source Route</span>
                      <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded border border-border font-mono ${
                        po.source === "AutoGenerated" ? 'text-accent bg-elevated/50 border-accent/20' : 'text-textSecondary'
                      }`}>
                        {po.source}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 mt-auto">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-textMuted uppercase tracking-wide block">Items Count</span>
                      <span className="text-xs font-bold text-textSecondary font-mono">{itemsCount}</span>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <span className="text-[9px] text-textMuted uppercase tracking-wide block">Cost Total</span>
                      <span className="text-sm font-extrabold text-textPrimary font-mono">₹{total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Slide-over detail drawer */}
      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        title={isCreating ? "New Purchase Order" : `Purchase Order Details: ${selectedOrder?.order_number}`}
        subtitle={isCreating ? "Initialize a commercial vendor purchase request" : `Vendor ID: ${selectedOrder?.vendor_id}`}
      >
        {isCreating ? (
          /* CREATE PURCHASE ORDER */
          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex flex-col space-y-1.5">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Select Vendor</label>
              <select 
                value={vendorSelect} 
                onChange={(e) => setVendorSelect(e.target.value)}
                required
              >
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-background border border-border rounded-custom px-3 py-2 text-xs text-textPrimary focus:outline-none focus:border-accent"
              >
                <option value="Wallet">🏦 Store Wallet (Auto-debit on confirm)</option>
                <option value="Cash">💵 Cash</option>
                <option value="Razorpay">💳 Razorpay</option>
              </select>
              {paymentMethod === 'Wallet' && storeWallet && (
                <p className="text-[10px] text-textSecondary mt-1">
                  Store Wallet Balance: <span className="font-semibold text-accent">₹{Number(storeWallet.balance).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </p>
              )}
            </div>

            {/* Order lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-textSecondary">Purchase Line Items</span>
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
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} (Cost: ${p.cost_price})</option>
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

                    {/* Cost */}
                    <div className="w-28">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Cost ($)"
                        value={line.unit_cost}
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
                      className="text-textMuted hover:text-danger disabled:opacity-40 p-1.5 rounded"
                    >
                      &times;
                    </button>
                  </div>
                ))}
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
                Save Draft PO
              </button>
            </div>
          </form>
        ) : (
          /* VIEW & UPDATE EXISTING PO */
          selectedOrder && (
            <div className="space-y-6">
              {/* Stepper */}
              {renderStepper(selectedOrder.status)}

              {/* Order Meta Data */}
              <div className="bg-card border border-border rounded-custom p-4 grid grid-cols-2 gap-4 text-xs">
                <div className="flex items-center space-x-3">
                  <User size={16} className="text-textMuted" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-textMuted font-semibold uppercase">Vendor Partner</span>
                    <span className="font-medium text-textPrimary">
                      {vendors.find(v => v.id === selectedOrder.vendor_id)?.name || 'Unknown'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Calendar size={16} className="text-textMuted" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-textMuted font-semibold uppercase">Date Launched</span>
                    <span className="font-medium text-textPrimary font-mono">
                      {new Date(selectedOrder.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Payment method + status */}
                <div className="flex items-center space-x-3">
                  <ShoppingCart size={16} className="text-textMuted" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-textMuted font-semibold uppercase">Payment Method</span>
                    <span className="font-medium text-textPrimary">{selectedOrder.payment_method ?? '—'}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <TrendingUp size={16} className="text-textMuted" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-textMuted font-semibold uppercase">Payment Status</span>
                    <span className={`font-semibold ${
                      selectedOrder.payment_status === 'Paid' ? 'text-green-400' :
                      selectedOrder.payment_status === 'PartiallyPaid' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {selectedOrder.payment_status ?? 'Unpaid'}
                      {selectedOrder.payment_status === 'Paid' && selectedOrder.payment_method === 'Wallet' && ' ✓ Auto-debited'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Wallet balance warning for Draft Wallet POs */}
              {selectedOrder.status === 'Draft' && selectedOrder.payment_method === 'Wallet' && storeWallet && (() => {
                const total = getOrderTotal(selectedOrder);
                const insufficient = storeWallet.balance < total;
                return (
                  <div className={`flex items-start gap-2 p-3 rounded-custom border text-xs ${
                    insufficient
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-green-500/10 border-green-500/30 text-green-400'
                  }`}>
                    <span className="text-base">{insufficient ? '⚠️' : '✅'}</span>
                    <div>
                      <p className="font-semibold">
                        {insufficient ? 'Insufficient Store Wallet Balance' : 'Store Wallet Funded'}
                      </p>
                      <p className="text-[10px] mt-0.5">
                        Order total: <strong>₹{total.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong> &nbsp;·&nbsp;
                        Wallet balance: <strong>₹{Number(storeWallet.balance).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong>
                        {insufficient && ' — Top-up the store wallet before confirming.'}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Order Lines table */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-textSecondary block">Ordered Line Items</span>
                <div className="border border-border bg-card rounded-custom overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-elevated/40 border-b border-border text-[10px] font-semibold text-textSecondary uppercase tracking-wider">
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3 text-right">Qty Ordered</th>
                        <th className="py-2.5 px-3 text-right">Qty Received</th>
                        <th className="py-2.5 px-3 text-right">Cost Price</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(selectedOrder.lines || []).map(line => {
                        const prod = products.find(p => p.id === line.product_id);
                        return (
                          <tr key={line.id} className="hover:bg-elevated/10">
                            <td className="py-2 px-3 text-textPrimary font-sans font-medium">{prod?.name || 'Unknown'}</td>
                            <td className="py-2 px-3 text-right">{line.quantity_ordered}</td>
                            <td className="py-2 px-3 text-right text-textSecondary">{line.quantity_received}</td>
                            <td className="py-2 px-3 text-right text-textSecondary">${line.unit_cost.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-textPrimary font-bold">
                              ${(line.quantity_ordered * line.unit_cost).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Receipt Action & Live Stock Delta Visualization */}
              {(selectedOrder.status === "Confirmed" || selectedOrder.status === "PartiallyReceived") && (
                <div className="border border-border rounded-custom p-4 bg-card/10 space-y-4">
                  <div className="flex items-center space-x-2 text-textSecondary border-b border-border/60 pb-2">
                    <PackageOpen size={14} className="text-textSecondary" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Register Receipts & Stock Delta Preview</span>
                  </div>

                  <div className="space-y-4">
                    {(selectedOrder.lines || []).map(line => {
                      const prod = products.find(p => p.id === line.product_id);
                      const remaining = line.quantity_ordered - line.quantity_received;
                      
                      if (remaining <= 0) return null;

                      const inputVal = Number(receiptInputs[line.id] || 0);
                      const currentStock = prod ? prod.on_hand_qty : 0;
                      const targetStock = currentStock + inputVal;

                      return (
                        <div key={line.id} className="space-y-2 border-b border-border/40 pb-3 last:border-0 last:pb-0">
                          {/* Input control */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex flex-col">
                              <span className="font-semibold text-textPrimary">{prod?.name}</span>
                              <span className="text-[10px] text-textMuted font-mono">
                                Remaining: {remaining} unit(s)
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min="1"
                                max={remaining}
                                value={receiptInputs[line.id] || 0}
                                onChange={(e) => setReceiptInputs({
                                  ...receiptInputs,
                                  [line.id]: Math.min(remaining, Math.max(1, Number(e.target.value)))
                                })}
                                disabled={!canModify}
                                className="w-16 font-mono text-center py-1 text-xs"
                              />
                              <button
                                type="button"
                                disabled={!canModify}
                                onClick={() => handleReceive(line.id)}
                                className="bg-elevated hover:bg-card border border-border text-textPrimary text-[11px] rounded-custom px-3 py-1 font-semibold transition-all duration-150 font-mono"
                              >
                                Receive
                              </button>
                            </div>
                          </div>

                          {/* Stock delta visualizer */}
                          {inputVal > 0 && prod && (
                            <div className="bg-card border border-border p-2 rounded text-[10px] font-mono text-textSecondary flex items-center space-x-2 justify-center">
                              <span>Stock Delta: {currentStock} on hand</span>
                              <ArrowRight size={10} />
                              <span className="text-success font-bold">+{inputVal} received</span>
                              <ArrowRight size={10} />
                              <span className="text-textPrimary font-bold">{targetStock} resulting</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {(selectedOrder.lines || []).every(l => l.quantity_ordered === l.quantity_received) && (
                      <p className="text-[11px] text-success italic text-center font-semibold">All products have been received from the vendor and logged into stock.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                {canModify && selectedOrder.status !== "FullyReceived" && selectedOrder.status !== "Cancelled" && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="hover:text-danger text-xs text-textMuted py-2 transition-colors duration-150"
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
