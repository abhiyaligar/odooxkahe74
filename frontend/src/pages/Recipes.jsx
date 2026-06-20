import React, { useState } from 'react';
import { useErpStore } from '../store/erpStore';
import { SlideOver } from '../components/common/SlideOver';
import { Plus, Check, Layers, AlertCircle, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export default function Recipes() {
  const queryClient = useQueryClient();
  const { 
    bomOperations, 
    workCenters, 
    currentRole,
    addBomOperations // We will need to define this or just skip storing operations locally
  } = useErpStore();

  const [selectedBom, setSelectedBom] = useState(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Create Form States
  const [productSelect, setProductSelect] = useState("");
  const [recipeName, setBomName] = useState("");
  const [versionSelect, setVersionSelect] = useState("v1");
  const [formComponents, setFormComponents] = useState([
    { component_product_id: "", quantity_required: 1 }
  ]);
  const [formOperations, setFormOperations] = useState([
    { operation_name: "", work_center_id: workCenters[0]?.id || "", duration_minutes: 10 }
  ]);

  // Role permissions check
  const canModify = currentRole === "SuperAdmin" || currentRole === "StoreAdmin";

  // Fetch data
  const { data: recipes = [], isLoading: isLoadingBoms } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => api.get('/recipes/')
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products/')
  });

  // Mutations
  const createBomMutation = useMutation({
    mutationFn: (newBom) => api.post('/recipes/', newBom),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      
      // Optionally store operations locally if needed
      // useErpStore.getState().addBomOperations(data.id, formOperations);
      
      setIsSlideOverOpen(false);
    },
    onError: (err) => setErrorMessage(err.message)
  });


  // Filter recipes based on parent product name
  const filteredBoms = recipes.filter(recipe => {
    const product = products.find(p => p.id === recipe.product_id);
    return recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (product && product.name.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const getComponentCount = (recipe) => {
    return recipe.lines?.length || 0;
  };

  const getOperationCount = (recipeId) => {
    return bomOperations.filter(bo => bo.bom_id === recipeId).length;
  };

  const handleRowClick = (recipe) => {
    setSelectedBom(recipe);
    setIsCreating(false);
    setErrorMessage("");
    setIsSlideOverOpen(true);
  };

  const handleNewClick = () => {
    if (!canModify) return;
    setIsCreating(true);
    setSelectedBom(null);
    setErrorMessage("");
    
    // Find first finished good that does NOT have a Recipes currently
    const productsWithoutBom = products.filter(p => p.type === "FinishedGood" && !p.bom_id);
    setProductSelect(productsWithoutBom[0]?.id || products.find(p => p.type === "FinishedGood")?.id || "");
    setBomName("");
    setVersionSelect("v1");
    
    // Default components line (first component product)
    const firstComp = products.find(p => p.type === "Component") || products[0];
    setFormComponents([{ component_product_id: firstComp?.id || "", quantity_required: 1 }]);
    setFormOperations([{ operation_name: "Assembly", work_center_id: workCenters[0]?.id || "", duration_minutes: 15 }]);
    
    setIsSlideOverOpen(true);
  };

  const handleAddComponentRow = () => {
    const firstComp = products.find(p => p.type === "Component") || products[0];
    setFormComponents([
      ...formComponents,
      { component_product_id: firstComp?.id || "", quantity_required: 1 }
    ]);
  };

  const handleRemoveComponentRow = (idx) => {
    setFormComponents(formComponents.filter((_, i) => i !== idx));
  };

  const handleComponentChange = (idx, field, val) => {
    const updated = [...formComponents];
    updated[idx] = {
      ...updated[idx],
      [field]: field === "quantity_required" ? Math.max(1, Math.round(Number(val)) || 1) : val
    };
    setFormComponents(updated);
  };

  const handleAddOperationRow = () => {
    setFormOperations([
      ...formOperations,
      { operation_name: "", work_center_id: workCenters[0]?.id || "", duration_minutes: 10 }
    ]);
  };

  const handleRemoveOperationRow = (idx) => {
    setFormOperations(formOperations.filter((_, i) => i !== idx));
  };

  const handleOperationChange = (idx, field, val) => {
    const updated = [...formOperations];
    updated[idx] = {
      ...updated[idx],
      [field]: field === "duration_minutes" ? Math.max(1, Number(val)) : val
    };
    setFormOperations(updated);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!canModify) return;
    setErrorMessage("");

    if (formComponents.some(c => !c.component_product_id)) {
      setErrorMessage("Please select component products for all lines.");
      return;
    }

    if (formOperations.some(op => !op.operation_name || !op.work_center_id)) {
      setErrorMessage("Please fill out names and work centers for all operations.");
      return;
    }

    createBomMutation.mutate({
      product_id: productSelect,
      name: recipeName,
      version: versionSelect,
      lines: formComponents.map(c => ({
        component_product_id: c.component_product_id,
        quantity_required: Number(c.quantity_required)
      }))
    });
  };

  return (
    <div className="space-y-4">
      {/* Search and New Button Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="Search Recipess (Recipe Name or Product)..."
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
            <span>New Recipes</span>
          </button>
        )}
      </div>

      {/* Recipess Data Table */}
      <div className="w-full border border-border bg-card rounded-custom overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-elevated/40 border-b border-border text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              <th className="py-3 px-4">Recipe Name</th>
              <th className="py-3 px-4">Finished Product</th>
              <th className="py-3 px-4">Version</th>
              <th className="py-3 px-4 text-center">Components Count</th>
              <th className="py-3 px-4 text-center">Operations Steps</th>
              <th className="py-3 px-4">Date Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {isLoadingBoms ? (
               <tr>
               <td colSpan="6" className="py-8 text-center text-textMuted font-mono">
                 <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                 Loading Recipess...
               </td>
             </tr>
            ) : filteredBoms.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-8 text-center text-textMuted font-mono">
                  No Bills of Materials configured. Create a manufacturing recipe to start building products.
                </td>
              </tr>
            ) : (
              filteredBoms.map((recipe) => {
                const product = products.find(p => p.id === recipe.product_id);
                const compCount = getComponentCount(recipe);
                const opCount = getOperationCount(recipe.id);
                
                return (
                  <tr 
                    key={recipe.id}
                    onClick={() => handleRowClick(recipe)}
                    className="hover:bg-elevated/30 cursor-pointer transition-colors duration-150"
                  >
                    <td className="py-3 px-4 font-semibold text-textPrimary">{recipe.name}</td>
                    <td className="py-3 px-4 text-textSecondary">{product ? product.name : 'Unknown'}</td>
                    <td className="py-3 px-4 font-mono text-textSecondary">{recipe.version}</td>
                    <td className="py-3 px-4 text-center font-mono font-medium">{compCount} Component(s)</td>
                    <td className="py-3 px-4 text-center font-mono font-medium">{opCount} Step(s)</td>
                    <td className="py-3 px-4 text-textSecondary">{new Date(recipe.created_at).toLocaleDateString()}</td>
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
        title={isCreating ? "Configure Bill of Materials" : `Bill of Materials: ${selectedBom?.name}`}
        subtitle={isCreating ? "Define manufacturing components and operations" : `Version: ${selectedBom?.version}`}
      >
        {isCreating ? (
          /* CREATE RECIPE FORM */
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Error Message banner */}
            {errorMessage && (
              <div className="bg-danger/10 border border-danger/20 text-danger p-3 rounded-custom flex items-center space-x-2 text-xs">
                <AlertCircle size={16} className="shrink-0" />
                <span className="font-mono">{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 flex flex-col space-y-1.5">
                <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Target Finished Good</label>
                <select 
                  value={productSelect} 
                  onChange={(e) => setProductSelect(e.target.value)}
                  required
                  disabled={createBomMutation.isPending}
                >
                  {products.filter(p => p.type === "FinishedGood").map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Version tag</label>
                <input 
                  type="text" 
                  value={versionSelect} 
                  onChange={(e) => setVersionSelect(e.target.value)}
                  placeholder="v1"
                  required
                  disabled={createBomMutation.isPending}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Recipe Friendly Name</label>
              <input 
                type="text" 
                value={recipeName} 
                onChange={(e) => setBomName(e.target.value)}
                placeholder="e.g. Dining Table Premium Recipes"
                disabled={createBomMutation.isPending}
                required
              />
            </div>

            {/* Components Subtable */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-textSecondary">Recipe Components</span>
                <button
                  type="button"
                  onClick={handleAddComponentRow}
                  disabled={createBomMutation.isPending}
                  className="text-[10px] bg-elevated hover:bg-card border border-border text-textPrimary px-2.5 py-1 rounded-custom font-semibold transition-all duration-150 disabled:opacity-50"
                >
                  + Add Component
                </button>
              </div>

              <div className="space-y-2">
                {formComponents.map((line, idx) => (
                  <div key={idx} className="flex items-center space-x-2 bg-card/25 p-2 border border-border rounded-custom">
                    {/* Component Product dropdown */}
                    <div className="flex-1">
                      <select
                        value={line.component_product_id}
                        onChange={(e) => handleComponentChange(idx, "component_product_id", e.target.value)}
                        className="w-full text-xs"
                        required
                        disabled={createBomMutation.isPending}
                      >
                        <option value="">Select component...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.type === "FinishedGood" ? "FG" : "Raw"})</option>
                        ))}
                      </select>
                    </div>

                    {/* Qty required */}
                    <div className="w-32">
                      <input
                        type="number"
                        step="1"
                        min="1"
                        placeholder="Qty required"
                        value={line.quantity_required}
                        onChange={(e) => handleComponentChange(idx, "quantity_required", e.target.value)}
                        className="w-full text-xs font-mono text-center"
                        required
                        disabled={createBomMutation.isPending}
                      />
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveComponentRow(idx)}
                      disabled={formComponents.length === 1 || createBomMutation.isPending}
                      className="text-textMuted hover:text-danger disabled:opacity-40 p-1.5 rounded"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Operations Steps Subtable */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-textSecondary">Operations Steps & Work Centers</span>
                <button
                  type="button"
                  onClick={handleAddOperationRow}
                  disabled={createBomMutation.isPending}
                  className="text-[10px] bg-elevated hover:bg-card border border-border text-textPrimary px-2.5 py-1 rounded-custom font-semibold transition-all duration-150 disabled:opacity-50"
                >
                  + Add Operation
                </button>
              </div>

              <div className="space-y-2">
                {formOperations.map((op, idx) => (
                  <div key={idx} className="flex items-center space-x-2 bg-card/25 p-2 border border-border rounded-custom">
                    {/* Step Description */}
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="e.g. Painting"
                        value={op.operation_name}
                        onChange={(e) => handleOperationChange(idx, "operation_name", e.target.value)}
                        className="w-full text-xs"
                        required
                        disabled={createBomMutation.isPending}
                      />
                    </div>

                    {/* Work Center */}
                    <div className="w-40">
                      <select
                        value={op.work_center_id}
                        onChange={(e) => handleOperationChange(idx, "work_center_id", e.target.value)}
                        className="w-full text-xs"
                        required
                        disabled={createBomMutation.isPending}
                      >
                        {workCenters.map(wc => (
                          <option key={wc.id} value={wc.id}>{wc.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Duration (mins) */}
                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        placeholder="Mins"
                        value={op.duration_minutes}
                        onChange={(e) => handleOperationChange(idx, "duration_minutes", e.target.value)}
                        className="w-full text-xs font-mono text-center"
                        required
                        disabled={createBomMutation.isPending}
                      />
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveOperationRow(idx)}
                      disabled={formOperations.length === 1 || createBomMutation.isPending}
                      className="text-textMuted hover:text-danger disabled:opacity-40 p-1.5 rounded"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer buttons */}
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
                disabled={createBomMutation.isPending}
                className="bg-accent hover:bg-accent/90 text-background text-xs rounded-custom py-2 px-6 font-semibold transition-all duration-150 disabled:opacity-50"
              >
                {createBomMutation.isPending ? "Saving..." : "Save Recipe"}
              </button>
            </div>
          </form>
        ) : (
          /* VIEW RECIPE DETAILS */
          selectedBom && (
            <div className="space-y-6">
              {/* Recipe Meta */}
              <div className="bg-card border border-border rounded-custom p-4 flex items-center space-x-3 text-xs">
                <Layers size={16} className="text-textMuted font-mono" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-textMuted font-semibold uppercase">Parent Finished Good</span>
                  <span className="font-medium text-textPrimary">
                    {products.find(p => p.id === selectedBom.product_id)?.name || 'Unknown'}
                  </span>
                </div>
              </div>

              {/* Recipe Components */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-textSecondary block">Recipe Component List</span>
                <div className="border border-border bg-card rounded-custom overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-elevated/40 border-b border-border text-[10px] font-semibold text-textSecondary uppercase tracking-wider">
                        <th className="py-2.5 px-3">Component Item</th>
                        <th className="py-2.5 px-3 text-right">Required Qty (per 1 unit)</th>
                        <th className="py-2.5 px-3 text-right">Current On Hand</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedBom.lines?.map(line => {
                          const compProd = products.find(p => p.id === line.component_product_id);
                          return (
                            <tr key={line.id} className="hover:bg-elevated/10">
                              <td className="py-2 px-3 text-textPrimary font-sans font-medium">{compProd?.name || 'Unknown'}</td>
                              <td className="py-2 px-3 text-right font-bold text-textPrimary">{line.quantity_required} unit(s)</td>
                              <td className="py-2 px-3 text-right text-textSecondary">{compProd?.on_hand_qty || 0}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recipe Operations */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-textSecondary block">Sequential Assembly Operations</span>
                <div className="border border-border bg-card rounded-custom overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-elevated/40 border-b border-border text-[10px] font-semibold text-textSecondary uppercase tracking-wider">
                        <th className="py-2.5 px-3 text-center">Seq</th>
                        <th className="py-2.5 px-3">Operation Description</th>
                        <th className="py-2.5 px-3">Work Center</th>
                        <th className="py-2.5 px-3 text-right">Duration (mins/unit)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {bomOperations
                        .filter(bo => bo.bom_id === selectedBom.id)
                        .sort((a, b) => a.sequence - b.sequence)
                        .map(op => {
                          const wcName = workCenters.find(w => w.id === op.work_center_id)?.name || 'Unknown';
                          return (
                            <tr key={op.id} className="hover:bg-elevated/10">
                              <td className="py-2 px-3 text-center text-textMuted">{op.sequence}</td>
                              <td className="py-2 px-3 text-textPrimary font-sans font-medium">{op.operation_name}</td>
                              <td className="py-2 px-3 text-textSecondary font-sans">{wcName}</td>
                              <td className="py-2 px-3 text-right text-textPrimary font-bold">{op.duration_minutes} min(s)</td>
                            </tr>
                          );
                        })}
                      {bomOperations.filter(bo => bo.bom_id === selectedBom.id).length === 0 && (
                        <tr>
                          <td colSpan="4" className="py-4 text-center text-textMuted italic">No operations stored locally for this backend Recipes yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-border flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setIsSlideOverOpen(false)}
                  className="bg-card hover:bg-elevated border border-border text-textPrimary text-xs rounded-custom py-2 px-4 font-semibold transition-all duration-150"
                >
                  Close Panel
                </button>
              </div>
            </div>
          )
        )}
      </SlideOver>
    </div>
  );
}
