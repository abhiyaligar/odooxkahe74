import React from 'react';
import { Check } from 'lucide-react';

export const OrderTrackingStepper = ({ status, className = "" }) => {
  if (status === "Cancelled") {
    return (
      <div className={`p-3 border border-danger/20 bg-danger/5 text-danger text-xs font-semibold rounded-custom text-center uppercase tracking-wider font-mono ${className}`}>
        Cancelled: This order has been voided
      </div>
    );
  }

  const stages = [
    { key: "Draft", label: "Order Placed" },
    { key: "Confirmed", label: "Preparing" },
    { key: "Delivered", label: "Delivered" }
  ];

  const currentStageIdx =
    status === "Draft" ? 0 :
      status === "Confirmed" || status === "PartiallyDelivered" ? 1 :
        status === "FullyDelivered" ? 2 : 0;

  return (
    <div className={`flex items-center justify-between w-full px-4 py-4 bg-card border border-border rounded-custom ${className}`}>
      {stages.map((stage, idx) => {
        const isCompleted = idx < currentStageIdx;
        const isActive = idx === currentStageIdx;

        return (
          <React.Fragment key={stage.key}>
            <div className="flex items-center space-x-2">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all duration-150 ${isActive ? 'bg-accent text-background border border-accent' :
                  isCompleted ? 'bg-elevated text-textSecondary border border-border' :
                    'bg-background text-textMuted border border-border'
                }`}>
                {isCompleted ? <Check size={12} strokeWidth={3} className="text-textSecondary" /> : (idx + 1)}
              </div>
              <span className={`text-[11px] font-semibold tracking-wide ${isActive ? 'text-textPrimary' :
                  isCompleted ? 'text-textSecondary font-medium' :
                    'text-textMuted'
                }`}>
                {stage.key === "Confirmed" && status === "PartiallyDelivered" ? "Out for Delivery" : stage.label}
              </span>
            </div>
            {idx < stages.length - 1 && (
              <div className="flex-1 h-[1px] bg-border mx-3" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
