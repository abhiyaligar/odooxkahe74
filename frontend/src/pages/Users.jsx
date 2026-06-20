import React, { useState } from 'react';
import { useErpStore } from '../store/erpStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { SlideOver } from '../components/common/SlideOver';
import { Plus, UserPlus, Search, Loader2, ShieldAlert } from 'lucide-react';

export default function Users() {
  const queryClient = useQueryClient();
  const { currentRole } = useErpStore();
  const isAdmin = currentRole === "SuperAdmin" || currentRole === "StoreAdmin";

  const [searchQuery, setSearchQuery] = useState("");
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    role: "SalesUser"
  });

  // Fetch users list
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/auth/users'),
    enabled: isAdmin
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (newUser) => api.post('/auth/users', newUser),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsSlideOverOpen(false);
      setFormData({
        name: "",
        email: "",
        password: "",
        phone: "",
        address: "",
        role: "SalesUser"
      });
      alert("User created successfully!");
    },
    onError: (err) => {
      alert("Failed to create user: " + err.message);
    }
  });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center bg-card border border-border rounded-custom shadow-sm space-y-4">
        <div className="p-3 bg-red-500/10 rounded-full text-red-500">
          <ShieldAlert size={48} />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-textPrimary">Access Denied</h2>
        <p className="text-sm text-textMuted max-w-md">
          Only administrator roles (SuperAdmin, StoreAdmin) are permitted to manage users.
        </p>
      </div>
    );
  }

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password || !formData.role) {
      alert("Please fill in all required fields (Name, Email, Password, Role).");
      return;
    }
    createUserMutation.mutate(formData);
  };

  // Dynamic role list based on current logged in user
  const allRoles = [
    { value: "SuperAdmin", label: "Super Admin" },
    { value: "StoreAdmin", label: "Store Admin" },
    { value: "SalesUser", label: "Sales User" },
    { value: "PurchaseUser", label: "Purchase User" },
    { value: "ManufacturingUser", label: "Manufacturing User" },
    { value: "InventoryManager", label: "Inventory Manager" },
    { value: "BusinessOwner", label: "Business Owner" },
    { value: "Customer", label: "Customer" }
  ];

  const allowedRoles = currentRole === "SuperAdmin"
    ? allRoles
    : allRoles.filter(r => r.value !== "SuperAdmin");

  // Filter users based on search
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeColor = (roleName) => {
    switch (roleName) {
      case 'SuperAdmin':
        return 'bg-red-500/10 text-red-600 border border-red-500/20';
      case 'StoreAdmin':
        return 'bg-purple-500/10 text-purple-600 border border-purple-500/20';
      case 'SalesUser':
        return 'bg-blue-500/10 text-blue-600 border border-blue-500/20';
      case 'PurchaseUser':
        return 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20';
      case 'ManufacturingUser':
        return 'bg-orange-500/10 text-orange-600 border border-orange-500/20';
      case 'InventoryManager':
        return 'bg-teal-500/10 text-teal-600 border border-teal-500/20';
      case 'BusinessOwner':
        return 'bg-pink-500/10 text-pink-600 border border-pink-500/20';
      case 'Customer':
        return 'bg-green-500/10 text-green-600 border border-green-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2">
          <UserPlus className="text-textSecondary" />
          <h1 className="text-lg font-semibold tracking-tight">Users Directory</h1>
        </div>
        <button
          onClick={() => setIsSlideOverOpen(true)}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-accent text-accent-foreground rounded-custom text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
        >
          <Plus size={14} />
          <span>Create User</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md bg-card">
        <Search className="absolute left-3 top-2.5 text-textMuted" size={14} />
        <input
          type="text"
          placeholder="Search by name, email, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-background border border-border rounded-custom py-1.5 pl-9 pr-3 text-xs text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent"
        />
      </div>

      {/* Users Directory Table */}
      <div className="w-full border border-border bg-card rounded-custom overflow-x-auto shadow-sm">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-elevated/40 border-b border-border text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Created Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {isLoading ? (
              <tr>
                <td colSpan="5" className="py-12 text-center text-textMuted font-mono">
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="animate-spin text-textSecondary" size={18} />
                    <span>Loading users directory...</span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="5" className="py-12 text-center text-red-500 font-mono">
                  Error loading users: {error.message}
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-12 text-center text-textMuted font-mono">
                  No users found matching search filters.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-elevated/30 transition-colors duration-150">
                  <td className="py-3 px-4 font-medium text-textPrimary">{user.name}</td>
                  <td className="py-3 px-4 text-textSecondary">{user.email}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${getRoleBadgeColor(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="flex items-center space-x-1.5 text-textSecondary">
                      <span className={`h-2.5 w-2.5 rounded-full ${user.is_active ? 'bg-success' : 'bg-disabled'}`} />
                      <span>{user.is_active ? 'Active' : 'Inactive'}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-textSecondary font-mono">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create User Slide-Over Form */}
      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        title="Create New User Profile"
        subtitle="Administratively provision new staff or customer account credentials."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Name */}
            <div className="flex flex-col space-y-1">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                Full Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Enter user's full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-background border border-border rounded-custom text-textPrimary px-3 py-1.5 text-xs"
              />
            </div>

            {/* Email */}
            <div className="flex flex-col space-y-1">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                Email Address <span className="text-danger">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-background border border-border rounded-custom text-textPrimary px-3 py-1.5 text-xs"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col space-y-1">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                Password <span className="text-danger">*</span>
              </label>
              <input
                type="password"
                required
                placeholder="Password (min. 8 characters)"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-background border border-border rounded-custom text-textPrimary px-3 py-1.5 text-xs"
              />
            </div>

            {/* Role */}
            <div className="flex flex-col space-y-1">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                Role / Access Group <span className="text-danger">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full bg-background border border-border rounded-custom text-textPrimary px-3 py-1.5 text-xs focus:border-accent"
              >
                {allowedRoles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Phone */}
            <div className="flex flex-col space-y-1">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                Phone Number (Optional)
              </label>
              <input
                type="text"
                placeholder="Enter telephone or cell number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-background border border-border rounded-custom text-textPrimary px-3 py-1.5 text-xs"
              />
            </div>

            {/* Address */}
            <div className="flex flex-col space-y-1">
              <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                Physical Address (Optional)
              </label>
              <textarea
                placeholder="Enter street name, unit, and city address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full bg-background border border-border rounded-custom text-textPrimary px-3 py-1.5 text-xs focus:outline-none"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsSlideOverOpen(false)}
              className="px-4 py-2 border border-border hover:bg-elevated/40 rounded-custom text-xs font-semibold text-textSecondary hover:text-textPrimary transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createUserMutation.isPending}
              className="flex items-center space-x-2 px-4 py-2 bg-accent text-accent-foreground hover:opacity-90 rounded-custom text-xs font-semibold transition-all disabled:opacity-50"
            >
              {createUserMutation.isPending && <Loader2 className="animate-spin" size={14} />}
              <span>Save User</span>
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
