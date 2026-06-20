import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useErpStore } from '../store/erpStore';
import { api } from '../api/client';
import { User, Mail, Shield, Calendar, Loader2 } from 'lucide-react';

export default function Profile() {
  const { currentRole } = useErpStore();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");

  const { data: currentUser, isLoading, error } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.get('/auth/me'),
  });

  // Role details mapping
  const roleDisplayNames = {
    SuperAdmin: "Super Admin",
    StoreAdmin: "Store Admin",
    SalesUser: "Sales User",
    PurchaseUser: "Purchase User",
    ManufacturingUser: "Manufacturing User",
    InventoryManager: "Inventory Manager",
    BusinessOwner: "Business Owner",
    Customer: "Customer Portal"
  };

  const getInitials = (name) => {
    if (!name) return "US";
    return name.substring(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-textMuted space-y-4">
        <Loader2 className="animate-spin text-accent" size={40} />
        <p className="text-sm font-mono tracking-wide">Loading profile data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-danger space-y-4">
        <Shield size={40} />
        <p className="text-sm font-mono tracking-wide">Failed to load profile.</p>
        <p className="text-xs text-textSecondary">{error.message}</p>
      </div>
    );
  }

  const profileName = currentUser?.name || currentUser?.username || currentUser?.customer_profile?.name || currentUser?.email?.split('@')[0] || "Unknown User";
  
  useEffect(() => {
    if ((currentUser?.name || currentUser?.customer_profile?.name) && !isEditing) {
      setEditName(currentUser.name || currentUser.customer_profile?.name);
    }
  }, [currentUser, isEditing]);

  const profileEmail = currentUser?.email || "No email provided";
  const profileRole = currentUser?.role || currentRole;
  const createdAt = currentUser?.created_at ? new Date(currentUser.created_at).toLocaleDateString() : 'N/A';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-textPrimary">My Profile</h1>
          <p className="text-sm text-textSecondary mt-1">Manage your account information and permissions.</p>
        </div>
        {!isEditing ? (
          <button 
            onClick={() => {
              setEditName(profileName);
              setIsEditing(true);
            }}
            className="bg-elevated border border-border hover:bg-card text-textPrimary px-4 py-2 rounded-custom text-sm font-semibold transition-colors"
          >
            Edit Profile
          </button>
        ) : (
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsEditing(false)}
              className="text-textSecondary hover:text-textPrimary text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={async () => {
                try {
                  await api.put('/auth/me', { name: editName });
                  queryClient.setQueryData(['currentUser'], old => ({ ...old, name: editName }));
                } catch (e) {
                  queryClient.setQueryData(['currentUser'], old => ({ ...old, name: editName }));
                }
                setIsEditing(false);
              }}
              className="bg-accent text-background px-4 py-2 rounded-custom text-sm font-semibold hover:bg-accent/90 transition-colors"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Main Profile Card */}
      <div className="bg-card border border-border rounded-[12px] overflow-hidden shadow-sm">
        {/* Banner */}
        <div className="h-32 w-full bg-gradient-to-r from-accent/20 via-accent/10 to-background border-b border-border relative">
          {/* Avatar floating */}
          <div className="absolute -bottom-10 left-8 h-24 w-24 rounded-full border-4 border-card bg-elevated flex items-center justify-center shadow-lg">
            <span className="text-3xl font-bold font-mono tracking-tighter text-textPrimary">
              {getInitials(profileName)}
            </span>
          </div>
        </div>

        {/* Info Area */}
        <div className="pt-16 pb-8 px-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            {isEditing ? (
              <input 
                type="text" 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-2xl font-bold text-textPrimary bg-background border border-border rounded px-2 py-1 focus:outline-none focus:border-accent w-full max-w-[250px]"
                autoFocus
              />
            ) : (
              <h2 className="text-2xl font-bold text-textPrimary">{profileName}</h2>
            )}
            <div className="flex items-center space-x-2 text-sm text-textSecondary">
              <Mail size={16} />
              <span>{profileEmail}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-textSecondary">
              <Shield size={16} />
              <span>System Role: {roleDisplayNames[profileRole] || profileRole}</span>
            </div>
          </div>
          
          <div className="shrink-0 flex flex-col space-y-3">
             <div className="bg-elevated border border-border rounded-custom px-4 py-3 flex items-center space-x-3">
               <div className="h-8 w-8 rounded-full bg-success/10 text-success flex items-center justify-center">
                 <Shield size={16} />
               </div>
               <div>
                 <p className="text-[10px] uppercase tracking-wider text-textSecondary font-bold">Access Level</p>
                 <p className="text-sm font-semibold text-textPrimary">{roleDisplayNames[profileRole] || profileRole}</p>
               </div>
             </div>
             <div className="bg-elevated border border-border rounded-custom px-4 py-3 flex items-center space-x-3">
               <div className="h-8 w-8 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                 <Calendar size={16} />
               </div>
               <div>
                 <p className="text-[10px] uppercase tracking-wider text-textSecondary font-bold">Member Since</p>
                 <p className="text-sm font-semibold text-textPrimary">{createdAt}</p>
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* Additional Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info */}
        <div className="bg-card border border-border rounded-[12px] p-6 space-y-6">
          <h3 className="text-lg font-bold border-b border-border pb-4 flex items-center space-x-2">
            <User size={18} className="text-textSecondary" />
            <span>Personal Information</span>
          </h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-xs text-textSecondary uppercase tracking-wider font-semibold mb-1">Name</p>
              <p className="text-sm font-medium text-textPrimary">{profileName}</p>
            </div>
            <div>
              <p className="text-xs text-textSecondary uppercase tracking-wider font-semibold mb-1">Email Address</p>
              <p className="text-sm font-medium text-textPrimary">{profileEmail}</p>
            </div>
          </div>
        </div>

        {/* Security / System Info */}
        <div className="bg-card border border-border rounded-[12px] p-6 space-y-6">
          <h3 className="text-lg font-bold border-b border-border pb-4 flex items-center space-x-2">
            <Shield size={18} className="text-textSecondary" />
            <span>System Information</span>
          </h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-xs text-textSecondary uppercase tracking-wider font-semibold mb-1">Account Status</p>
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-success"></span>
                <span className="text-sm font-medium text-textPrimary">Active</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-textSecondary uppercase tracking-wider font-semibold mb-1">Assigned Permissions</p>
              <p className="text-sm font-medium text-textPrimary">{roleDisplayNames[profileRole] || profileRole}</p>
              <p className="text-xs text-textSecondary mt-1 leading-relaxed">
                Contact the Super Admin if you need to request additional privileges or modify your assigned role.
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
