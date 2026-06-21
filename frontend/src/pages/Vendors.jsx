import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Loader2, Users, Plus, AlertCircle, Search, Star, Mail, Phone, Filter } from 'lucide-react';
import { useErpStore } from '../store/erpStore';
import { SlideOver } from '../components/common/SlideOver';

export default function Vendors() {
  const queryClient = useQueryClient();
  const { currentRole } = useErpStore();
  const canModify = currentRole === "SuperAdmin" || currentRole === "StoreAdmin";

  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [ratingFilter, setRatingFilter] = useState("ALL");
  const [termsFilter, setTermsFilter] = useState("ALL");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    products_supplied: "",
    rating: 5,
    category: "RawMaterials",
    payment_terms: "PrePaid"
  });

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get('/vendors/')
  });

  const filteredVendors = vendors.filter(v => {
    const matchesSearch = 
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.email && v.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.products_supplied && v.products_supplied.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesCategory = categoryFilter === "ALL" || v.category === categoryFilter;
    const matchesTerms = termsFilter === "ALL" || v.payment_terms === termsFilter;
    
    let matchesRating = true;
    if (ratingFilter !== "ALL") {
      const ratingNum = Number(ratingFilter);
      matchesRating = v.rating === ratingNum;
    }
    
    return matchesSearch && matchesCategory && matchesTerms && matchesRating;
  });

  const createVendorMutation = useMutation({
    mutationFn: (newVendor) => api.post('/vendors/', newVendor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setIsSlideOverOpen(false);
      resetForm();
    },
    onError: (err) => setErrorMessage(err.message || "Failed to create vendor")
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      products_supplied: "",
      rating: 5,
      category: "RawMaterials",
      payment_terms: "PrePaid"
    });
    setErrorMessage("");
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!canModify) return;
    if (!formData.name.trim()) {
      setErrorMessage("Vendor name is required");
      return;
    }
    
    createVendorMutation.mutate({
      name: formData.name.trim(),
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      products_supplied: formData.products_supplied.trim() || null,
      rating: Number(formData.rating),
      category: formData.category,
      payment_terms: formData.payment_terms
    });
  };

  // Render rating stars helper
  const renderStars = (ratingCount) => {
    const stars = [];
    const count = ratingCount || 0;
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star 
          key={i} 
          size={14} 
          className={i <= count ? "text-amber-500 fill-amber-500" : "text-textMuted"} 
        />
      );
    }
    return <div className="flex items-center space-x-0.5">{stars}</div>;
  };

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Users className="text-textSecondary" />
          <h1 className="text-lg font-semibold tracking-tight">Vendors List</h1>
        </div>
        {canModify && (
          <button
            onClick={() => {
              resetForm();
              setIsSlideOverOpen(true);
            }}
            className="flex items-center space-x-1.5 bg-accent hover:bg-accent/90 text-background rounded-custom px-4 py-2 text-xs font-semibold transition-all duration-150 shadow-lg"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Add Vendor</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md bg-card">
        <Search className="absolute left-3 top-2.5 text-textMuted" size={14} />
        <input
          type="text"
          placeholder="Search vendors by name, email or products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-background border border-border rounded-custom py-1.5 pl-9 pr-3 text-xs text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category Filter */}
        <div className="relative min-w-[150px] bg-card flex items-center">
          <Filter className="absolute left-3 text-textMuted" size={12} />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-background border border-border rounded-custom py-1.5 pl-8 pr-3 text-[11px] text-textPrimary focus:outline-none focus:border-accent appearance-none cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="RawMaterials">Raw Materials</option>
            <option value="FinishedGoods">Finished Goods</option>
            <option value="Logistics">Logistics</option>
            <option value="Services">Services</option>
          </select>
        </div>

        {/* Rating Filter */}
        <div className="relative min-w-[150px] bg-card flex items-center">
          <Filter className="absolute left-3 text-textMuted" size={12} />
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="w-full bg-background border border-border rounded-custom py-1.5 pl-8 pr-3 text-[11px] text-textPrimary focus:outline-none focus:border-accent appearance-none cursor-pointer"
          >
            <option value="ALL">All Ratings</option>
            <option value="5">⭐⭐⭐⭐⭐ - 5 Stars</option>
            <option value="4">⭐⭐⭐⭐ - 4 Stars</option>
            <option value="3">⭐⭐⭐ - 3 Stars</option>
            <option value="2">⭐⭐ - 2 Stars</option>
            <option value="1">⭐ - 1 Star</option>
          </select>
        </div>

        {/* Payment Terms Filter */}
        <div className="relative min-w-[150px] bg-card flex items-center">
          <Filter className="absolute left-3 text-textMuted" size={12} />
          <select
            value={termsFilter}
            onChange={(e) => setTermsFilter(e.target.value)}
            className="w-full bg-background border border-border rounded-custom py-1.5 pl-8 pr-3 text-[11px] text-textPrimary focus:outline-none focus:border-accent appearance-none cursor-pointer"
          >
            <option value="ALL">All Payment Terms</option>
            <option value="PrePaid">PrePaid</option>
            <option value="Net15">Net 15</option>
            <option value="Net30">Net 30</option>
            <option value="Net60">Net 60</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="w-full border border-border bg-card rounded-custom overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-elevated/40 border-b border-border text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Contact Info</th>
              <th className="py-3 px-4">Products Supplied</th>
              <th className="py-3 px-4 text-center">Rating</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Payment Terms</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {isLoading ? (
              <tr>
                <td colSpan="6" className="py-8 text-center text-textMuted font-mono">
                  <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                  Loading vendors...
                </td>
              </tr>
            ) : filteredVendors.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-8 text-center text-textMuted font-mono">
                  No vendors found.
                </td>
              </tr>
            ) : (
              filteredVendors.map((v) => (
                <tr key={v.id} className="hover:bg-elevated/30 transition-colors duration-150">
                  <td className="py-3 px-4 font-medium text-textPrimary">{v.name}</td>
                  <td className="py-3 px-4 text-textSecondary space-y-1">
                    {v.email && (
                      <div className="flex items-center space-x-1">
                        <Mail size={12} className="text-textMuted" />
                        <span>{v.email}</span>
                      </div>
                    )}
                    {v.phone && (
                      <div className="flex items-center space-x-1">
                        <Phone size={12} className="text-textMuted" />
                        <span>{v.phone}</span>
                      </div>
                    )}
                    {!v.email && !v.phone && <span className="text-textMuted font-mono">-</span>}
                  </td>
                  <td className="py-3 px-4 text-textSecondary max-w-[220px] truncate" title={v.products_supplied || ""}>
                    {v.products_supplied || <span className="text-textMuted font-mono">-</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center">{renderStars(v.rating)}</div>
                  </td>
                  <td className="py-3 px-4 text-textSecondary">{v.category}</td>
                  <td className="py-3 px-4 text-textSecondary">{v.payment_terms}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Slide Over Form */}
      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        title="Add New Vendor"
        subtitle="Register a new commercial partner and rate their performance"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {errorMessage && (
            <div className="bg-danger/10 border border-danger/20 text-danger p-3 rounded-custom flex items-center space-x-2 text-xs font-mono">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Vendor Name */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              Vendor Name <span className="text-danger">*</span>
            </label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Acme Timber Materials Ltd"
              required
              className="w-full bg-background border border-border rounded-custom py-1.5 px-3 text-xs text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Email Address */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              Email Address
            </label>
            <input 
              type="email" 
              value={formData.email} 
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="vendor@company.com"
              className="w-full bg-background border border-border rounded-custom py-1.5 px-3 text-xs text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Contact Number */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              Contact Number
            </label>
            <input 
              type="text" 
              value={formData.phone} 
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g. +1 (555) 123-4567"
              className="w-full bg-background border border-border rounded-custom py-1.5 px-3 text-xs text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Products They Supply */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              Products They Supply
            </label>
            <textarea 
              value={formData.products_supplied} 
              onChange={(e) => setFormData({ ...formData, products_supplied: e.target.value })}
              placeholder="e.g. Teak wood, oak panels, screws, metal brackets..."
              rows={3}
              className="w-full bg-background border border-border rounded-custom py-1.5 px-3 text-xs text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent resize-none font-sans"
            />
          </div>

          {/* Rating */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              Performance Rating
            </label>
            <select
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
              className="w-full bg-background border border-border rounded-custom py-1.5 px-3 text-xs text-textPrimary focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="5">⭐⭐⭐⭐⭐ - Excellent Partner</option>
              <option value="4">⭐⭐⭐⭐ - Good Quality</option>
              <option value="3">⭐⭐⭐ - Acceptable / Average</option>
              <option value="2">⭐⭐ - Below Average / Slow</option>
              <option value="1">⭐ - Poor Performance</option>
            </select>
          </div>

          {/* Category */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              Vendor Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full bg-background border border-border rounded-custom py-1.5 px-3 text-xs text-textPrimary focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="RawMaterials">Raw Materials</option>
              <option value="FinishedGoods">Finished Goods</option>
              <option value="Logistics">Logistics</option>
              <option value="Services">Services</option>
            </select>
          </div>

          {/* Payment Terms */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              Payment Terms
            </label>
            <select
              value={formData.payment_terms}
              onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
              className="w-full bg-background border border-border rounded-custom py-1.5 px-3 text-xs text-textPrimary focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="PrePaid">PrePaid</option>
              <option value="Net15">Net 15</option>
              <option value="Net30">Net 30</option>
              <option value="Net60">Net 60</option>
            </select>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end space-x-2 mt-6">
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
