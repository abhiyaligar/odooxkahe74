import React, { useState } from 'react';
import { useErpStore } from '../store/erpStore';
import { SlideOver } from '../components/common/SlideOver';
import { Plus, Edit2, Trash2, Tag, Info, ShieldAlert, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export default function Products() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentRole } = useErpStore();

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Forms & CRUD States
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
  const [recipeMode, setRecipeMode] = useState("existing"); // "existing" or "inline"
  const [recipeLines, setRecipeLines] = useState([{ component_product_id: "", quantity_required: 1 }]);

  // Fetching Data with React Query
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products/')
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get('/vendors/')
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => api.get('/recipes/')
  });

  const { data: salesOrders = [] } = useQuery({
    queryKey: ['salesOrders'],
    queryFn: () => api.get('/sales-orders/')
  });

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: (newProd) => api.post('/products/', newProd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsSlideOverOpen(false);
    },
    onError: (err) => alert("Failed to create product: " + err.message)
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsSlideOverOpen(false);
    },
    onError: (err) => alert("Failed to update product: " + err.message)
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsSlideOverOpen(false);
    },
    onError: (err) => alert("Failed to delete product: " + err.message)
  });

  const adjustStockMutation = useMutation({
    mutationFn: ({ id, qty }) => api.put(`/products/${id}`, { on_hand_qty: qty }),
    onSuccess: (updatedProduct) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSelectedProduct(updatedProduct);
      alert("Stock adjusted successfully.");
    },
    onError: (err) => alert("Failed to adjust stock: " + err.message)
  });

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
    setRecipeMode("existing");
    setRecipeLines([{ component_product_id: "", quantity_required: 1 }]);
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
      bom_id: recipes[0]?.id || ""
    });
    setRecipeMode("existing");
    setRecipeLines([{ component_product_id: "", quantity_required: 1 }]);
    setIsSlideOverOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canModify) return;

    try {
      if (formData.procurement_type === "Purchase" && !formData.vendor_id) {
        alert("Vendor is required for Purchase procurement type");
        return;
      }
      if (formData.procurement_type === "Manufacturing" && recipeMode === "existing" && !formData.bom_id) {
        alert("Recipe is required for Manufacturing procurement type");
        return;
      }

      if (formData.procurement_type === "Manufacturing" && recipeMode === "inline") {
        if (recipeLines.length === 0 || recipeLines.some(l => !l.component_product_id || l.quantity_required <= 0)) {
          alert("Please fill all recipe lines with valid components and quantities.");
          return;
        }
      }

      const payload = {
        ...formData,
        vendor_id: formData.vendor_id || null,
        bom_id: formData.bom_id || null,
      };

      if (formData.procurement_type === "Manufacturing" && recipeMode === "inline") {
        setIsSaving(true);
        // 1. Create/Update product without procurement type to avoid BoM requirement
        const prodPayload = { ...payload, procurement_type: null, bom_id: null };
        let prodId = selectedProduct?.id;
        let newProd = null;
        
        if (isCreating) {
          newProd = await api.post('/products/', prodPayload);
          prodId = newProd.id;
        } else {
          newProd = await api.put(`/products/${prodId}`, prodPayload);
        }

        // 2. Create Recipe
        const recipePayload = {
          product_id: prodId,
          name: `${formData.name} Recipe`,
          version: "1.0",
          lines: recipeLines.map(l => ({
            component_product_id: l.component_product_id,
            quantity_required: Math.max(1, Math.round(Number(l.quantity_required)) || 1)
          }))
        };
        const newRecipe = await api.post('/recipes/', recipePayload);

        // 3. Update product with procurement_type and bom_id
        await api.put(`/products/${prodId}`, { ...payload, procurement_type: "Manufacturing", bom_id: newRecipe.id });
        
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['recipes'] });
        setIsSaving(false);
        setIsSlideOverOpen(false);
      } else {
        if (isCreating) {
          createProductMutation.mutate(payload);
        } else {
          updateProductMutation.mutate({ id: selectedProduct.id, data: payload });
        }
      }
    } catch (err) {
      setIsSaving(false);
      alert(err.message);
    }
  };

  const handleDelete = () => {
    if (!canModify || !selectedProduct) return;
    if (window.confirm(`Are you sure you want to delete ${selectedProduct.name}?`)) {
      deleteProductMutation.mutate(selectedProduct.id);
    }
  };

  const handleStockAdjustSubmit = (e) => {
    e.preventDefault();
    if (!canAdjustStock || !selectedProduct) return;
    adjustStockMutation.mutate({ id: selectedProduct.id, qty: Number(stockAdjustVal) });
  };

  // Smart stats calculation
  const getProductStats = (productId) => {
    let salesCount = 0;
    salesOrders.forEach(so => {
      if (so.lines && so.lines.some(l => l.product_id === productId)) {
        salesCount++;
      }
    });
    const purchaseCount = 0; // Purchase orders not yet supported by backend API
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
            {isLoadingProducts ? (
              <tr>
                <td colSpan="9" className="py-8 text-center text-textMuted font-mono">
                  <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                  Loading products...
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
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
                    <td className={`py-3 px-4 text-right font-mono font-semibold ${isShortage ? 'text-danger' : 'text-textPrimary'}`}>
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
                          isShortage ? 'bg-danger' : 
                          freeToUse === 0 ? 'bg-warning' : 
                          'bg-success'
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
                  disabled={!canModify || createProductMutation.isPending || updateProductMutation.isPending}
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
                    disabled={!canModify || createProductMutation.isPending || updateProductMutation.isPending}
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
                    disabled={!canModify || createProductMutation.isPending || updateProductMutation.isPending}
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
                    step="1"
                    min="0"
                    disabled={!canModify || createProductMutation.isPending || updateProductMutation.isPending}
                    value={formData.sales_price}
                    onChange={(e) => setFormData({ ...formData, sales_price: Math.max(0, Math.round(Number(e.target.value)) || 0) })}
                    className="disabled:opacity-60 disabled:cursor-not-allowed font-mono"
                  />
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Cost Price ($)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    disabled={!canModify || createProductMutation.isPending || updateProductMutation.isPending}
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: Math.max(0, Math.round(Number(e.target.value)) || 0) })}
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
                  <div className="text-xl font-bold font-mono mt-1 text-warning">{selectedProduct.reserved_qty}</div>
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
                    <AlertCircle size={14} className="text-warning" />
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
                      disabled={adjustStockMutation.isPending}
                      className="bg-elevated hover:bg-card border border-border text-textPrimary text-xs rounded-custom py-2 px-4 font-semibold transition-all duration-150 disabled:opacity-50"
                    >
                      {adjustStockMutation.isPending ? 'Logging...' : 'Log Adjustment'}
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
                    disabled={!canModify || createProductMutation.isPending || updateProductMutation.isPending}
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
                    disabled={!canModify || createProductMutation.isPending || updateProductMutation.isPending}
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
                      disabled={!canModify || createProductMutation.isPending || updateProductMutation.isPending}
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
                        disabled={!canModify || createProductMutation.isPending || updateProductMutation.isPending}
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
                    <div className="flex flex-col space-y-3 border border-border bg-background p-3 rounded-custom">
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Recipe Configuration</label>
                        <div className="grid grid-cols-2 bg-card border border-border p-1 rounded-custom">
                          <button
                            type="button"
                            onClick={() => setRecipeMode("existing")}
                            className={`py-1.5 text-xs font-semibold rounded transition-all duration-150 ${
                              recipeMode === "existing"
                                ? 'bg-accent text-background'
                                : 'text-textSecondary hover:text-textPrimary'
                            }`}
                          >
                            Select Existing BoM
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecipeMode("inline")}
                            className={`py-1.5 text-xs font-semibold rounded transition-all duration-150 ${
                              recipeMode === "inline"
                                ? 'bg-accent text-background'
                                : 'text-textSecondary hover:text-textPrimary'
                            }`}
                          >
                            Create Recipe Inline
                          </button>
                        </div>
                      </div>

                      {recipeMode === "existing" ? (
                        <div className="flex flex-col space-y-1.5">
                          <select
                            disabled={!canModify || isSaving}
                            value={formData.bom_id}
                            onChange={(e) => setFormData({ ...formData, bom_id: e.target.value })}
                            required={formData.procurement_type === "Manufacturing" && recipeMode === "existing"}
                          >
                            <option value="">Select Recipe...</option>
                            {recipes.map(b => (
                              <option key={b.id} value={b.id}>{b.name} ({b.version})</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="flex flex-col space-y-3">
                          <div className="bg-card/50 rounded p-2 space-y-2 border border-border">
                            {recipeLines.map((line, idx) => (
                              <div key={idx} className="flex items-center space-x-2">
                                <select
                                  value={line.component_product_id}
                                  onChange={(e) => {
                                    const newLines = [...recipeLines];
                                    newLines[idx].component_product_id = e.target.value;
                                    setRecipeLines(newLines);
                                  }}
                                  className="flex-1 text-xs"
                                  required
                                >
                                  <option value="">Select Raw Material...</option>
                                  {products.filter(p => p.type === "Component").map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={line.quantity_required}
                                  onChange={(e) => {
                                    const newLines = [...recipeLines];
                                    newLines[idx].quantity_required = e.target.value;
                                    setRecipeLines(newLines);
                                  }}
                                  className="w-20 text-xs font-mono"
                                  placeholder="Qty"
                                  required
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newLines = recipeLines.filter((_, i) => i !== idx);
                                    setRecipeLines(newLines.length ? newLines : [{ component_product_id: "", quantity_required: 1 }]);
                                  }}
                                  className="p-1.5 text-danger hover:bg-danger/10 rounded transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setRecipeLines([...recipeLines, { component_product_id: "", quantity_required: 1 }])}
                              className="text-xs text-accent font-semibold hover:underline flex items-center mt-2"
                            >
                              <Plus size={12} className="mr-1" /> Add Component
                            </button>
                          </div>
                        </div>
                      )}
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
                disabled={deleteProductMutation.isPending}
                className="flex items-center space-x-1 hover:text-danger transition-colors duration-150 text-xs text-textMuted py-2 disabled:opacity-50"
              >
                {deleteProductMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
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
                  disabled={createProductMutation.isPending || updateProductMutation.isPending}
                  className="bg-accent hover:bg-accent/90 text-background text-xs rounded-custom py-2 px-6 font-semibold transition-all duration-150 disabled:opacity-50"
                >
                  {createProductMutation.isPending || updateProductMutation.isPending ? "Saving..." : "Save Product"}
                </button>
              )}
            </div>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
