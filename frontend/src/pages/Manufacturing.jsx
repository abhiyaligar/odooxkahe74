import React, { useState } from 'react';
import { useErpStore } from '../store/erpStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { SlideOver } from '../components/common/SlideOver';
import { 
  Plus, 
  Check, 
  Play, 
  ChevronRight, 
  Factory, 
  Layers, 
  AlertTriangle, 
  Info,
  Calendar,
  AlertCircle
} from 'lucide-react';

export default function Manufacturing() {
  const { 
    manufacturingOrders, 
    workOrders, 
    workCenters, 
    bomOperations,
    bomLines,
    currentRole,
    createManufacturingOrder,
    confirmManufacturingOrder,
    startWorkOrder,
    completeWorkOrder,
    completeManufacturingOrder,
    cancelManufacturingOrder
  } = useErpStore();

  const [selectedMo, setSelectedMo] = useState(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products/')
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => api.get('/recipes/')
  });

  // Create Form States
  const [productSelect, setProductSelect] = useState("");
  const [qtyToProduce, setQtyToProduce] = useState(1);

  // Role permissions checks (Manufacturing User, Admin)
  const canModify = currentRole === "SuperAdmin" || currentRole === "StoreAdmin" || currentRole === "ManufacturingUser";

  // Filter Manufacturing Orders
  const filteredMos = manufacturingOrders.filter(mo => {
    const product = products.find(p => p.id === mo.product_id);
    return mo.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (product && product.name.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const handleRowClick = (mo) => {
    setSelectedMo(mo);
    setIsCreating(false);
    setErrorMessage("");
    setIsSlideOverOpen(true);
  };

  const handleNewClick = () => {
    if (!canModify) return;
    setIsCreating(true);
    setSelectedMo(null);
    setErrorMessage("");
    
    // Default to first product that HAS a BoM configured
    const productsWithBom = products.filter(p => p.bom_id);
    setProductSelect(productsWithBom[0]?.id || "");
    setQtyToProduce(5);
    setIsSlideOverOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!canModify) return;
    setErrorMessage("");

    const prod = products.find(p => p.id === productSelect);
    if (!prod || !prod.bom_id) {
      setErrorMessage("The selected product does not have a Recipe. Please configure a Recipe first.");
      return;
    }

    try {
      const moId = createManufacturingOrder(productSelect, Number(qtyToProduce));
      setIsSlideOverOpen(false);

      // Open detail of newly created MO
      const state = useErpStore.getState();
      const createdMo = state.manufacturingOrders.find(o => o.id === moId);
      if (createdMo) {
        handleRowClick(createdMo);
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleConfirm = () => {
    if (!canModify || !selectedMo) return;
    confirmManufacturingOrder(selectedMo.id);
    
    // Refresh
    const state = useErpStore.getState();
    setSelectedMo(state.manufacturingOrders.find(o => o.id === selectedMo.id));
  };

  const handleCancel = () => {
    if (!canModify || !selectedMo) return;
    if (window.confirm("Are you sure you want to cancel this Manufacturing Order? All component allocations will be released.")) {
      cancelManufacturingOrder(selectedMo.id);
      const state = useErpStore.getState();
      setSelectedMo(state.manufacturingOrders.find(o => o.id === selectedMo.id));
    }
  };

  const handleStartStep = (woId) => {
    if (!canModify) return;
    setErrorMessage("");
    try {
      startWorkOrder(woId);
      const state = useErpStore.getState();
      // Sync selected MO state
      if (selectedMo) {
        setSelectedMo(state.manufacturingOrders.find(o => o.id === selectedMo.id));
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleCompleteStep = (woId) => {
    if (!canModify) return;
    setErrorMessage("");
    try {
      completeWorkOrder(woId);
      const state = useErpStore.getState();
      // Sync selected MO state
      if (selectedMo) {
        setSelectedMo(state.manufacturingOrders.find(o => o.id === selectedMo.id));
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleCompleteMO = () => {
    if (!canModify || !selectedMo) return;
    setErrorMessage("");
    try {
      completeManufacturingOrder(selectedMo.id);
      const state = useErpStore.getState();
      setSelectedMo(state.manufacturingOrders.find(o => o.id === selectedMo.id));
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // Stepper Stages for MO
  const renderStepper = (status) => {
    if (status === "Cancelled") {
      return (
        <div className="flex items-center justify-center p-3 bg-statusRed/10 border border-statusRed/20 text-statusRed rounded-custom text-xs font-semibold uppercase tracking-wider font-mono">
          Cancelled: Manufacturing Aborted
        </div>
      );
    }

    const stages = [
      { key: "Draft", label: "Draft" },
      { key: "InProgress", label: "In Progress" },
      { key: "Completed", label: "Completed" }
    ];

    const currentStageIdx = 
      status === "Draft" ? 0 : 
      status === "InProgress" ? 1 : 
      status === "Completed" ? 2 : 0;

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
                  {stage.label}
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
        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="Search manufacturing orders (MO# or Product)..."
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
            <span>New Manufacturing Order</span>
          </button>
        )}
      </div>

      {/* Manufacturing List Table */}
      <div className="w-full border border-border bg-card rounded-custom overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-elevated/40 border-b border-border text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              <th className="py-3 px-4">MO#</th>
              <th className="py-3 px-4">Finished Good</th>
              <th className="py-3 px-4 text-center">Source</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Target Qty</th>
              <th className="py-3 px-4 text-right">Estimated Duration</th>
              <th className="py-3 px-4">Date Queued</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {filteredMos.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-textMuted font-mono">
                  No manufacturing cycles scheduled. Auto-generated shop floor orders will sync here.
                </td>
              </tr>
            ) : (
              filteredMos.map((mo) => {
                const fgProduct = products.find(p => p.id === mo.product_id);
                
                // Calculate estimated duration
                const bomRecord = recipes.find(b => b.id === mo.bom_id);
                const opSteps = bomOperations.filter(bo => bo.bom_id === bomRecord?.id);
                const totalMinutes = opSteps.reduce((sum, op) => sum + (op.duration_minutes * mo.quantity_to_produce), 0);

                return (
                  <tr 
                    key={mo.id}
                    onClick={() => handleRowClick(mo)}
                    className="hover:bg-elevated/30 cursor-pointer transition-colors duration-150"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-textPrimary">{mo.order_number}</td>
                    <td className="py-3 px-4 text-textSecondary font-sans font-medium">{fgProduct ? fgProduct.name : 'Unknown'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded border border-border font-mono ${
                        mo.source === "AutoGenerated" ? 'text-accent bg-elevated/50' : 'text-textSecondary'
                      }`}>
                        {mo.source}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block text-[9px] font-mono font-bold uppercase rounded-full px-2.5 py-0.5 tracking-wider border ${
                        mo.status === "Draft" ? 'border-border text-textSecondary bg-elevated/30' :
                        mo.status === "InProgress" ? 'border-statusAmber/40 text-statusAmber bg-statusAmber/5' :
                        mo.status === "Completed" ? 'border-statusGreen/40 text-statusGreen bg-statusGreen/5' :
                        'border-statusRed/40 text-statusRed bg-statusRed/5'
                      }`}>
                        {mo.status === "InProgress" ? "In Progress" : mo.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium">{mo.quantity_to_produce} unit(s)</td>
                    <td className="py-3 px-4 text-right font-mono text-textSecondary">{totalMinutes} min(s)</td>
                    <td className="py-3 px-4 text-textSecondary">{new Date(mo.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over detail drawer */}
      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        title={isCreating ? "New Manufacturing Order" : `Manufacturing Order Details: ${selectedMo?.order_number}`}
        subtitle={isCreating ? "Initiate assembly process cycle" : `Associated Recipe: ${selectedMo?.bom_id}`}
      >
        {isCreating ? (
          /* CREATE MANUFACTURING ORDER */
          <form onSubmit={handleSave} className="space-y-6">
            {errorMessage && (
              <div className="bg-statusRed/10 border border-statusRed/20 text-statusRed p-3 rounded-custom flex items-center space-x-2 text-xs">
                <AlertCircle size={16} className="shrink-0" />
                <span className="font-mono">{errorMessage}</span>
              </div>
            )}

            <div className="flex flex-col space-y-1.5">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Select Product to Produce</label>
              <select 
                value={productSelect} 
                onChange={(e) => setProductSelect(e.target.value)}
                required
              >
                <option value="">Select Finished Good...</option>
                {products.filter(p => p.bom_id).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Target Production Quantity</label>
              <input 
                type="number" 
                min="1" 
                value={qtyToProduce} 
                onChange={(e) => setQtyToProduce(Math.max(1, Number(e.target.value)))}
                required
                className="font-mono text-xs"
              />
            </div>

            {/* Pre-save simulation check */}
            {productSelect && (
              <div className="p-4 border border-border bg-card/20 rounded-custom space-y-2 text-xs font-mono">
                <span className="text-[10px] font-bold text-textSecondary uppercase tracking-wider block">Components Reservation Check</span>
                {(() => {
                  const prod = products.find(p => p.id === productSelect);
                  if (!prod || !prod.bom_id) return <p className="text-textMuted italic">No recipe found.</p>;
                  
                  const lines = bomLines.filter(bl => bl.bom_id === prod.bom_id);
                  return lines.map(line => {
                    const comp = products.find(p => p.id === line.component_product_id);
                    if (!comp) return null;
                    const reqQty = line.quantity_required * Number(qtyToProduce);
                    const freeToUse = comp.on_hand_qty - comp.reserved_qty;
                    const shortage = Math.max(0, reqQty - freeToUse);

                    return (
                      <div key={line.id} className="py-1 flex items-center justify-between">
                        <span>{comp.name} (Need: {reqQty})</span>
                        <div className="flex items-center space-x-1.5">
                          {shortage > 0 ? (
                            <>
                              <span className="text-statusAmber">-{shortage} Shortage</span>
                              {comp.procure_on_demand ? (
                                <span className="text-[9px] bg-elevated border border-border text-textSecondary px-1 rounded uppercase">Auto-{comp.procurement_type}</span>
                              ) : (
                                <span className="text-[9px] border border-statusRed/20 text-statusRed px-1 rounded uppercase">Manual</span>
                              )}
                            </>
                          ) : (
                            <span className="text-statusGreen">Allocated (Free: {freeToUse})</span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

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
                Create MO (Draft)
              </button>
            </div>
          </form>
        ) : (
          /* VIEW EXISTING MO DETAILS */
          selectedMo && (
            <div className="space-y-6">
              {/* Stepper */}
              {renderStepper(selectedMo.status)}

              {/* Error messages inside details */}
              {errorMessage && (
                <div className="bg-statusRed/10 border border-statusRed/20 text-statusRed p-3 rounded-custom flex items-center space-x-2 text-xs">
                  <AlertCircle size={16} className="shrink-0" />
                  <span className="font-mono">{errorMessage}</span>
                </div>
              )}

              {/* Meta information */}
              <div className="bg-card border border-border rounded-custom p-4 grid grid-cols-2 gap-4 text-xs">
                <div className="flex items-center space-x-3">
                  <Factory size={16} className="text-textMuted" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-textMuted font-semibold uppercase">Product to Manufacture</span>
                    <span className="font-medium text-textPrimary">
                      {products.find(p => p.id === selectedMo.product_id)?.name || 'Unknown'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Layers size={16} className="text-textMuted" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-textMuted font-semibold uppercase">Target Quantity</span>
                    <span className="font-medium text-textPrimary font-mono">
                      {selectedMo.quantity_to_produce} unit(s)
                    </span>
                  </div>
                </div>
              </div>

              {/* Components Status Panel */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-textSecondary block">Component Allocations</span>
                <div className="border border-border bg-card rounded-custom overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-elevated/40 border-b border-border text-[10px] font-semibold text-textSecondary uppercase tracking-wider">
                        <th className="py-2.5 px-3">Component</th>
                        <th className="py-2.5 px-3 text-right">Required</th>
                        <th className="py-2.5 px-3 text-right">Reserved</th>
                        <th className="py-2.5 px-3 text-center">Fulfillment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedMo.components.map((compLine, idx) => {
                        const prod = products.find(p => p.id === compLine.component_product_id);
                        const isShortage = compLine.quantity_reserved < compLine.quantity_required;
                        
                        return (
                          <tr key={idx} className="hover:bg-elevated/10">
                            <td className="py-2 px-3 text-textPrimary font-sans font-medium">{prod?.name || 'Unknown'}</td>
                            <td className="py-2 px-3 text-right">{compLine.quantity_required}</td>
                            <td className="py-2 px-3 text-right text-textSecondary">{compLine.quantity_reserved}</td>
                            <td className="py-2 px-3 text-center">
                              <span className={`inline-block text-[9px] font-bold uppercase px-2 py-0.5 rounded font-mono ${
                                isShortage ? 'bg-statusRed/10 border border-statusRed/20 text-statusRed' : 'bg-statusGreen/10 border border-statusGreen/20 text-statusGreen'
                              }`}>
                                {isShortage ? "Shortage" : "Allocated"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Work Orders Operations sequence panel */}
              {selectedMo.status !== "Draft" && (
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-textSecondary block">Routing Work Orders Step Tracker</span>
                  <div className="border border-border bg-card rounded-custom overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="bg-elevated/40 border-b border-border text-[10px] font-semibold text-textSecondary uppercase tracking-wider">
                          <th className="py-2.5 px-3 text-center">Seq</th>
                          <th className="py-2.5 px-3">Operation</th>
                          <th className="py-2.5 px-3">Work Center</th>
                          <th className="py-2.5 px-3 text-right">Est Time</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {workOrders
                          .filter(w => w.manufacturing_order_id === selectedMo.id)
                          .sort((a, b) => a.sequence - b.sequence)
                          .map(wo => {
                            const wcName = workCenters.find(w => w.id === wo.work_center_id)?.name || 'Unknown';
                            
                            // Find matching BoM operation step duration
                            const bomRecord = recipes.find(b => b.id === selectedMo.bom_id);
                            const matchedOp = bomOperations.find(bo => bo.bom_id === bomRecord?.id && bo.operation_name === wo.operation_name);
                            const duration = matchedOp ? matchedOp.duration_minutes * selectedMo.quantity_to_produce : 0;

                            return (
                              <tr key={wo.id} className="hover:bg-elevated/10">
                                <td className="py-3 px-3 text-center text-textMuted">{wo.sequence}</td>
                                <td className="py-3 px-3 text-textPrimary font-sans font-medium">{wo.operation_name}</td>
                                <td className="py-3 px-3 text-textSecondary font-sans">{wcName}</td>
                                <td className="py-3 px-3 text-right">{duration} mins</td>
                                <td className="py-3 px-3 text-center">
                                  <span className={`inline-block text-[9px] font-bold uppercase rounded-full px-2 py-0.5 border ${
                                    wo.status === "Pending" ? 'border-border text-textSecondary' :
                                    wo.status === "InProgress" ? 'border-statusAmber/40 text-statusAmber animate-pulse' :
                                    'border-statusGreen/40 text-statusGreen'
                                  }`}>
                                    {wo.status === "InProgress" ? "In Progress" : wo.status}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  {canModify && selectedMo.status === "InProgress" && (
                                    <>
                                      {wo.status === "Pending" && (
                                        <button
                                          type="button"
                                          onClick={() => handleStartStep(wo.id)}
                                          className="text-[10px] bg-elevated hover:bg-card border border-border text-textPrimary px-2 py-0.5 rounded font-semibold transition-all duration-150"
                                        >
                                          Start
                                        </button>
                                      )}
                                      {wo.status === "InProgress" && (
                                        <button
                                          type="button"
                                          onClick={() => handleCompleteStep(wo.id)}
                                          className="text-[10px] bg-accent text-background px-2 py-0.5 rounded font-bold transition-all duration-150"
                                        >
                                          Complete
                                        </button>
                                      )}
                                      {wo.status === "Done" && (
                                        <Check size={14} className="text-statusGreen inline-block mr-2" strokeWidth={3} />
                                      )}
                                    </>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                {canModify && selectedMo.status === "Draft" && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="hover:text-statusRed text-xs text-textMuted py-2 transition-colors duration-150"
                  >
                    Abort MO
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
                  
                  {canModify && selectedMo.status === "Draft" && (
                    <button
                      type="button"
                      onClick={handleConfirm}
                      className="bg-accent hover:bg-accent/90 text-background text-xs rounded-custom py-2 px-6 font-semibold transition-all duration-150"
                    >
                      Confirm Order
                    </button>
                  )}

                  {canModify && selectedMo.status === "InProgress" && 
                   workOrders.filter(w => w.manufacturing_order_id === selectedMo.id).every(w => w.status === "Done") && (
                    <button
                      type="button"
                      onClick={handleCompleteMO}
                      className="bg-accent hover:bg-accent/90 text-background text-xs rounded-custom py-2 px-6 font-semibold transition-all duration-150 animate-bounce"
                    >
                      Complete Manufacturing Order
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
