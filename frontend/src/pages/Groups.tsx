import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Home, Heart, Globe, Briefcase, X } from 'lucide-react';
import api from '../api/client';
import useAuthStore from '../store/useAuthStore';
import { Group } from '../types';

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'Fr' };

const GROUP_COLORS = [
  '#10B981', '#4F46E5', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#6366F1'
];

const TYPE_ICONS: Record<string, React.ReactNode> = {
  trip: <Globe className="w-5 h-5" />,
  home: <Home className="w-5 h-5" />,
  couple: <Heart className="w-5 h-5" />,
  other: <Briefcase className="w-5 h-5" />,
};

interface CreateGroupForm {
  name: string;
  description: string;
  type: 'trip' | 'home' | 'couple' | 'other';
  cover_color: string;
}

export default function Groups() {
  const { user } = useAuthStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<CreateGroupForm>({
    name: '',
    description: '',
    type: 'other',
    cover_color: '#10B981',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const symbol = CURRENCY_SYMBOLS[user?.currency || 'EUR'] || '€';

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    try {
      const res = await api.get('/groups');
      setGroups(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Group name is required');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/groups', form);
      setGroups(prev => [res.data, ...prev]);
      setShowCreateModal(false);
      setForm({ name: '', description: '', type: 'other', cover_color: '#10B981' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
          <p className="text-gray-500 text-sm mt-1">{groups.length} group{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No groups yet</h3>
          <p className="text-sm text-gray-500 mb-6">
            Create your first group to start tracking shared expenses
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(group => (
            <Link
              key={group.id}
              to={`/groups/${group.id}`}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-emerald-300 hover:shadow-md transition-all"
            >
              {/* Color header */}
              <div
                className="h-16 flex items-end px-4 pb-3"
                style={{ backgroundColor: group.cover_color }}
              >
                <div className="flex items-center gap-2 text-white">
                  {TYPE_ICONS[group.type] || <Briefcase className="w-5 h-5" />}
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-gray-900 truncate">{group.name}</h3>
                {group.description && (
                  <p className="text-sm text-gray-500 truncate mt-0.5">{group.description}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {group.member_count || 0} member{(group.member_count || 0) !== 1 ? 's' : ''}
                  </span>
                  {(group.my_balance || 0) === 0 ? (
                    <span className="text-xs text-gray-400 font-medium">settled</span>
                  ) : (group.my_balance || 0) > 0 ? (
                    <span className="text-xs font-semibold text-emerald-600">
                      +{symbol}{(group.my_balance || 0).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-red-500">
                      -{symbol}{Math.abs(group.my_balance || 0).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}

          {/* Add group card */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 hover:border-emerald-400 hover:bg-emerald-50 transition-all flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-emerald-600 min-h-[130px]"
          >
            <Plus className="w-8 h-8" />
            <span className="text-sm font-medium">New Group</span>
          </button>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Create Group</h2>
              <button
                onClick={() => { setShowCreateModal(false); setError(''); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Summer Trip 2025"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['trip', 'home', 'couple', 'other'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type }))}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium capitalize transition-colors ${
                        form.type === type
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {TYPE_ICONS[type]}
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex flex-wrap gap-2">
                  {GROUP_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, cover_color: color }))}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        form.cover_color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setError(''); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {creating ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
