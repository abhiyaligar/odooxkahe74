import React, { useState, useCallback } from 'react';
import { useErpStore } from '../store/erpStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Send,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  Building2,
  User,
  Loader2,
  AlertTriangle,
  IndianRupee,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

const STORE_WALLET_ID = '00000000-0000-0000-0000-000000000000';
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || '';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n ?? 0);

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const txTypeColors = {
  TopUp:           { bg: 'bg-green-500/10',  text: 'text-green-400',  icon: ArrowDownLeft  },
  PurchasePayment: { bg: 'bg-red-500/10',    text: 'text-red-400',    icon: ArrowUpRight   },
  SaleReceipt:     { bg: 'bg-blue-500/10',   text: 'text-blue-400',   icon: ArrowDownLeft  },
  Refund:          { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: ArrowLeftRight },
  Transfer:        { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: Send           },
};

const statusBadge = {
  Completed: 'bg-green-500/10 text-green-400',
  Pending:   'bg-yellow-500/10 text-yellow-400',
  Failed:    'bg-red-500/10 text-red-400',
};

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const StatCard = ({ label, value, icon: Icon, colorClass, loading }) => (
  <div className="bg-card border border-border rounded-custom p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-custom flex items-center justify-center ${colorClass}-bg`}>
      <Icon className={colorClass} size={22} />
    </div>
    <div>
      <p className="text-xs text-textSecondary font-medium mb-0.5">{label}</p>
      {loading
        ? <div className="h-5 w-24 bg-elevated rounded animate-pulse" />
        : <p className="text-xl font-bold text-textPrimary">{value}</p>
      }
    </div>
  </div>
);

const TxRow = ({ tx }) => {
  const kind = txTypeColors[tx.type] ?? txTypeColors.Transfer;
  const Icon = kind.icon;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0 hover:bg-elevated/30 px-4 -mx-4 rounded-custom transition-colors">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${kind.bg}`}>
        <Icon size={16} className={kind.text} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-textPrimary truncate">{tx.type.replace(/([A-Z])/g, ' $1').trim()}</p>
        <p className="text-xs text-textSecondary truncate">{fmtDate(tx.created_at)}</p>
        {tx.reference_id && <p className="text-xs text-textMuted font-mono truncate">Ref: {tx.reference_id}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold ${kind.text}`}>{fmt(tx.amount)}</p>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusBadge[tx.status] ?? 'bg-elevated text-textSecondary'}`}>{tx.status}</span>
      </div>
    </div>
  );
};

export default function WalletPage() {
  const { currentRole } = useErpStore();
  const queryClient = useQueryClient();
  const isAdmin = ['SuperAdmin', 'StoreAdmin'].includes(currentRole);

  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.get('/auth/me'),
  });

  const [selectedWalletId, setSelectedWalletId] = useState(null);
  const walletId = selectedWalletId ?? (isAdmin ? STORE_WALLET_ID : currentUser?.id);

  const { data: walletData, isLoading: walletLoading, refetch: refetchWallet } = useQuery({
    queryKey: ['wallet', walletId],
    queryFn: () => api.get(`/wallets/${walletId}`),
    enabled: !!walletId,
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['walletTxs', walletId],
    queryFn: () => api.get(`/wallets/${walletId}/transactions`),
    enabled: !!walletId,
  });

  const { data: vendorsRaw } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get('/vendors/'),
    enabled: isAdmin,
  });
  const vendors = Array.isArray(vendorsRaw) ? vendorsRaw : (vendorsRaw?.vendors ?? []);

  const { data: usersRaw } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/auth/users'),
    enabled: isAdmin,
  });
  const users = Array.isArray(usersRaw) ? usersRaw : (usersRaw?.users ?? []);

  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState('');

  const handleTopUp = useCallback(async () => {
    const amt = parseFloat(topUpAmount);
    if (!amt || amt <= 0) { setTopUpError('Enter a valid amount'); return; }
    setTopUpError('');
    setTopUpLoading(true);
    try {
      const order = await api.post(`/wallets/${walletId}/topup/initiate`, { amount: amt });
      const isMockOrder = order.razorpay_order_id.startsWith('order_mock_');

      // ── Mock path: no key configured OR backend fell back due to bad credentials ──
      if (!RAZORPAY_KEY_ID || isMockOrder) {
        if (RAZORPAY_KEY_ID && isMockOrder) {
          // Key is set but backend fell back → credentials are invalid
          setTopUpError(
            '⚠️ Razorpay credentials are invalid (401). Wallet topped up in mock mode. Please update your API keys in Settings.'
          );
        }
        await api.post(`/wallets/${walletId}/topup/verify`, {
          razorpay_order_id: order.razorpay_order_id,
          razorpay_payment_id: `mock_pay_${Date.now()}`,
          razorpay_signature: 'mock_sig',
        });
        queryClient.invalidateQueries({ queryKey: ['wallet', walletId] });
        queryClient.invalidateQueries({ queryKey: ['walletTxs', walletId] });
        setTopUpAmount('');
        setTopUpLoading(false);
        if (!RAZORPAY_KEY_ID || !isMockOrder) setShowTopUp(false);
        return;
      }

      // ── Razorpay path: valid order ID returned from backend ───────────────
      const razorpayLoaded = await loadRazorpay();
      if (!razorpayLoaded) {
        setTopUpError('Failed to load Razorpay SDK. Check your internet connection.');
        setTopUpLoading(false);
        return;
      }

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: amt * 100,
        currency: 'INR',
        name: 'AutoCraft',
        description: 'Wallet Top-Up',
        order_id: order.razorpay_order_id,
        handler: async (response) => {
          await api.post(`/wallets/${walletId}/topup/verify`, {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          queryClient.invalidateQueries({ queryKey: ['wallet', walletId] });
          queryClient.invalidateQueries({ queryKey: ['walletTxs', walletId] });
          setShowTopUp(false);
          setTopUpAmount('');
        },
        prefill: { name: currentUser?.name ?? '', email: currentUser?.email ?? '' },
        theme: { color: '#6366f1' },
        modal: { ondismiss: () => setTopUpLoading(false) },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setTopUpError(err?.detail ?? err?.message ?? 'Top-up failed');
    } finally {
      setTopUpLoading(false);
    }
  }, [walletId, topUpAmount, currentUser, queryClient]);

  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({ from: STORE_WALLET_ID, to: '', amount: '', ref: '' });
  const [transferError, setTransferError] = useState('');

  const transferMutation = useMutation({
    mutationFn: (payload) => api.post('/wallets/transfer', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['walletTxs'] });
      setShowTransfer(false);
      setTransferForm({ from: STORE_WALLET_ID, to: '', amount: '', ref: '' });
      setTransferError('');
    },
    onError: (err) => setTransferError(err?.detail ?? 'Transfer failed'),
  });

  const handleTransfer = () => {
    const amt = parseFloat(transferForm.amount);
    if (!amt || amt <= 0) { setTransferError('Enter a valid amount'); return; }
    if (!transferForm.to) { setTransferError('Select a destination wallet'); return; }
    if (transferForm.from === transferForm.to) { setTransferError('Source and destination cannot be the same'); return; }
    setTransferError('');
    transferMutation.mutate({
      from_wallet_id: transferForm.from,
      to_wallet_id: transferForm.to,
      amount: amt,
      reference_id: transferForm.ref || undefined,
    });
  };

  const walletOptions = [
    { id: STORE_WALLET_ID, label: 'Store Wallet (Company)' },
    ...(users || []).map(u => ({ id: u.id, label: `${u.name ?? u.email} (${u.role})` })),
    ...(vendors || []).map(v => ({ id: v.id, label: `${v.name} (Vendor)` })),
  ];

  const totalIn  = transactions.filter(t => ['TopUp','SaleReceipt'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => ['PurchasePayment','Transfer'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
  const pendingTx = transactions.filter(t => t.status === 'Pending').length;
  const loading = walletLoading || userLoading;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-textPrimary flex items-center gap-2">
            <Wallet size={24} className="text-accent" /> Wallet
          </h1>
          <p className="text-sm text-textSecondary mt-0.5">Manage balances, top-ups and fund transfers</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { refetchWallet(); queryClient.invalidateQueries({ queryKey: ['walletTxs', walletId] }); }}
            className="p-2 border border-border bg-card rounded-custom text-textSecondary hover:text-textPrimary hover:bg-elevated transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowTopUp(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-custom text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <Plus size={15} /> Top Up
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowTransfer(true)}
              className="flex items-center gap-2 px-4 py-2 border border-border bg-card text-textPrimary rounded-custom text-sm font-medium hover:bg-elevated transition-colors"
            >
              <Send size={15} /> Transfer
            </button>
          )}
        </div>
      </div>

      {/* Admin Wallet Picker */}
      {isAdmin && (
        <div className="bg-card border border-border rounded-custom p-4">
          <label className="block text-xs font-medium text-textSecondary mb-2">Viewing Wallet</label>
          <select
            value={selectedWalletId ?? STORE_WALLET_ID}
            onChange={(e) => setSelectedWalletId(e.target.value)}
            className="w-full sm:w-96 bg-background border border-border rounded-custom px-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-accent"
          >
            {walletOptions.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-accent/20 via-purple-600/10 to-transparent border border-accent/30 rounded-custom p-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-sm text-textSecondary font-medium mb-1 flex items-center gap-1.5">
              {(selectedWalletId === STORE_WALLET_ID || (!selectedWalletId && isAdmin))
                ? <><Building2 size={14} /> Store / Company Wallet</>
                : <><User size={14} /> My Wallet</>
              }
            </p>
            {loading
              ? <div className="h-10 w-44 bg-elevated rounded animate-pulse" />
              : <p className="text-4xl font-extrabold text-textPrimary tracking-tight">{fmt(walletData?.balance)}</p>
            }
            <p className="text-xs text-textSecondary mt-1">{walletData?.currency ?? 'INR'} • Available Balance</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-textSecondary font-mono bg-elevated/60 border border-border px-3 py-1.5 rounded-custom">
            <CreditCard size={13} /> {walletId ?? '—'}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-custom p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-custom flex items-center justify-center bg-green-500/10">
            <TrendingUp className="text-green-400" size={22} />
          </div>
          <div>
            <p className="text-xs text-textSecondary font-medium mb-0.5">Total Inflow</p>
            {txLoading ? <div className="h-5 w-24 bg-elevated rounded animate-pulse" /> : <p className="text-xl font-bold text-textPrimary">{fmt(totalIn)}</p>}
          </div>
        </div>
        <div className="bg-card border border-border rounded-custom p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-custom flex items-center justify-center bg-red-500/10">
            <TrendingDown className="text-red-400" size={22} />
          </div>
          <div>
            <p className="text-xs text-textSecondary font-medium mb-0.5">Total Outflow</p>
            {txLoading ? <div className="h-5 w-24 bg-elevated rounded animate-pulse" /> : <p className="text-xl font-bold text-textPrimary">{fmt(totalOut)}</p>}
          </div>
        </div>
        <div className="bg-card border border-border rounded-custom p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-custom flex items-center justify-center bg-yellow-500/10">
            <Clock className="text-yellow-400" size={22} />
          </div>
          <div>
            <p className="text-xs text-textSecondary font-medium mb-0.5">Pending Transactions</p>
            {txLoading ? <div className="h-5 w-24 bg-elevated rounded animate-pulse" /> : <p className="text-xl font-bold text-textPrimary">{pendingTx}</p>}
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-card border border-border rounded-custom">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-textPrimary">Transaction History</h2>
          <span className="text-xs text-textSecondary">{transactions.length} records</span>
        </div>
        {txLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-accent" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Wallet size={36} className="text-textMuted mb-3" />
            <p className="text-sm font-medium text-textSecondary">No transactions yet</p>
            <p className="text-xs text-textMuted mt-1">Top-up the wallet to get started</p>
          </div>
        ) : (
          <div className="px-4 py-2">
            {transactions.map(tx => <TxRow key={tx.id} tx={tx} />)}
          </div>
        )}
      </div>

      {/* Top-Up Modal */}
      {showTopUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-custom w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-textPrimary flex items-center gap-2">
                <IndianRupee size={18} className="text-accent" /> Top Up Wallet
              </h3>
              <button onClick={() => { setShowTopUp(false); setTopUpError(''); setTopUpAmount(''); }}
                className="p-1 rounded-custom text-textSecondary hover:text-textPrimary hover:bg-elevated transition-colors">
                <XCircle size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-textSecondary mb-1.5">Amount (INR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-textSecondary text-sm">₹</span>
                  <input
                    type="number" min="1" value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full bg-background border border-border rounded-custom pl-7 pr-3 py-2 text-sm text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[500, 1000, 5000, 10000, 50000].map(n => (
                  <button key={n} onClick={() => setTopUpAmount(String(n))}
                    className={`text-xs px-3 py-1.5 rounded-custom border transition-colors ${String(topUpAmount) === String(n)
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'border-border bg-elevated text-textSecondary hover:text-textPrimary hover:border-accent'}`}>
                    {fmt(n)}
                  </button>
                ))}
              </div>
              {!RAZORPAY_KEY_ID && (
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-custom text-xs text-yellow-400">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span><strong>VITE_RAZORPAY_KEY_ID</strong> not set — running in <em>mock mode</em>. Wallet will be credited directly.</span>
                </div>
              )}
              {topUpError && <p className="text-xs text-red-400 flex items-center gap-1"><XCircle size={13} /> {topUpError}</p>}
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button onClick={() => { setShowTopUp(false); setTopUpError(''); setTopUpAmount(''); }}
                className="flex-1 px-4 py-2 border border-border bg-elevated text-textSecondary rounded-custom text-sm hover:text-textPrimary transition-colors">
                Cancel
              </button>
              <button onClick={handleTopUp} disabled={topUpLoading || !topUpAmount}
                className="flex-1 px-4 py-2 bg-accent text-accent-foreground rounded-custom text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors">
                {topUpLoading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {RAZORPAY_KEY_ID ? 'Pay via Razorpay' : 'Add Funds (Mock)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal (Admin) */}
      {showTransfer && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-custom w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-textPrimary flex items-center gap-2">
                <Send size={18} className="text-accent" /> Transfer Funds
              </h3>
              <button onClick={() => { setShowTransfer(false); setTransferError(''); }}
                className="p-1 rounded-custom text-textSecondary hover:text-textPrimary hover:bg-elevated transition-colors">
                <XCircle size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-textSecondary mb-1.5">From Wallet</label>
                <select value={transferForm.from} onChange={(e) => setTransferForm(f => ({ ...f, from: e.target.value }))}
                  className="w-full bg-background border border-border rounded-custom px-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-accent">
                  {walletOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-textSecondary mb-1.5">To Wallet</label>
                <select value={transferForm.to} onChange={(e) => setTransferForm(f => ({ ...f, to: e.target.value }))}
                  className="w-full bg-background border border-border rounded-custom px-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-accent">
                  <option value="">— Select destination —</option>
                  {walletOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-textSecondary mb-1.5">Amount (INR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-textSecondary text-sm">₹</span>
                  <input type="number" min="1" value={transferForm.amount}
                    onChange={(e) => setTransferForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="Enter amount"
                    className="w-full bg-background border border-border rounded-custom pl-7 pr-3 py-2 text-sm text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-textSecondary mb-1.5">Reference (optional)</label>
                <input type="text" value={transferForm.ref}
                  onChange={(e) => setTransferForm(f => ({ ...f, ref: e.target.value }))}
                  placeholder="e.g. PO-0023"
                  className="w-full bg-background border border-border rounded-custom px-3 py-2 text-sm text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accent" />
              </div>
              {transferError && <p className="text-xs text-red-400 flex items-center gap-1"><XCircle size={13} /> {transferError}</p>}
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button onClick={() => { setShowTransfer(false); setTransferError(''); }}
                className="flex-1 px-4 py-2 border border-border bg-elevated text-textSecondary rounded-custom text-sm hover:text-textPrimary transition-colors">
                Cancel
              </button>
              <button onClick={handleTransfer} disabled={transferMutation.isPending}
                className="flex-1 px-4 py-2 bg-accent text-accent-foreground rounded-custom text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors">
                {transferMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
