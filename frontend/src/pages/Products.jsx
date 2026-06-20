import React, { useState } from 'react';
import { useErpStore } from '../store/erpStore';
import { SlideOver } from '../components/common/SlideOver';
import { Plus, Edit2, Trash2, Tag, Info, ShieldAlert, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Products() {
  const navigate = useNavigate();
  const { 
    products, 
    vendors, 
    boms, 
    currentRole, 
    addProduct, 
    editProduct, 
    deleteProduct, 
    adjustStock,
    salesOrderLines,
    salesOrders,
    purchaseOrderLines,
    purchaseOrders
  } = useErpStore();

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Forms & CRUD States
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "FinishedGood",
    sales_price: 0,
    cost_price: 0,
    procurement_strategy: "MTO",
    procure_on_demand: true,
    procurement_type: "Purchase",
    vendor_id: "",
    bom_id: ""
  });
  
  const [stockAdjustVal, setStockAdjustVal] = useState(0);

  // Role permissions checks
  const canModify = currentRole === "SuperAdmin" || currentRole === "StoreAdmin";
  const canAdjustStock = canModify || currentRole === "InventoryManager";

  // Filter products based on search query
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRowClick = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      type: product.type,
      sales_price: product.sales_price,
      cost_price: product.cost_price,
      procurement_strategy: product.procurement_strategy,
      procure_on_demand: product.procure_on_demand,
      procurement_type: product.procurement_type || "Purchase",
      vendor_id: product.vendor_id || "",
      bom_id: product.bom_id || ""
    });
    setStockAdjustVal(product.on_hand_qty);
    setActiveTab("general");
    setIsCreating(false);
    setIsSlideOverOpen(true);
  };

  const handleNewClick = () => {
    if (!canModify) return;
    setIsCreating(true);
    setSelectedProduct(null);
    setFormData({
      name: "",
      type: "FinishedGood",
      sales_price: 0,
      cost_price: 0,
      procurement_strategy: "MTO",
      procure_on_demand: true,
      procurement_type: "Purchase",
      vendor_id: vendors[0]?.id || "",
      bom_id: boms[0]?.id || ""
    });
    setIsSlideOverOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!canModify) return;

    try {
      if (formData.procurement_type === "Purchase" && !formData.vendor_id) {
        alert("Vendor is required for Purchase procurement type");
        return;
      }
      if (formData.procurement_type === "Manufacturing" && !formData.bom_id) {
        alert("BoM is required for Manufacturing procurement type");
        return;
      }

      if (isCreating) {
        addProduct(formData);
      } else {
        editProduct(selectedProduct.id, formData);
      }
      setIsSlideOverOpen(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = () => {
    if (!canModify || !selectedProduct) return;
    if (window.confirm(`Are you sure you want to delete ${selectedProduct.name}?`)) {
      try {
        deleteProduct(selectedProduct.id);
        setIsSlideOverOpen(false);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleStockAdjustSubmit = (e) => {
    e.preventDefault();
    if (!canAdjustStock || !selectedProduct) return;
    adjustStock(selectedProduct.id, Number(stockAdjustVal));
    
    // Refresh selected view quantity
    setSelectedProduct(prev => ({
      ...prev,
      on_hand_qty: Number(stockAdjustVal)
    }));
  };

  // Smart stats calculation
  const getProductStats = (productId) => {
    const relatedSO = salesOrderLines.filter(sol => sol.product_id === productId);
    const relatedPO = purchaseOrderLines.filter(pol => pol.product_id === productId);
    
    const salesCount = new Set(relatedSO.map(l => l.sales_order_id)).size;
    const purchaseCount = new Set(relatedPO.map(l => l.purchase_order_id)).size;

    return { salesCount, purchaseCount };
  };

  const { salesCount, purchaseCount } = selectedProduct ? getProductStats(selectedProduct.id) : { salesCount: 0, purchaseCount: 0 };

  return (
    <div className="space-y-4">
      {/* Header and Filter Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Search */}
        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-custom py-1.5 px-3 text-xs focus:outline-none"
          />
        </div>

        {/* Action Button */}
        {canModify && (
          <button
            onClick={handleNewClick}
            className="flex items-center space-x-1.5 bg-accent hover:bg-accent/90 text-background rounded-custom px-4 py-2 text-xs font-semibold transition-all duration-150 shrink-0 shadow-lg"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>New Product</span>
          </button>
        )}
      </div>

      {/* Products Data Table */}
      <div className="w-full border border-border bg-card rounded-custom overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-elevated/40 border-b border-border text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4 text-right">Sales Price</th>
              <th className="py-3 px-4 text-right">Cost Price</th>
              <th className="py-3 px-4 text-right">On Hand</th>
              <th className="py-3 px-4 text-right">Reserved</th>
              <th className="py-3 px-4 text-right">Free to Use</th>
              <th className="py-3 px-4 text-center">Badge</th>
              <th className="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="9" className="py-8 text-center text-textMuted font-mono">
                  No products found. Add a product to get started.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => {
                const freeToUse = p.on_hand_qty - p.reserved_qty;
                const isShortage = freeToUse < 0;
                
                return (
                  <tr 
                    key={p.id}
                    onClick={() => handleRowClick(p)}
                    className="hover:bg-elevated/30 cursor-pointer transition-colors duration-150"
                  >
                    <td className="py-3 px-4 font-medium text-textPrimary">{p.name}</td>
                    <td className="py-3 px-4 text-textSecondary">{p.type === "FinishedGood" ? "Finished Good" : "Component/Raw"}</td>
                    <td className="py-3 px-4 text-right font-mono text-textSecondary">${p.sales_price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono text-textSecondary">${p.cost_price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono font-medium">{p.on_hand_qty}</td>
                    <td className="py-3 px-4 text-right font-mono text-textSecondary">{p.reserved_qty}</td>
                    <td className={`py-3 px-4 text-right font-mono font-semibold ${isShortage ? 'text-statusRed' : 'text-textPrimary'}`}>
                      {freeToUse}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block border border-border text-[9px] font-semibold text-textSecondary rounded-custom px-2 py-0.5 tracking-wider font-mono bg-elevated/30">
                        {p.procurement_strategy}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          isShortage ? 'bg-statusRed' : 
                          freeToUse === 0 ? 'bg-statusAmber' : 
                          'bg-statusGreen'
                        }`} />
                        <span className="text-[10px] text-textSecondary font-medium">
                          {isShortage ? `Short (${Math.abs(freeToUse)})` : 
                           freeToUse === 0 ? 'Out of stock' : 
                           'In Stock'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over Detail Drawer */}
      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        title={isCreating ? "New Product" : `Product Details: ${selectedProduct?.name}`}
        subtitle={isCreating ? "Configure a new product catalog listing" : `ID: ${selectedProduct?.id}`}
      >
        {/* Smart stats chips pattern (only in edit/view mode) */}
        {!isCreating && selectedProduct && (
          <div className="flex items-center space-x-3 mb-2">
            <button
              onClick={() => {
                setIsSlideOverOpen(false);
                navigate('/sales');
              }}
              className="flex-1 bg-card border border-border rounded-custom p-3 text-left hover:bg-elevated/40 transition-all duration-150"
            >
              <div className="text-[10px] text-textSecondary font-semibold uppercase tracking-wider">Related Sales Orders</div>
              <div className="text-lg font-bold tracking-tight text-textPrimary mt-1">{salesCount} Orders</div>
            </button>

            <button
              onClick={() => {
                setIsSlideOverOpen(false);
                navigate('/purchase');
              }}
              className="flex-1 bg-card border border-border rounded-custom p-3 text-left hover:bg-elevated/40 transition-all duration-150"
            >
              <div className="text-[10px] text-textSecondary font-semibold uppercase tracking-wider">Related Purchase Orders</div>
              <div className="text-lg font-bold tracking-tight text-textPrimary mt-1">{purchaseCount} Orders</div>
            </button>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("general")}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 tracking-wide transition-all duration-150 ${
              activeTab === "general" 
                ? 'border-accent text-textPrimary' 
                : 'border-transparent text-textSecondary hover:text-textPrimary'
            }`}
          >
            General Details
          </button>
          {!isCreating && (
            <button
              onClick={() => setActiveTab("inventory")}
              className={`py-2.5 px-4 text-xs font-semibold border-b-2 tracking-wide transition-all duration-150 ${
                activeTab === "inventory" 
                  ? 'border-accent text-textPrimary' 
                  : 'border-transparent text-textSecondary hover:text-textPrimary'
              }`}
            >
              Inventory Management
            </button>
          )}
          <button
            onClick={() => setActiveTab("procurement")}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 tracking-wide transition-all duration-150 ${
              activeTab === "procurement" 
                ? 'border-accent text-textPrimary' 
                : 'border-transparent text-textSecondary hover:text-textPrimary'
            }`}
          >
            Procurement Configuration
          </button>
        </div>

        {/* Tab Contents */}
        <form onSubmit={handleSave} className="space-y-6 mt-4">
          
          {/* General Tab */}
          {activeTab === "general" && (
            <div className="space-y-4">
              <div className="flex flex-col space-y-1.5">
                <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Product Name</label>
                <input
                  type="text"
                  required
                  disabled={!canModify}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Dining Table"
                  className="disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Product Type</label>
                  <select
                    disabled={!canModify}
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="FinishedGood">Finished Good</option>
                    <option value="Component">Component / Raw Material</option>
                  </select>
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Procure on Demand</label>
                  <select
                    disabled={!canModify}
                    value={formData.procure_on_demand ? "true" : "false"}
                    onChange={(e) => setFormData({ ...formData, procure_on_demand: e.target.value === "true" })}
                    className="disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="true">Enable Auto-procurement</option>
                    <option value="false">Manual Fulfillment Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Sales Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!canModify}
                    value={formData.sales_price}
                    onChange={(e) => setFormData({ ...formData, sales_price: Number(e.target.value) })}
                    className="disabled:opacity-60 disabled:cursor-not-allowed font-mono"
                  />
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Cost Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!canModify}
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: Number(e.target.value) })}
                    className="disabled:opacity-60 disabled:cursor-not-allowed font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Inventory Tab (only in edit mode) */}
          {activeTab === "inventory" && selectedProduct && (
            <div className="space-y-6">
              {/* Quantities stat display */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border border-border p-3 rounded-custom text-center">
                  <div className="text-[10px] text-textSecondary font-semibold uppercase">On Hand</div>
                  <div className="text-xl font-bold font-mono mt-1 text-textPrimary">{selectedProduct.on_hand_qty}</div>
                </div>
                <div className="bg-card border border-border p-3 rounded-custom text-center">
                  <div className="text-[10px] text-textSecondary font-semibold uppercase">Reserved</div>
                  <div className="text-xl font-bold font-mono mt-1 text-statusAmber">{selectedProduct.reserved_qty}</div>
                </div>
                <div className="bg-card border border-border p-3 rounded-custom text-center">
                  <div className="text-[10px] text-textSecondary font-semibold uppercase">Free To Use</div>
                  <div className="text-xl font-bold font-mono mt-1 text-textPrimary">
                    {selectedProduct.on_hand_qty - selectedProduct.reserved_qty}
                  </div>
                </div>
              </div>

              {/* Visual Gray Share Bar */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Stock Allocation Map</label>
                <div className="h-6 w-full bg-border rounded-custom overflow-hidden flex text-[10px] font-bold text-center font-mono">
                  {selectedProduct.on_hand_qty > 0 ? (
                    <>
                      {/* Reserved Block */}
                      {selectedProduct.reserved_qty > 0 && (
                        <div 
                          className="bg-textMuted text-textPrimary flex items-center justify-center"
                          style={{ width: `${Math.min(100, (selectedProduct.reserved_qty / selectedProduct.on_hand_qty) * 100)}%` }}
                        >
                          {Math.round((selectedProduct.reserved_qty / selectedProduct.on_hand_qty) * 100)}% Res
                        </div>
                      )}
                      {/* Free to Use Block */}
                      {(selectedProduct.on_hand_qty - selectedProduct.reserved_qty) > 0 && (
                        <div 
                          className="bg-accent text-accentForeground flex items-center justify-center flex-1"
                        >
                          {Math.round(((selectedProduct.on_hand_qty - selectedProduct.reserved_qty) / selectedProduct.on_hand_qty) * 100)}% Free
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full bg-card text-textMuted flex items-center justify-center font-normal italic">
                      Zero physical inventory on hand
                    </div>
                  )}
                </div>
              </div>

              {/* Manual stock adjustment form */}
              {canAdjustStock && (
                <div className="border border-border rounded-custom p-4 bg-card/20 space-y-3">
                  <div className="flex items-center space-x-2 text-textSecondary">
                    <AlertCircle size={14} className="text-statusAmber" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Manual Adjustment Ledger Action</span>
                  </div>
                  
                  <div className="flex items-end space-x-3">
                    <div className="flex-1 flex flex-col space-y-1">
                      <span className="text-[10px] text-textSecondary font-semibold">Override On Hand Physical Stock</span>
                      <input
                        type="number"
                        min="0"
                        value={stockAdjustVal}
                        onChange={(e) => setStockAdjustVal(e.target.value)}
                        className="bg-background"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleStockAdjustSubmit}
                      className="bg-elevated hover:bg-card border border-border text-textPrimary text-xs rounded-custom py-2 px-4 font-semibold transition-all duration-150"
                    >
                      Log Adjustment
                    </button>
                  </div>
                  <p className="text-[10px] text-textMuted italic">Every override writes an entry directly into the permanent Stock Ledger.</p>
                </div>
              )}
            </div>
          )}

          {/* Procurement Strategy Tab */}
          {activeTab === "procurement" && (
            <div className="space-y-4">
              {/* Segmented Control */}
              <div className="flex flex-col space-y-1.5">
                <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Procurement Strategy</label>
                <div className="grid grid-cols-2 bg-background border border-border p-1 rounded-custom">
                  <button
                    type="button"
                    disabled={!canModify}
                    onClick={() => setFormData({ ...formData, procurement_strategy: "MTS" })}
                    className={`py-1.5 text-xs font-semibold rounded transition-all duration-150 ${
                      formData.procurement_strategy === "MTS"
                        ? 'bg-accent text-background'
                        : 'text-textSecondary hover:text-textPrimary'
                    }`}
                  >
                    MTS (Make To Stock)
                  </button>
                  <button
                    type="button"
                    disabled={!canModify}
                    onClick={() => setFormData({ ...formData, procurement_strategy: "MTO" })}
                    className={`py-1.5 text-xs font-semibold rounded transition-all duration-150 ${
                      formData.procurement_strategy === "MTO"
                        ? 'bg-accent text-background'
                        : 'text-textSecondary hover:text-textPrimary'
                    }`}
                  >
                    MTO (Make To Order)
                  </button>
                </div>
                <span className="text-[10px] text-textMuted italic mt-1">
                  {formData.procurement_strategy === "MTS" 
                    ? "MTS: replenished proactively to maintain safety buffers. Customer orders pull directly from stock."
                    : "MTO: built or purchased on-demand. Shortages during sales orders automatically launch procurement."
                  }
                </span>
              </div>

              {/* Conditional Procurement Type */}
              {formData.procure_on_demand && (
                <div className="space-y-4 p-4 border border-border bg-card/20 rounded-custom">
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Replenishment Route (Procurement Type)</label>
                    <select
                      disabled={!canModify}
                      value={formData.procurement_type}
                      onChange={(e) => setFormData({ ...formData, procurement_type: e.target.value })}
                    >
                      <option value="Purchase">Buy (Purchase Order)</option>
                      <option value="Manufacturing">Build (Manufacturing Order / BoM)</option>
                    </select>
                  </div>

                  {/* Procurement Vendor (Buy) */}
                  {formData.procurement_type === "Purchase" && (
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Preferred Vendor</label>
                      <select
                        disabled={!canModify}
                        value={formData.vendor_id}
                        onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                        required={formData.procurement_type === "Purchase"}
                      >
                        <option value="">Select Vendor...</option>
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Procurement BoM (Build) */}
                  {formData.procurement_type === "Manufacturing" && (
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Associated Bill of Materials (BoM)</label>
                      <select
                        disabled={!canModify}
                        value={formData.bom_id}
                        onChange={(e) => setFormData({ ...formData, bom_id: e.target.value })}
                        required={formData.procurement_type === "Manufacturing"}
                      >
                        <option value="">Select Recipe...</option>
                        {boms.map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({b.version})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-between">
            {canModify && !isCreating && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center space-x-1 hover:text-statusRed transition-colors duration-150 text-xs text-textMuted py-2"
              >
                <Trash2 size={14} />
                <span>Delete Catalog Listing</span>
              </button>
            )}

            <div className="flex items-center space-x-2 ml-auto">
              <button
                type="button"
                onClick={() => setIsSlideOverOpen(false)}
                className="bg-card hover:bg-elevated border border-border text-textPrimary text-xs rounded-custom py-2 px-4 font-semibold transition-all duration-150"
              >
                Cancel
              </button>

              {canModify && (
                <button
                  type="submit"
                  className="bg-accent hover:bg-accent/90 text-background text-xs rounded-custom py-2 px-6 font-semibold transition-all duration-150"
                >
                  Save Product
                </button>
              )}
            </div>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
