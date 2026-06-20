import React, { useState } from 'react';
import { useErpStore } from '../store/erpStore';
import { Activity, ShieldAlert, Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export default function AuditLogs() {
  const { currentRole } = useErpStore();
  const isAdmin = currentRole === "SuperAdmin" || currentRole === "StoreAdmin";

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [userName, setUserName] = useState("All Users");
  const [module, setModule] = useState("All Modules");
  const [action, setAction] = useState("All Actions");
  const [page, setPage] = useState(1);

  // Fetch audit logs with query params
  const { data, isLoading, error } = useQuery({
    queryKey: ['auditLogs', fromDate, toDate, userName, module, action, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (fromDate) params.append('from_date', `${fromDate}T00:00:00`);
      if (toDate) params.append('to_date', `${toDate}T23:59:59`);
      if (userName && userName !== 'All Users') params.append('user_name', userName);
      if (module && module !== 'All Modules') params.append('module', module);
      if (action && action !== 'All Actions') params.append('action', action);
      params.append('skip', String((page - 1) * 10));
      params.append('limit', '10');
      return api.get(`/audit-logs/?${params.toString()}`);
    },
    enabled: isAdmin,
  });

  // Fetch users for filter dropdown
  const { data: usersData = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/auth/users'),
    enabled: isAdmin,
  });

  const handleResetFilters = () => {
    setFromDate("");
    setToDate("");
    setUserName("All Users");
    setModule("All Modules");
    setAction("All Actions");
    setPage(1);
  };

  const getActionBadgeColor = (actionName) => {
    switch (actionName) {
      case 'Create':
        return 'bg-green-500/10 text-green-600 border border-green-500/20';
      case 'Update':
        return 'bg-amber-500/10 text-amber-600 border border-amber-500/20';
      case 'Delete':
      case 'Cancel':
        return 'bg-red-500/10 text-red-600 border border-red-500/20';
      case 'Confirm':
        return 'bg-purple-500/10 text-purple-600 border border-purple-500/20';
      case 'Deliver':
        return 'bg-blue-500/10 text-blue-600 border border-blue-500/20';
      case 'Receive':
        return 'bg-teal-500/10 text-teal-600 border border-teal-500/20';
      case 'Start':
        return 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20';
      case 'Complete':
        return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border border-gray-500/20';
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center bg-card border border-border rounded-custom shadow-sm space-y-4">
        <div className="p-3 bg-red-500/10 rounded-full text-red-500">
          <ShieldAlert size={48} />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-textPrimary">Access Denied</h2>
        <p className="text-sm text-textMuted max-w-md">
          Only administrator roles (SuperAdmin, StoreAdmin) are permitted to query system audit logs.
        </p>
      </div>
    );
  }

  const totalCount = data?.total_count || 0;
  const totalPages = Math.ceil(totalCount / 10) || 1;
  const logs = data?.logs || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center space-x-2">
        <Activity className="text-textSecondary" />
        <h1 className="text-lg font-semibold tracking-tight">System Audit Logs</h1>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-4 rounded-custom flex items-center space-x-4 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-full">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-textMuted uppercase tracking-wider">Total Logs</p>
            <p className="text-2xl font-bold text-textPrimary">{data?.stats?.total ?? 0}</p>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-custom flex items-center space-x-4 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="p-3 bg-green-500/10 text-green-500 rounded-full">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-textMuted uppercase tracking-wider">Creates</p>
            <p className="text-2xl font-bold text-textPrimary">{data?.stats?.created ?? 0}</p>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-custom flex items-center space-x-4 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-full">
            <RefreshCw size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-textMuted uppercase tracking-wider">Updates</p>
            <p className="text-2xl font-bold text-textPrimary">{data?.stats?.updated ?? 0}</p>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-custom flex items-center space-x-4 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="p-3 bg-red-500/10 text-red-500 rounded-full">
            <XCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-textMuted uppercase tracking-wider">Deletions</p>
            <p className="text-2xl font-bold text-textPrimary">{data?.stats?.deleted ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-card border border-border p-4 rounded-custom shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="text-sm font-semibold text-textPrimary">Advanced Filters</span>
          <button 
            onClick={handleResetFilters}
            className="text-xs font-medium text-accent hover:underline"
          >
            Reset Filters
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* From Date */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">From Date</label>
            <input 
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="w-full bg-background border border-border rounded-custom text-textPrimary text-xs px-3 py-1.5 focus:border-accent"
            />
          </div>

          {/* To Date */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">To Date</label>
            <input 
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="w-full bg-background border border-border rounded-custom text-textPrimary text-xs px-3 py-1.5 focus:border-accent"
            />
          </div>

          {/* Users */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Users</label>
            <select 
              value={userName}
              onChange={(e) => { setUserName(e.target.value); setPage(1); }}
              className="w-full bg-background border border-border rounded-custom text-textPrimary text-xs px-3 py-1.5 focus:border-accent"
            >
              <option value="All Users">All Users</option>
              {usersData.map((u) => (
                <option key={u.id} value={u.name}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Modules */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Module</label>
            <select 
              value={module}
              onChange={(e) => { setModule(e.target.value); setPage(1); }}
              className="w-full bg-background border border-border rounded-custom text-textPrimary text-xs px-3 py-1.5 focus:border-accent"
            >
              <option value="All Modules">All Modules</option>
              <option value="Sales">Sales</option>
              <option value="Purchase">Purchase</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Inventory">Inventory</option>
              <option value="Auth">Auth</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Action Type</label>
            <select 
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1); }}
              className="w-full bg-background border border-border rounded-custom text-textPrimary text-xs px-3 py-1.5 focus:border-accent"
            >
              <option value="All Actions">All Actions</option>
              <option value="Create">Create</option>
              <option value="Update">Update</option>
              <option value="Delete">Delete</option>
              <option value="Confirm">Confirm</option>
              <option value="Deliver">Deliver</option>
              <option value="Receive">Receive</option>
              <option value="Cancel">Cancel</option>
              <option value="Start">Start</option>
              <option value="Complete">Complete</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="w-full border border-border bg-card rounded-custom overflow-x-auto shadow-sm">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-elevated/40 border-b border-border text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              <th className="py-3 px-4">Date & Time</th>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Module</th>
              <th className="py-3 px-4">Record Type</th>
              <th className="py-3 px-4">Record ID</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Field Changed</th>
              <th className="py-3 px-4 text-center">Old Value</th>
              <th className="py-3 px-4 text-center">New Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {isLoading ? (
              <tr>
                <td colSpan="9" className="py-12 text-center text-textMuted font-mono">
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="animate-spin text-textSecondary" size={18} />
                    <span>Loading logs...</span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="9" className="py-12 text-center text-red-500 font-mono">
                  Error loading audit logs: {error.message}
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="9" className="py-12 text-center text-textMuted font-mono">
                  No audit logs found matching selected filters.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-elevated/30 transition-colors duration-150">
                  <td className="py-3 px-4 font-mono text-textSecondary whitespace-nowrap">
                    {new Date(log.performed_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-medium text-textPrimary">{log.user_name}</td>
                  <td className="py-3 px-4 text-textSecondary">{log.module}</td>
                  <td className="py-3 px-4 text-textSecondary">{log.record_type}</td>
                  <td className="py-3 px-4 font-mono text-textMuted text-[10px] break-all max-w-[120px] truncate" title={log.record_id}>
                    {log.record_id}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${getActionBadgeColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-textSecondary">{log.field_changed || '-'}</td>
                  <td className="py-3 px-4 font-mono text-warning text-center max-w-[150px] truncate" title={log.old_value || '-'}>
                    {log.old_value || '-'}
                  </td>
                  <td className="py-3 px-4 font-mono text-success text-center max-w-[150px] truncate" title={log.new_value || '-'}>
                    {log.new_value || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-3 py-1.5 bg-card border border-border rounded-custom text-textPrimary hover:bg-elevated/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="text-textSecondary">
          Page {page} of {totalPages} ({totalCount} total logs)
        </span>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="px-3 py-1.5 bg-card border border-border rounded-custom text-textPrimary hover:bg-elevated/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
