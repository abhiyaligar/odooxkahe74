import React from 'react';
import { useErpStore } from '../store/erpStore';
import { Activity } from 'lucide-react';

export default function AuditLogs() {
  const auditLogs = useErpStore(state => state.auditLogs) || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Activity className="text-textSecondary" />
          <h1 className="text-lg font-semibold tracking-tight">System Audit Logs</h1>
        </div>
      </div>

      <div className="w-full border border-border bg-card rounded-custom overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-elevated/40 border-b border-border text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Entity</th>
              <th className="py-3 px-4">Entity ID</th>
              <th className="py-3 px-4">Performed By</th>
              <th className="py-3 px-4">Old Value</th>
              <th className="py-3 px-4">New Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-textMuted font-mono">
                  No audit logs found.
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-elevated/30 transition-colors duration-150">
                  <td className="py-3 px-4 font-mono text-textSecondary">
                    {new Date(log.performed_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-medium text-textPrimary">{log.action}</td>
                  <td className="py-3 px-4 text-textSecondary">{log.entity_type}</td>
                  <td className="py-3 px-4 font-mono text-textMuted">{log.entity_id}</td>
                  <td className="py-3 px-4 text-textSecondary">{log.performed_by}</td>
                  <td className="py-3 px-4 font-mono text-warning">{log.old_value}</td>
                  <td className="py-3 px-4 font-mono text-success">{log.new_value}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
