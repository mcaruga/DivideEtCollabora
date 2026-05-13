import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';
import {
  Users, BarChart2, Globe, Shield, Trash2, ChevronLeft, ChevronRight,
  Search, CheckCircle, XCircle, Crown, AlertTriangle, RefreshCw,
  Mail, Send, X, UserPlus, DollarSign, ArrowUpDown, Phone,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */
interface AdminStats {
  totalUsers: number; premiumUsers: number; activeUsers: number;
  totalGroups: number; totalExpenses: number; totalAmountProcessed: number;
}
interface AdminUser {
  id: number; email: string; name: string; avatar_color: string;
  is_premium: boolean; is_admin: boolean; is_active: boolean;
  phone?: string; created_at: string; group_count: number; expense_count: number;
}
interface AdminGroup {
  id: number; name: string; type: string; cover_color: string;
  created_at: string; member_count: number; expense_count: number; creator_name: string;
}
type Tab = 'overview' | 'users' | 'groups';
type SortField = 'createdAt' | 'name' | 'email';

/* ─── Helpers ────────────────────────────────────────────── */
function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function isEmailLike(s: string) { return /^[^\s@]+@[^\s@]+/.test(s); }
function isPhoneLike(s: string) { return /^[+\d][\d\s\-().]{5,}$/.test(s.trim()); }
function formatPhone(p: string) {
  const d = p.replace(/\D/g, '');
  return d.startsWith('39') ? `+${d}` : p.startsWith('+') ? p : `+${d}`;
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Invite Modal ───────────────────────────────────────── */
function InviteModal({ prefillEmail, onClose }: { prefillEmail: string; onClose: () => void }) {
  const [email, setEmail] = useState(prefillEmail);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'exists' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const send = async () => {
    setStatus('loading');
    try {
      await api.post('/admin/users/invite', { email, message: message || undefined });
      setStatus('sent');
    } catch (e: any) {
      if (e.response?.status === 409) setStatus('exists');
      else { setStatus('error'); setErrMsg(e.response?.data?.error || 'Errore'); }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-emerald-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Invita nuovo utente</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {status === 'sent' ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-7 h-7 text-emerald-600" />
              </div>
              <p className="font-semibold text-gray-900 text-lg">Invito inviato!</p>
              <p className="text-gray-500 text-sm mt-1">Email spedita a <strong>{email}</strong></p>
              <button onClick={onClose} className="mt-5 px-6 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600">
                Chiudi
              </button>
            </div>
          ) : status === 'exists' ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-7 h-7 text-amber-600" />
              </div>
              <p className="font-semibold text-gray-900">Utente già registrato</p>
              <p className="text-gray-500 text-sm mt-1"><strong>{email}</strong> ha già un account.</p>
              <button onClick={onClose} className="mt-5 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">
                Chiudi
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Indirizzo email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      ref={inputRef}
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="nome@esempio.com"
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Messaggio personale <span className="text-gray-400 font-normal">(opzionale)</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Scrivi un messaggio di benvenuto..."
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>
                {status === 'error' && (
                  <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{errMsg}</p>
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Annulla
                </button>
                <button
                  onClick={send}
                  disabled={!email || status === 'loading'}
                  className="flex-1 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {status === 'loading' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Send className="w-4 h-4" /> Invia invito</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── WhatsApp Invite Modal ──────────────────────────────── */
function WhatsAppModal({ prefillPhone, onClose }: { prefillPhone: string; onClose: () => void }) {
  const [phone, setPhone] = useState(prefillPhone);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'exists' | 'error'>('idle');
  const [waUrl, setWaUrl] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const prepare = async () => {
    setStatus('loading');
    try {
      const res = await api.post('/admin/users/invite-whatsapp', {
        phone,
        message: message || undefined,
      });
      setWaUrl(res.data.whatsappUrl);
      setStatus('ready');
    } catch (e: any) {
      if (e.response?.status === 409) setStatus('exists');
      else { setStatus('error'); setErrMsg(e.response?.data?.error || 'Errore'); }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <Phone className="w-4 h-4 text-green-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Invita via WhatsApp</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {status === 'ready' ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Phone className="w-7 h-7 text-green-600" />
              </div>
              <p className="font-semibold text-gray-900 text-lg mb-1">Pronto!</p>
              <p className="text-gray-500 text-sm mb-5">
                Clicca il bottone per aprire WhatsApp con il messaggio precompilato.
              </p>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Apri WhatsApp
              </a>
              <button onClick={onClose} className="block mx-auto mt-3 text-sm text-gray-400 hover:text-gray-600">
                Annulla
              </button>
            </div>
          ) : status === 'exists' ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-7 h-7 text-amber-600" />
              </div>
              <p className="font-semibold text-gray-900">Numero già registrato</p>
              <p className="text-gray-500 text-sm mt-1">Questo numero è già associato a un account.</p>
              <button onClick={onClose} className="mt-5 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">
                Chiudi
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Numero di telefono <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      ref={inputRef}
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+39 333 1234567"
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Includi il prefisso internazionale (es. +39 per Italia)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Messaggio personalizzato <span className="text-gray-400 font-normal">(opzionale)</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Lascia vuoto per usare il messaggio predefinito..."
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  />
                </div>
                {status === 'error' && (
                  <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{errMsg}</p>
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Annulla
                </button>
                <button
                  onClick={prepare}
                  disabled={!phone || status === 'loading'}
                  className="flex-1 py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {status === 'loading'
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <><Phone className="w-4 h-4" /> Prepara messaggio</>
                  }
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


function UserRow({ u, onPatch, onDelete, onWhatsApp }: {
  u: AdminUser;
  onPatch: (id: number, patch: Partial<AdminUser>) => void;
  onDelete: (id: number) => void;
  onWhatsApp: (phone: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <tr className={`hover:bg-gray-50 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
      {/* User info */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm"
            style={{ backgroundColor: u.avatar_color || '#10B981' }}
          >
            {u.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{u.name}</p>
            <p className="text-xs text-gray-500 truncate">{u.email}</p>
            {u.phone && (
              <p className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3" />{u.phone}
              </p>
            )}
          </div>
        </div>
      </td>
      {/* Groups */}
      <td className="px-3 py-3 text-center hidden sm:table-cell">
        <span className="text-sm text-gray-700">{u.group_count ?? 0}</span>
      </td>
      {/* Expenses */}
      <td className="px-3 py-3 text-center hidden md:table-cell">
        <span className="text-sm text-gray-700">{u.expense_count ?? 0}</span>
      </td>
      {/* Date */}
      <td className="px-3 py-3 hidden lg:table-cell">
        <span className="text-xs text-gray-500">
          {new Date(u.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </td>
      {/* WhatsApp */}
      <td className="px-3 py-3 text-center hidden sm:table-cell">
        {u.phone ? (
          <button
            onClick={() => onWhatsApp(u.phone!)}
            title={`Apri WhatsApp con ${u.phone}`}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-green-500 bg-green-50 hover:bg-green-100 transition-colors"
          >
            <Phone className="w-4 h-4" />
          </button>
        ) : (
          <span className="text-gray-200 text-xs">—</span>
        )}
      </td>
      {/* Premium toggle */}
      <td className="px-3 py-3 text-center">
        <button
          onClick={() => onPatch(u.id, { is_premium: !u.is_premium })}
          title={u.is_premium ? 'Rimuovi Premium' : 'Aggiungi Premium'}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
            u.is_premium ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' : 'text-gray-300 hover:bg-gray-100 hover:text-amber-400'
          }`}
        >
          <Crown className="w-4 h-4" />
        </button>
      </td>
      {/* Active toggle */}
      <td className="px-3 py-3 text-center">
        <button
          onClick={() => onPatch(u.id, { is_active: !u.is_active })}
          title={u.is_active ? 'Disabilita account' : 'Riabilita account'}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
            u.is_active ? 'text-emerald-500 bg-emerald-50 hover:bg-emerald-100' : 'text-red-400 bg-red-50 hover:bg-red-100'
          }`}
        >
          {u.is_active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
        </button>
      </td>
      {/* Admin toggle */}
      <td className="px-3 py-3 text-center hidden sm:table-cell">
        <button
          onClick={() => onPatch(u.id, { is_admin: !u.is_admin })}
          title={u.is_admin ? 'Rimuovi Admin' : 'Rendi Admin'}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
            u.is_admin ? 'text-violet-500 bg-violet-50 hover:bg-violet-100' : 'text-gray-300 hover:bg-gray-100 hover:text-violet-400'
          }`}
        >
          <Shield className="w-4 h-4" />
        </button>
      </td>
      {/* Delete */}
      <td className="px-3 py-3 text-center">
        {confirmDelete ? (
          <div className="flex items-center justify-center gap-1">
            <button onClick={() => onDelete(u.id)} className="text-xs bg-red-500 text-white px-2 py-1 rounded-md hover:bg-red-600 font-medium">Sì</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-md hover:bg-gray-300 font-medium">No</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export default function Admin() {
  const [tab, setTab] = useState<Tab>('overview');

  // Stats
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Users
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const debouncedSearch = useDebounce(search, 350);

  // Groups
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupPage, setGroupPage] = useState(1);

  // Invite email
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  // Invite WhatsApp
  const [waOpen, setWaOpen] = useState(false);
  const [waPhone, setWaPhone] = useState('');

  // Load stats
  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  // Load users
  const loadUsers = useCallback(() => {
    setLoadingUsers(true);
    api.get('/admin/users', {
      params: { page: userPage, limit: 20, search: debouncedSearch, sortBy, sortDir },
    })
      .then(r => { setUsers(r.data.users || []); setUserTotal(r.data.total || 0); })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [userPage, debouncedSearch, sortBy, sortDir]);

  useEffect(() => {
    if (tab === 'users') { setUserPage(1); }
  }, [debouncedSearch, tab]);

  useEffect(() => {
    if (tab === 'users') loadUsers();
  }, [tab, loadUsers]);

  // Load groups
  const loadGroups = useCallback(() => {
    api.get('/admin/groups', { params: { page: groupPage, limit: 20 } })
      .then(r => { setGroups(r.data.groups || []); setGroupTotal(r.data.total || 0); })
      .catch(() => {});
  }, [groupPage]);

  useEffect(() => { if (tab === 'groups') loadGroups(); }, [tab, loadGroups]);

  // Actions
  const patchUser = async (id: number, patch: Partial<AdminUser>) => {
    await api.patch(`/admin/users/${id}`, patch);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
  };

  const deleteUser = async (id: number) => {
    await api.delete(`/admin/users/${id}`);
    loadUsers();
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
  };

  const toggleSort = (field: SortField) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  const openInvite = (email = '') => { setInviteEmail(email); setInviteOpen(true); };
  const openWhatsApp = (phone = '') => { setWaPhone(phone); setWaOpen(true); };

  const tabs = [
    { key: 'overview' as Tab, label: 'Panoramica', icon: BarChart2 },
    { key: 'users' as Tab, label: 'Utenti', icon: Users },
    { key: 'groups' as Tab, label: 'Gruppi', icon: Globe },
  ];

  const totalPages = Math.max(1, Math.ceil(userTotal / 20));
  const noResults = !loadingUsers && users.length === 0 && debouncedSearch.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500">Gestione globale della piattaforma</p>
          </div>
        </div>
        <button
          onClick={() => openInvite()}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Invita utente</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={Users} label="Utenti totali" value={stats.totalUsers} color="bg-blue-500" />
          <StatCard icon={Crown} label="Utenti Premium" value={stats.premiumUsers} color="bg-amber-500" />
          <StatCard icon={CheckCircle} label="Utenti attivi" value={stats.activeUsers ?? stats.totalUsers} color="bg-emerald-500" />
          <StatCard icon={Globe} label="Gruppi totali" value={stats.totalGroups} color="bg-violet-500" />
          <StatCard icon={BarChart2} label="Spese totali" value={stats.totalExpenses} color="bg-rose-500" />
          <StatCard
            icon={DollarSign} label="Volume processato" color="bg-teal-500"
            value={`€ ${(stats.totalAmountProcessed || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
          />
        </div>
      )}

      {/* ── USERS ── */}
      {tab === 'users' && (
        <div>
          {/* Search bar */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cerca per nome o email..."
                className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button onClick={loadUsers} className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white">
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loadingUsers ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => openInvite(isEmailLike(search) ? search : '')}
              className="flex items-center gap-2 px-4 py-2.5 border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors"
              title="Invita via email"
            >
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Email</span>
            </button>
            <button
              onClick={() => openWhatsApp(isPhoneLike(search) ? search : '')}
              className="flex items-center gap-2 px-4 py-2.5 border border-green-300 text-green-700 bg-green-50 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
              title="Invita via WhatsApp"
            >
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
          </div>

          {/* Search result hint */}
          {debouncedSearch && (
            <p className="text-xs text-gray-500 mb-3">
              {loadingUsers ? 'Ricerca in corso...' : `${userTotal} risultat${userTotal === 1 ? 'o' : 'i'} per "${debouncedSearch}"`}
            </p>
          )}

          {/* Not found banner */}
          {noResults && (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-gray-400" />
              </div>
              <p className="font-medium text-gray-700 mb-1">
                Nessun utente trovato per "{debouncedSearch}"
              </p>
              {isEmailLike(debouncedSearch) ? (
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    Questo indirizzo non è ancora registrato. Vuoi mandare un invito?
                  </p>
                  <button
                    onClick={() => openInvite(debouncedSearch)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Invita via email
                  </button>
                </>
              ) : isPhoneLike(debouncedSearch) ? (
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    Nessun utente registrato con questo numero. Vuoi invitarlo via WhatsApp?
                  </p>
                  <button
                    onClick={() => openWhatsApp(debouncedSearch)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    Invita via WhatsApp
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    Cerca per email o numero di telefono per invitare qualcuno.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => openInvite()}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100">
                      <Mail className="w-4 h-4" /> Invita via email
                    </button>
                    <button onClick={() => openWhatsApp()}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 bg-green-50 rounded-lg text-sm font-medium hover:bg-green-100">
                      <Phone className="w-4 h-4" /> Invita via WhatsApp
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Table */}
          {!noResults && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3">
                      <button onClick={() => toggleSort('name')} className="flex items-center gap-1 text-gray-600 font-medium hover:text-gray-900">
                        Utente <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">Gruppi</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600 hidden md:table-cell">Spese</th>
                    <th className="text-left px-3 py-3 hidden lg:table-cell">
                      <button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1 text-gray-600 font-medium hover:text-gray-900">
                        Registrato <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="text-center px-3 py-3 hidden sm:table-cell">
                      <span title="WhatsApp" className="flex justify-center"><Phone className="w-4 h-4 text-green-400" /></span>
                    </th>
                    <th className="text-center px-3 py-3">
                      <span title="Premium" className="flex justify-center"><Crown className="w-4 h-4 text-amber-400" /></span>
                    </th>
                    <th className="text-center px-3 py-3">
                      <span title="Attivo" className="flex justify-center"><CheckCircle className="w-4 h-4 text-emerald-400" /></span>
                    </th>
                    <th className="text-center px-3 py-3 hidden sm:table-cell">
                      <span title="Admin" className="flex justify-center"><Shield className="w-4 h-4 text-violet-400" /></span>
                    </th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingUsers
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          {[4, 3, 3, 3, 3, 3, 3, 3].map((w, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className={`h-4 bg-gray-100 rounded animate-pulse w-${w * 8}`} />
                            </td>
                          ))}
                        </tr>
                      ))
                    : users.map(u => (
                        <UserRow key={u.id} u={u} onPatch={patchUser} onDelete={deleteUser} onWhatsApp={openWhatsApp} />
                      ))
                  }
                </tbody>
              </table>

              {!loadingUsers && users.length === 0 && !debouncedSearch && (
                <div className="text-center py-12 text-gray-400 text-sm">Nessun utente ancora</div>
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  {userTotal} utenti totali
                  {debouncedSearch && ` · filtr${userTotal === 1 ? 'ato' : 'ati'}`}
                </p>
                <div className="flex items-center gap-1">
                  <button disabled={userPage <= 1} onClick={() => setUserPage(p => p - 1)}
                    className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = totalPages <= 5 ? i + 1 : Math.max(1, userPage - 2) + i;
                    if (p > totalPages) return null;
                    return (
                      <button key={p} onClick={() => setUserPage(p)}
                        className={`w-8 h-8 rounded border text-sm font-medium transition-colors ${
                          p === userPage ? 'bg-emerald-500 text-white border-emerald-500' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                        }`}
                      >{p}</button>
                    );
                  })}
                  <button disabled={userPage >= totalPages} onClick={() => setUserPage(p => p + 1)}
                    className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GROUPS ── */}
      {tab === 'groups' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Gruppo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Creatore</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Membri</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Spese</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Creato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groups.map(g => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: g.cover_color }}>
                        {g.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{g.name}</p>
                        <p className="text-gray-500 text-xs capitalize">{g.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{g.creator_name}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{g.member_count}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{g.expense_count}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                    {new Date(g.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {groups.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">Nessun gruppo ancora</div>}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">{groupTotal} gruppi totali</p>
            <div className="flex gap-1">
              <button disabled={groupPage <= 1} onClick={() => setGroupPage(p => p - 1)}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">{groupPage} / {Math.max(1, Math.ceil(groupTotal / 20))}</span>
              <button disabled={groupPage >= Math.ceil(groupTotal / 20)} onClick={() => setGroupPage(p => p + 1)}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Area riservata agli amministratori</p>
          <p className="text-xs text-amber-600 mt-0.5">Tutte le azioni sono permanenti e irreversibili. Procedi con cautela.</p>
        </div>
      </div>

      {/* Modals */}
      {inviteOpen && <InviteModal prefillEmail={inviteEmail} onClose={() => setInviteOpen(false)} />}
      {waOpen && <WhatsAppModal prefillPhone={waPhone} onClose={() => setWaOpen(false)} />}
    </div>
  );
}
