import React, { useState } from "react";
import { useErpStore } from "../store/erpStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  FileText, Download, RefreshCw, Plus, ExternalLink,
  ShoppingBag, ShoppingCart, Search, Filter, Loader2, XCircle
} from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n ?? 0);

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const typeBadge = {
  SalesInvoice:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PurchaseInvoice: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};
const statusBadge = {
  Issued:    "bg-green-500/10 text-green-400",
  Draft:     "bg-yellow-500/10 text-yellow-400",
  Paid:      "bg-accent/10 text-accent",
  Cancelled: "bg-red-500/10 text-red-400",
};

export default function Invoices() {
  const { currentRole } = useErpStore();
  const queryClient = useQueryClient();
  const isAdmin = ["SuperAdmin", "StoreAdmin", "BusinessOwner", "SalesUser", "PurchaseUser"].includes(currentRole);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [showGenModal, setShowGenModal] = useState(false);
  const [genType, setGenType] = useState("sales");
  const [genOrderId, setGenOrderId] = useState("");
  const [genNotes, setGenNotes] = useState("");
  const [genError, setGenError] = useState("");

  // ── Data fetching ────────────────────────────────────────────────────────────
  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.get("/invoices/"),
    enabled: isAdmin,
  });

  const { data: salesOrders = [] } = useQuery({
    queryKey: ["salesOrders"],
    queryFn: () => api.get("/sales-orders/"),
    enabled: showGenModal && genType === "sales",
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => api.get("/purchase-orders/"),
    enabled: showGenModal && genType === "purchase",
  });

  // ── Generate mutation ────────────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: ({ type, orderId, notes }) => {
      const endpoint = type === "sales"
        ? `/invoices/sales-orders/${orderId}/generate`
        : `/invoices/purchase-orders/${orderId}/generate`;
      return api.post(endpoint + (notes ? `?notes=${encodeURIComponent(notes)}` : ""));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setShowGenModal(false);
      setGenOrderId("");
      setGenNotes("");
      setGenError("");
    },
    onError: (err) => setGenError(err?.detail ?? err?.message ?? "Generation failed"),
  });

  const handleGenerate = () => {
    if (!genOrderId) { setGenError("Select an order first"); return; }
    setGenError("");
    generateMutation.mutate({ type: genType, orderId: genOrderId, notes: genNotes });
  };

  // ── Filters ──────────────────────────────────────────────────────────────────
  const filtered = invoices.filter((inv) => {
    const matchSearch =
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.party_name.toLowerCase().includes(search.toLowerCase()) ||
      inv.reference_number.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "ALL" || inv.type === typeFilter;
    return matchSearch && matchType;
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-textSecondary">You do not have permission to view invoices.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-textPrimary flex items-center gap-2">
            <FileText size={22} className="text-accent" /> Invoices
          </h1>
          <p className="text-xs text-textSecondary mt-0.5">Generate & download PDF invoices stored in Google Cloud</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()}
            className="p-2 border border-border bg-card rounded-custom text-textSecondary hover:text-textPrimary hover:bg-elevated transition-colors">
            <RefreshCw size={15} />
          </button>
          <button onClick={() => { setShowGenModal(true); setGenType("sales"); setGenOrderId(""); setGenNotes(""); setGenError(""); }}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-custom text-sm font-medium hover:bg-accent/90 transition-colors">
            <Plus size={15} /> Generate Invoice
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-textMuted" size={13} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, party, order..."
            className="bg-card border border-border rounded-custom pl-8 pr-3 py-2 text-xs text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent w-64"
          />
        </div>
        <div className="relative flex items-center">
          <Filter className="absolute left-3 text-textMuted" size={12} />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-card border border-border rounded-custom pl-8 pr-3 py-2 text-xs text-textPrimary focus:outline-none focus:border-accent appearance-none cursor-pointer">
            <option value="ALL">All Types</option>
            <option value="SalesInvoice">Sales Invoices</option>
            <option value="PurchaseInvoice">Purchase Invoices</option>
          </select>
        </div>
        <span className="text-xs text-textSecondary ml-auto">{filtered.length} invoices</span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-custom overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-accent" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <FileText size={36} className="text-textMuted mb-3" />
            <p className="text-sm text-textSecondary font-medium">No invoices yet</p>
            <p className="text-xs text-textMuted mt-1">Click "Generate Invoice" to create your first PDF invoice</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs min-w-[780px]">
            <thead>
              <tr className="bg-elevated/40 border-b border-border text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Reference Order</th>
                <th className="py-3 px-4">Party</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-elevated/20 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-textPrimary">{inv.invoice_number}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeBadge[inv.type] ?? "bg-elevated text-textSecondary"}`}>
                      {inv.type === "SalesInvoice" ? <ShoppingBag size={10} /> : <ShoppingCart size={10} />}
                      {inv.type.replace("Invoice", "")}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-textSecondary">{inv.reference_number}</td>
                  <td className="py-3 px-4 text-textPrimary">
                    <div>{inv.party_name}</div>
                    {inv.party_email && <div className="text-textMuted text-[10px]">{inv.party_email}</div>}
                  </td>
                  <td className="py-3 px-4 text-textSecondary">{fmtDate(inv.created_at)}</td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-textPrimary">{fmt(inv.total_amount)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge[inv.status] ?? "bg-elevated text-textSecondary"}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {inv.gcs_url ? (
                      <a href={inv.gcs_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-accent/10 text-accent border border-accent/20 rounded-custom text-[10px] font-semibold hover:bg-accent/20 transition-colors">
                        <Download size={11} /> Download
                      </a>
                    ) : (
                      <span className="text-textMuted text-[10px]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Generate Modal ── */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-custom w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-textPrimary flex items-center gap-2">
                <FileText size={17} className="text-accent" /> Generate PDF Invoice
              </h3>
              <button onClick={() => setShowGenModal(false)}
                className="p-1 rounded-custom text-textSecondary hover:text-textPrimary hover:bg-elevated transition-colors">
                <XCircle size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Invoice type tabs */}
              <div className="flex rounded-custom border border-border overflow-hidden">
                {["sales", "purchase"].map((t) => (
                  <button key={t} onClick={() => { setGenType(t); setGenOrderId(""); }}
                    className={`flex-1 py-2 text-xs font-semibold capitalize transition-colors ${genType === t
                      ? "bg-accent text-white"
                      : "bg-elevated text-textSecondary hover:text-textPrimary"}`}>
                    {t === "sales" ? "Sales Order" : "Purchase Order"}
                  </button>
                ))}
              </div>

              {/* Order picker */}
              <div>
                <label className="block text-xs font-medium text-textSecondary mb-1.5">Select Order</label>
                <select value={genOrderId} onChange={(e) => setGenOrderId(e.target.value)}
                  className="w-full bg-background border border-border rounded-custom px-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-accent">
                  <option value="">— Pick an order —</option>
                  {(genType === "sales" ? salesOrders : purchaseOrders).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_number} — {o.status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-textSecondary mb-1.5">Notes (optional)</label>
                <textarea
                  value={genNotes} onChange={(e) => setGenNotes(e.target.value)}
                  placeholder="e.g. Payment due within 30 days"
                  rows={2}
                  className="w-full bg-background border border-border rounded-custom px-3 py-2 text-sm text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent resize-none"
                />
              </div>

              {genError && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <XCircle size={13} /> {genError}
                </p>
              )}
            </div>

            <div className="flex gap-2 px-6 pb-6">
              <button onClick={() => setShowGenModal(false)}
                className="flex-1 px-4 py-2 border border-border bg-elevated text-textSecondary rounded-custom text-sm hover:text-textPrimary transition-colors">
                Cancel
              </button>
              <button onClick={handleGenerate} disabled={generateMutation.isPending}
                className="flex-1 px-4 py-2 bg-accent text-white rounded-custom text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors">
                {generateMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                Generate & Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
