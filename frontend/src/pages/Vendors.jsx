import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Loader2, Users, Plus, AlertCircle } from 'lucide-react';
import { useErpStore } from '../store/erpStore';
import { SlideOver } from '../components/common/SlideOver';

export default function Vendors() {
  const queryClient = useQueryClient();
  const { currentRole } = useErpStore();
  const canModify = currentRole === "SuperAdmin" || currentRole === "StoreAdmin";

  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get('/vendors/')
  });

  const createVendorMutation = useMutation({
    mutationFn: (newVendor) => api.post('/vendors/', newVendor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setIsSlideOverOpen(false);
      setVendorName("");
      setErrorMessage("");
    },
    onError: (err) => setErrorMessage(err.message || "Failed to create vendor")
  });

  const handleSave = (e) => {
    e.preventDefault();
    if (!canModify) return;
    if (!vendorName.trim()) {
      setErrorMessage("Vendor name is required");
      return;
    }
    createVendorMutation.mutate({ name: vendorName.trim() });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Users className="text-textSecondary" />
          <h1 className="text-lg font-semibold tracking-tight">Vendors List</h1>
        </div>
        {canModify && (
          <button
            onClick={() => {
              setVendorName("");
              setErrorMessage("");
              setIsSlideOverOpen(true);
            }}
            className="flex items-center space-x-1.5 bg-accent hover:bg-accent/90 text-background rounded-custom px-4 py-2 text-xs font-semibold transition-all duration-150 shadow-lg"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Add Vendor</span>
          </button>
        )}
      </div>

      <div className="w-full border border-border bg-card rounded-custom overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="bg-elevated/40 border-b border-border text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              <th className="py-3 px-4">ID</th>
              <th className="py-3 px-4">Name</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {isLoading ? (
              <tr>
                <td colSpan="2" className="py-8 text-center text-textMuted font-mono">
                  <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                  Loading vendors...
                </td>
              </tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan="2" className="py-8 text-center text-textMuted font-mono">
                  No vendors found.
                </td>
              </tr>
            ) : (
              vendors.map((v) => (
                <tr key={v.id} className="hover:bg-elevated/30 transition-colors duration-150">
                  <td className="py-3 px-4 font-mono text-textSecondary">{v.id}</td>
                  <td className="py-3 px-4 font-medium text-textPrimary">{v.name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        title="Add New Vendor"
        subtitle="Register a new commercial partner"
      >
        <form onSubmit={handleSave} className="space-y-6">
          {errorMessage && (
            <div className="bg-danger/10 border border-danger/20 text-danger p-3 rounded-custom flex items-center space-x-2 text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span className="font-mono">{errorMessage}</span>
            </div>
          )}

          <div className="flex flex-col space-y-1.5">
            <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Vendor Name</label>
            <input 
              type="text" 
              value={vendorName} 
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g. Acme Materials Inc."
              required
              className="w-full bg-background border border-border rounded-custom py-2 px-3 text-sm text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent font-sans"
            />
          </div>

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
              disabled={createVendorMutation.isPending}
              className="bg-accent hover:bg-accent/90 disabled:opacity-50 text-background text-xs rounded-custom py-2 px-6 font-semibold transition-all duration-150 flex items-center space-x-2"
            >
              {createVendorMutation.isPending && <Loader2 className="animate-spin" size={14} />}
              <span>Create Vendor</span>
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
