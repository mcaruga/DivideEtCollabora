import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import {
  Users, BarChart2, DollarSign, Globe, Shield, Trash2,
  ChevronLeft, ChevronRight, Search, CheckCircle, XCircle,
  Crown, AlertTriangle, RefreshCw,
} from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  premiumUsers: number;
  activeUsers: number;
  totalGroups: number;
  totalExpenses: number;
  totalAmountProcessed: number;
}

interface AdminUser {
  id: number;
  email: string;
  name: string;
  avatar_color: string;
  is_premium: boolean;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  group_count: number;
}

interface AdminGroup {
  id: number;
  name: string;
  type: string;
  cover_color: string;
  created_at: string;
  member_count: number;
  expense_count: number;
  creator_name: string;
}

type Tab = 'overview' | 'users' | 'groups';

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

export default function Admin() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [groupTotal, setGroupTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/admin/stats').then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const loadUsers = useCallback(() => {
    setLoading(true);
    api.get('/admin/users', { params: { page: userPage, limit: 20, search } })
      .then((r) => { setUsers(r.data.users); setUserTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [userPage, search]);

  const loadGroups = useCallback(() => {
    setLoading(true);
    api.get('/admin/groups', { params: { page: groupPage, limit: 20 } })
      .then((r) => { setGroups(r.data.groups); setGroupTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [groupPage]);

  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab, loadUsers]);
  useEffect(() => { if (tab === 'groups') loadGroups(); }, [tab, loadGroups]);

  const patchUser = async (id: number, patch: Partial<AdminUser>) => {
    await api.patch(`/admin/users/${id}`, patch);
    loadUsers();
    api.get('/admin/stats').then((r) => setStats(r.data));
  };

  const deleteUser = async (id: number) => {
    await api.delete(`/admin/users/${id}`);
    setDeleteConfirm(null);
    loadUsers();
    api.get('/admin/stats').then((r) => setStats(r.data));
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Panoramica', icon: BarChart2 },
    { key: 'users', label: 'Utenti', icon: Users },
    { key: 'groups', label: 'Gruppi', icon: Globe },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500">Gestione globale della piattaforma</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={Users} label="Utenti totali" value={stats.totalUsers} color="bg-blue-500" />
          <StatCard icon={Crown} label="Utenti Premium" value={stats.premiumUsers} color="bg-amber-500" />
          <StatCard icon={CheckCircle} label="Utenti attivi" value={stats.activeUsers} color="bg-emerald-500" />
          <StatCard icon={Globe} label="Gruppi totali" value={stats.totalGroups} color="bg-violet-500" />
          <StatCard icon={BarChart2} label="Spese totali" value={stats.totalExpenses} color="bg-rose-500" />
          <StatCard
            icon={DollarSign}
            label="Volume processato"
            value={`€ ${(stats.totalAmountProcessed || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
            color="bg-teal-500"
          />
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cerca per email o nome..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setUserPage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={loadUsers}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Utente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Gruppi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Registrato</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Premium</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Attivo</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Admin</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className={`hover:bg-gray-50 ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: u.avatar_color }}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{u.name}</p>
                          <p className="text-gray-500 text-xs">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{u.group_count}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {new Date(u.created_at).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => patchUser(u.id, { is_premium: !u.is_premium })}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                          u.is_premium ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-300 hover:bg-gray-100'
                        }`}
                        title={u.is_premium ? 'Rimuovi Premium' : 'Aggiungi Premium'}
                      >
                        <Crown className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => patchUser(u.id, { is_active: !u.is_active })}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                          u.is_active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-red-400 hover:bg-red-50'
                        }`}
                        title={u.is_active ? 'Disabilita' : 'Abilita'}
                      >
                        {u.is_active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => patchUser(u.id, { is_admin: !u.is_admin })}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                          u.is_admin ? 'text-violet-500 hover:bg-violet-50' : 'text-gray-300 hover:bg-gray-100'
                        }`}
                        title={u.is_admin ? 'Rimuovi Admin' : 'Rendi Admin'}
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {deleteConfirm === u.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteUser(u.id)}
                            className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                          >
                            Sì
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(u.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-400">Nessun utente trovato</div>
            )}

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-sm text-gray-500">{userTotal} utenti totali</span>
              <div className="flex gap-2">
                <button
                  disabled={userPage <= 1}
                  onClick={() => setUserPage((p) => p - 1)}
                  className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  {userPage} / {Math.max(1, Math.ceil(userTotal / 20))}
                </span>
                <button
                  disabled={userPage >= Math.ceil(userTotal / 20)}
                  onClick={() => setUserPage((p) => p + 1)}
                  className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Groups */}
      {tab === 'groups' && (
        <div>
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
                {groups.map((g) => (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: g.cover_color }}
                        >
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
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {new Date(g.created_at).toLocaleDateString('it-IT')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {groups.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-400">Nessun gruppo trovato</div>
            )}

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-sm text-gray-500">{groupTotal} gruppi totali</span>
              <div className="flex gap-2">
                <button
                  disabled={groupPage <= 1}
                  onClick={() => setGroupPage((p) => p - 1)}
                  className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  {groupPage} / {Math.max(1, Math.ceil(groupTotal / 20))}
                </span>
                <button
                  disabled={groupPage >= Math.ceil(groupTotal / 20)}
                  onClick={() => setGroupPage((p) => p + 1)}
                  className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Area riservata agli amministratori</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Tutte le azioni qui sono permanenti e irreversibili. Procedi con cautela.
          </p>
        </div>
      </div>
    </div>
  );
}
