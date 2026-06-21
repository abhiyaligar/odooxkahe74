import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useErpStore } from '../store/erpStore';
import { SlideOver } from '../components/common/SlideOver';
import { 
  Users, 
  Plus, 
  Search, 
  Loader2, 
  ShieldAlert, 
  Pencil, 
  Trash2, 
  Mail, 
  Phone, 
  MapPin, 
  Filter 
} from 'lucide-react';

export default function Customers() {
  const queryClient = useQueryClient();
  const { currentRole } = useErpStore();
  const isAdmin = currentRole === "SuperAdmin" || currentRole === "StoreAdmin";

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    category: "Retail"
  });

  const [errorMessage, setErrorMessage] = useState("");

  // Fetch Customers List
  const { data: customers = [], isLoading, error } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers/'),
    enabled: isAdmin
  });

  // Create Customer Mutation
  const createCustomerMutation = useMutation({
    mutationFn: (newCustomer) => api.post('/customers/', newCustomer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsSlideOverOpen(false);
      resetForm();
      alert("Customer created successfully!");
    },
    onError: (err) => {
      setErrorMessage(err.message || "Failed to create customer");
    }
  });

  // Update Customer Mutation
  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, ...updatedData }) => api.put(`/customers/${id}`, updatedData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsSlideOverOpen(false);
      resetForm();
      alert("Customer updated successfully!");
    },
    onError: (err) => {
      setErrorMessage(err.message || "Failed to update customer");
    }
  });

  // Delete Customer Mutation
  const deleteCustomerMutation = useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      alert("Customer deleted successfully!");
    },
    onError: (err) => {
      alert("Failed to delete customer: " + err.message);
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      category: "Retail"
    });
    setEditingCustomer(null);
    setErrorMessage("");
  };

  const handleEditClick = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      category: customer.category || "Retail"
    });
    setIsSlideOverOpen(true);
  };

  const handleDeleteClick = (customer) => {
    if (window.confirm(`Are you sure you want to permanently delete customer "${customer.name}"?`)) {
      deleteCustomerMutation.mutate(customer.id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!formData.name.trim()) {
      setErrorMessage("Customer name is required");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      address: formData.address.trim() || null,
      category: formData.category
    };

    if (editingCustomer) {
      updateCustomerMutation.mutate({ id: editingCustomer.id, ...payload });
    } else {
      createCustomerMutation.mutate(payload);
    }
  };

  // Deny access to other roles
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center bg-card border border-border rounded-custom shadow-sm space-y-4">
        <div className="p-3 bg-red-500/10 rounded-full text-red-500">
          <ShieldAlert size={48} />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-textPrimary">Access Denied</h2>
        <p className="text-sm text-textMuted max-w-md">
          Only administrator roles (SuperAdmin, StoreAdmin) are permitted to view or manage the customer directory.
        </p>
      </div>
    );
  }

  // Filter customers locally by search query and category
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customer.email && customer.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (customer.phone && customer.phone.includes(searchQuery));
    
    const matchesCategory = 
      categoryFilter === "ALL" || 
      customer.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const getCategoryBadgeColor = (category) => {
    switch (category) {
      case 'Retail':
        return 'bg-green-500/10 text-green-500 border border-green-500/20';
      case 'Wholesale':
        return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      case 'Corporate':
        return 'bg-purple-500/10 text-purple-500 border border-purple-500/20';
      case 'Distributor':
        return 'bg-orange-500/10 text-orange-500 border border-orange-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Users className="text-textSecondary" />
          <h1 className="text-lg font-semibold tracking-tight">Customer Directory</h1>
        </div>
        <button
          onClick={() => { resetForm(); setIsSlideOverOpen(true); }}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-accent text-accent-foreground rounded-custom text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
        >
          <Plus size={14} />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1 bg-card">
          <Search className="absolute left-3 top-2.5 text-textMuted" size={14} />
          <input
            type="text"
            placeholder="Search by name, email or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-custom py-1.5 pl-9 pr-3 text-xs text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent"
          />
        </div>

        {/* Category Filter */}
        <div className="relative min-w-[160px] bg-card flex items-center">
          <Filter className="absolute left-3 text-textMuted" size={14} />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-background border border-border rounded-custom py-1.5 pl-9 pr-3 text-xs text-textPrimary focus:outline-none focus:border-accent appearance-none cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="Retail">Retail</option>
            <option value="Wholesale">Wholesale</option>
            <option value="Corporate">Corporate</option>
            <option value="Distributor">Distributor</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="w-full border border-border bg-card rounded-custom overflow-x-auto shadow-sm">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-elevated/40 border-b border-border text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Phone</th>
              <th className="py-3 px-4">Address</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {isLoading ? (
              <tr>
                <td colSpan="6" className="py-12 text-center text-textMuted font-mono">
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="animate-spin text-textSecondary" size={18} />
                    <span>Loading customers list...</span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="6" className="py-12 text-center text-red-500 font-mono">
                  Error loading customers: {error.message}
                </td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-12 text-center text-textMuted font-mono">
                  No customers found matching filters.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-elevated/30 transition-colors duration-150">
                  <td className="py-3 px-4 font-medium text-textPrimary flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-xs uppercase shrink-0">
                      {customer.name ? customer.name.substring(0, 2) : 'CU'}
                    </div>
                    <span>{customer.name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${getCategoryBadgeColor(customer.category)}`}>
                      {customer.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-textSecondary">
                    {customer.email ? (
                      <a href={`mailto:${customer.email}`} className="flex items-center space-x-1 hover:text-accent transition-colors">
                        <Mail size={12} className="text-textMuted shrink-0" />
                        <span className="truncate max-w-[180px]">{customer.email}</span>
                      </a>
                    ) : (
                      <span className="text-textMuted font-mono">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-textSecondary">
                    {customer.phone ? (
                      <a href={`tel:${customer.phone}`} className="flex items-center space-x-1 hover:text-accent transition-colors">
                        <Phone size={12} className="text-textMuted shrink-0" />
                        <span>{customer.phone}</span>
                      </a>
                    ) : (
                      <span className="text-textMuted font-mono">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-textSecondary max-w-[200px] truncate">
                    {customer.address ? (
                      <div className="flex items-center space-x-1" title={customer.address}>
                        <MapPin size={12} className="text-textMuted shrink-0" />
                        <span className="truncate">{customer.address}</span>
                      </div>
                    ) : (
                      <span className="text-textMuted font-mono">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEditClick(customer)}
                        title="Edit Customer"
                        className="p-1.5 rounded text-textMuted hover:text-textPrimary hover:bg-elevated/40 transition-colors"
                        type="button"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(customer)}
                        title="Delete Customer"
                        className="p-1.5 rounded text-textMuted hover:text-danger hover:bg-red-500/10 transition-colors"
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-Over Form */}
      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => { setIsSlideOverOpen(false); resetForm(); }}
        title={editingCustomer ? "Edit Customer Details" : "Add New Customer"}
        subtitle={editingCustomer ? `Update information for customer: ${editingCustomer.name}` : "Create a new customer profile for tracking sales and transactions."}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-danger/10 border border-danger/20 text-danger rounded-custom text-xs font-mono">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {/* Customer Name */}
            <div className="flex flex-col space-y-1">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                Full Name / Business Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Enter customer name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-background border border-border rounded-custom text-textPrimary px-3 py-1.5 text-xs focus:outline-none focus:border-accent"
              />
            </div>

            {/* Customer Category */}
            <div className="flex flex-col space-y-1">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                Customer Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-background border border-border rounded-custom text-textPrimary px-3 py-1.5 text-xs focus:outline-none focus:border-accent"
              >
                <option value="Retail">Retail</option>
                <option value="Wholesale">Wholesale</option>
                <option value="Corporate">Corporate</option>
                <option value="Distributor">Distributor</option>
              </select>
            </div>

            {/* Email */}
            <div className="flex flex-col space-y-1">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                placeholder="customer@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-background border border-border rounded-custom text-textPrimary px-3 py-1.5 text-xs focus:outline-none focus:border-accent"
              />
            </div>

            {/* Phone */}
            <div className="flex flex-col space-y-1">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="e.g. +1234567890"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-background border border-border rounded-custom text-textPrimary px-3 py-1.5 text-xs focus:outline-none focus:border-accent"
              />
            </div>

            {/* Address */}
            <div className="flex flex-col space-y-1">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                Physical / Billing Address
              </label>
              <textarea
                placeholder="Street address, City, Zip"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full bg-background border border-border rounded-custom text-textPrimary px-3 py-1.5 text-xs focus:outline-none focus:border-accent resize-none"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border mt-6">
            <button
              type="button"
              onClick={() => { setIsSlideOverOpen(false); resetForm(); }}
              className="px-4 py-2 border border-border hover:bg-elevated/40 rounded-custom text-xs font-semibold text-textSecondary hover:text-textPrimary transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createCustomerMutation.isPending || updateCustomerMutation.isPending}
              className="flex items-center space-x-2 px-4 py-2 bg-accent text-accent-foreground hover:opacity-90 rounded-custom text-xs font-semibold transition-all disabled:opacity-50"
            >
              {(createCustomerMutation.isPending || updateCustomerMutation.isPending) && <Loader2 className="animate-spin" size={14} />}
              <span>{editingCustomer ? "Save Changes" : "Create Customer"}</span>
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
