import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export const SlideOver = ({ isOpen, onClose, title, subtitle, children }) => {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    }
  }, [isOpen]);

  const handleTransitionEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
    }
  };

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
        {/* Drawer Panel */}
        <div 
          onTransitionEnd={handleTransitionEnd}
          className={`w-screen max-w-2xl bg-elevated border-l border-border shadow-[0_4px_16px_rgba(0,0,0,0.5)] transform transition-transform duration-200 ease-out flex flex-col ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-border flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight text-textPrimary">{title}</h2>
              {subtitle && <p className="text-xs text-textSecondary">{subtitle}</p>}
            </div>
            <button 
              onClick={onClose}
              className="p-1 rounded-custom hover:bg-card border border-transparent hover:border-border text-textSecondary hover:text-textPrimary transition-all duration-150"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
