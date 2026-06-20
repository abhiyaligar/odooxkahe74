import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Loader2, Users } from 'lucide-react';

export default function Vendors() {
  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get('/vendors/')
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Users className="text-textSecondary" />
          <h1 className="text-lg font-semibold tracking-tight">Vendors List</h1>
        </div>
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
    </div>
  );
}
