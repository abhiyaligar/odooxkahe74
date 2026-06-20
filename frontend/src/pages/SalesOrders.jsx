import React, { useState, useEffect } from 'react';
import { useErpStore } from '../store/erpStore';
import { SlideOver } from '../components/common/SlideOver';
import { 
  Plus, 
  Check, 
  AlertTriangle, 
  Calendar, 
  User, 
  ShoppingBag, 
  PackageOpen,
  TrendingDown,
  Loader2,
  Filter
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export default function SalesOrders() {
  const queryClient = useQueryClient();
  const { currentRole } = useErpStore();

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customerFilter, setCustomerFilter] = useState("ALL");
  
  // Create New Order Form States
  const [customerSelect, setCustomerSelect] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("2026-06-23T18:00");
  const [orderLines, setOrderLines] = useState([
    { product_id: "", quantity_ordered: 1, unit_price: 0 }
  ]);

  // Role check
  const canModify = currentRole === "SuperAdmin" || currentRole === "StoreAdmin" || currentRole === "SalesUser";

  // Fetch data
  const { data: salesOrders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ['salesOrders'],
    queryFn: () => api.get('/sales-orders/')
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products/')
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers/')
  });

  // Mutations
  const createSalesOrderMutation = useMutation({
    mutationFn: (newOrder) => api.post('/sales-orders/', newOrder),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      setIsCreating(false);
      setSelectedOrder(data); // Stay open to view confirmed details
    },
    onError: (err) => alert("Failed to create sales order: " + err.message)
  });

  const confirmSalesOrderMutation = useMutation({
    mutationFn: (id) => api.post(`/sales-orders/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); 
      setIsSlideOverOpen(false);
    },
    onError: (err) => alert("Failed to confirm sales order: " + err.message)
  });

  const deliverSalesOrderMutation = useMutation({
    mutationFn: (id) => api.post(`/sales-orders/${id}/deliver`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); 
      setIsSlideOverOpen(false);
    },
    onError: (err) => alert("Failed to deliver sales order: " + err.message)
  });

  const cancelSalesOrderMutation = useMutation({
    mutationFn: (id) => api.post(`/sales-orders/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); 
      setIsSlideOverOpen(false);
    },
    onError: (err) => alert("Failed to cancel sales order: " + err.message)
  });

  // Keep selected order in sync with fresh data
  useEffect(() => {
    if (selectedOrder) {
      const freshOrder = salesOrders.find(o => o.id === selectedOrder.id);
      if (freshOrder) setSelectedOrder(freshOrder);
    }
  }, [salesOrders, selectedOrder?.id]);

  // Filter Sales Orders based on search query and other filters
  const filteredOrders = salesOrders.filter(so => {
    const customer = customers.find(c => c.id === so.customer_id);
    const matchesSearch = so.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (customer && customer.name.toLowerCase().includes(searchQuery.toLowerCase()));
           
    const matchesStatus = statusFilter === "ALL" || so.status === statusFilter;
    const matchesCustomer = customerFilter === "ALL" || so.customer_id === customerFilter;
    
    return matchesSearch && matchesStatus && matchesCustomer;
  });

  const getOrderTotal = (so) => {
    return so.lines?.reduce((sum, line) => sum + (line.quantity_ordered * line.unit_price), 0) || 0;
  };

  const getOrderItemCount = (so) => {
    return so.lines?.reduce((sum, line) => sum + line.quantity_ordered, 0) || 0;
  };

  const handleRowClick = (so) => {
    setSelectedOrder(so);
    setIsCreating(false);
    setIsSlideOverOpen(true);
  };

  const handleNewClick = () => {
    if (!canModify) return;
    setIsCreating(true);
    setSelectedOrder(null);
    setCustomerSelect(customers[0]?.id || "");
    setOrderLines([{ product_id: products[0]?.id || "", quantity_ordered: 1, unit_price: products[0]?.sales_price || 0 }]);
    
    // Set default future date
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 3);
    setDeliveryDate(tmr.toISOString().slice(0, 16));
    
    setIsSlideOverOpen(true);
  };

  const handleAddLine = () => {
    const defaultProduct = products[0];
    setOrderLines([
      ...orderLines,
      { product_id: defaultProduct?.id || "", quantity_ordered: 1, unit_price: defaultProduct?.sales_price || 0 }
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
    updated[idx] = { ...updated[idx], quantity_ordered: Math.max(1, Number(qty)) };
    setOrderLines(updated);
  };

  const handleLinePriceChange = (idx, price) => {
    const updated = [...orderLines];
    updated[idx] = { ...updated[idx], unit_price: Math.max(0, Math.round(Number(price)) || 0) };
    setOrderLines(updated);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!canModify) return;

    if (orderLines.some(l => !l.product_id)) {
      alert("Please select a product for all lines.");
      return;
    }

    const payload = {
      customer_id: customerSelect,
      expected_delivery_date: new Date(deliveryDate).toISOString(),
      lines: orderLines.map(l => ({
        product_id: l.product_id,
        quantity_ordered: l.quantity_ordered,
        unit_price: l.unit_price
      }))
    };

    createSalesOrderMutation.mutate(payload);
  };

  const handleConfirm = () => {
    if (!canModify || !selectedOrder) return;
    confirmSalesOrderMutation.mutate(selectedOrder.id);
  };

  const handleCancel = () => {
    if (!canModify || !selectedOrder) return;
    if (window.confirm("Are you sure you want to cancel this Sales Order?")) {
      cancelSalesOrderMutation.mutate(selectedOrder.id);
    }
  };

  const handleDeliver = () => {
    if (!canModify || !selectedOrder) return;
    // Backend deliver endpoint processes the entire remaining order
    deliverSalesOrderMutation.mutate(selectedOrder.id);
  };

  // Helper to compute pre-confirmation stock shortage status
  const calculateShortageDetails = (linesList) => {
    return linesList.map(line => {
      const product = products.find(p => p.id === line.product_id);
      if (!product) return null;
      
      const freeToUse = product.on_hand_qty - product.reserved_qty;
      const needed = Number(line.quantity_ordered || 0);
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

  const activeShortages = selectedOrder && selectedOrder.status === "Draft" 
    ? calculateShortageDetails(selectedOrder.lines || []) 
    : [];

  // Stepper Stage Helpers
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
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {/* Customer Filter */}
        <div className="relative min-w-[180px] bg-card flex items-center">
          <Filter className="absolute left-3 text-textMuted" size={12} />
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="w-full bg-background border border-border rounded-custom py-1.5 pl-8 pr-3 text-[11px] text-textPrimary focus:outline-none focus:border-accent appearance-none cursor-pointer"
          >
            <option value="ALL">All Customers</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
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
            {isLoadingOrders ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-textMuted font-mono">
                  <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                  Loading sales orders...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-textMuted font-mono">
                  No sales orders found. Click "+ New Sales Order" to start a commercial transaction.
                </td>
              </tr>
            ) : (
              filteredOrders.map((so) => {
                const customer = customers.find(c => c.id === so.customer_id);
                const itemsCount = getOrderItemCount(so);
                const total = getOrderTotal(so);
                
                return (
                  <tr 
                    key={so.id}
                    onClick={() => handleRowClick(so)}
                    className="hover:bg-elevated/30 cursor-pointer transition-colors duration-150"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-textPrimary">{so.order_number}</td>
                    <td className="py-3 px-4 text-textSecondary">{customer ? customer.name : 'Unknown'}</td>
                    <td className="py-3 px-4 text-textSecondary">{new Date(so.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-textSecondary">{so.expected_delivery_date ? new Date(so.expected_delivery_date).toLocaleDateString() : '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block text-[9px] font-mono font-bold uppercase rounded-full px-2.5 py-0.5 tracking-wider border ${
                        so.status === "Draft" ? 'border-border text-textSecondary bg-elevated/30' :
                        so.status === "Confirmed" ? 'border-warning/40 text-warning bg-warning/5' :
                        so.status === "PartiallyDelivered" ? 'border-warning/40 text-warning bg-warning/5' :
                        so.status === "FullyDelivered" ? 'border-success/40 text-success bg-success/5' :
                        'border-danger/40 text-danger bg-danger/5'
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
                  disabled={createSalesOrderMutation.isPending}
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
                  disabled={createSalesOrderMutation.isPending}
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
                  disabled={createSalesOrderMutation.isPending}
                  className="text-[10px] bg-elevated hover:bg-card border border-border text-textPrimary px-2.5 py-1 rounded-custom font-semibold transition-all duration-150 disabled:opacity-50"
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
                        disabled={createSalesOrderMutation.isPending}
                      >
                        <option value="">Select Product...</option>
                        {products.map(p => (
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
                        value={line.quantity_ordered}
                        onChange={(e) => handleLineQtyChange(idx, e.target.value)}
                        className="w-full text-xs font-mono text-center"
                        required
                        disabled={createSalesOrderMutation.isPending}
                      />
                    </div>

                    {/* Price */}
                    <div className="w-28 relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-textSecondary text-xs">$</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Price"
                        value={line.unit_price}
                        onChange={(e) => handleLinePriceChange(idx, e.target.value)}
                        className="w-full text-xs font-mono text-right pl-5"
                        required
                        disabled={createSalesOrderMutation.isPending}
                      />
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      disabled={orderLines.length === 1 || createSalesOrderMutation.isPending}
                      className="text-textMuted hover:text-danger disabled:opacity-40 p-1.5 rounded"
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
                            <span className="text-danger flex items-center"><TrendingDown size={11} className="mr-0.5" /> -{detail.shortage} Short</span>
                            <span className="text-[10px] text-textMuted bg-elevated px-1.5 py-0.5 rounded">
                              {detail.procureActive ? `Auto-${detail.route}` : 'Needs Manual Resolving'}
                            </span>
                          </>
                        ) : (
                          <span className="text-success flex items-center"><Check size={11} className="mr-0.5" /> Stock OK (Free: {detail.freeToUse})</span>
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
                disabled={createSalesOrderMutation.isPending}
                className="bg-accent hover:bg-accent/90 text-background text-xs rounded-custom py-2 px-6 font-semibold transition-all duration-150 disabled:opacity-50"
              >
                {createSalesOrderMutation.isPending ? "Saving..." : "Save Draft Order"}
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
                      {selectedOrder.expected_delivery_date ? new Date(selectedOrder.expected_delivery_date).toLocaleDateString() : '-'}
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
                      {selectedOrder.lines?.map(line => {
                          const prod = products.find(p => p.id === line.product_id);
                          return (
                            <tr key={line.id} className="hover:bg-elevated/10">
                              <td className="py-2 px-3 text-textPrimary font-sans font-medium">{prod?.name || 'Unknown'}</td>
                              <td className="py-2 px-3 text-right">{line.quantity_ordered}</td>
                              <td className="py-2 px-3 text-right text-textSecondary">{line.quantity_delivered}</td>
                              <td className="py-2 px-3 text-right text-textSecondary">${(line.unit_price || 0).toFixed(2)}</td>
                              <td className="py-2 px-3 text-right text-textPrimary font-bold">
                                ${(line.quantity_ordered * (line.unit_price || 0)).toFixed(2)}
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
                          <div className="flex items-center space-x-1.5 text-[11px] text-warning pl-2 border-l border-warning/40 py-0.5">
                            <AlertTriangle size={12} className="text-warning flex-shrink-0" />
                            <span>
                              {detail.procureActive 
                                ? `Shortage of ${detail.shortage} units will auto-trigger a ${detail.route} Order (Draft).`
                                : `Shortage of ${detail.shortage} units. No auto-replenishment configured.`
                              }
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1.5 text-[11px] text-success pl-2 border-l border-success/40 py-0.5">
                            <Check size={12} className="text-success flex-shrink-0" />
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
                <div className="border border-border rounded-custom p-4 bg-card/10 space-y-3 text-center">
                  <div className="flex items-center justify-center space-x-2 text-textSecondary border-b border-border/60 pb-2">
                    <PackageOpen size={14} className="text-textSecondary" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Ship Remaining Order</span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleDeliver}
                    disabled={deliverSalesOrderMutation.isPending || !canModify}
                    className="bg-accent hover:bg-accent/90 text-background text-xs rounded-custom py-2 px-6 font-semibold transition-all duration-150 disabled:opacity-50"
                  >
                    {deliverSalesOrderMutation.isPending ? 'Processing...' : 'Deliver All Remaining Quantities'}
                  </button>
                  <p className="text-[10px] text-textMuted mt-2">The backend will automatically fulfill all remaining ordered quantities using available stock.</p>
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                {canModify && selectedOrder.status !== "FullyDelivered" && selectedOrder.status !== "Cancelled" && (
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
                      disabled={confirmSalesOrderMutation.isPending}
                      className="bg-accent hover:bg-accent/90 text-background text-xs rounded-custom py-2 px-6 font-semibold transition-all duration-150 disabled:opacity-50"
                    >
                      {confirmSalesOrderMutation.isPending ? 'Confirming...' : 'Confirm Order'}
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
