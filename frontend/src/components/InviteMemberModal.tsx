import React, { useState } from 'react';
import { X, Search, UserPlus } from 'lucide-react';
import api from '../api/client';
import { User } from '../types';

interface InviteMemberModalProps {
  groupId: number;
  existingMembers: User[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function InviteMemberModal({
  groupId,
  existingMembers,
  onClose,
  onSuccess,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSearch(value: string) {
    setEmail(value);
    setError('');
    setSuccess('');

    if (value.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/users/search?q=${encodeURIComponent(value)}`);
      const filtered = res.data.filter(
        (u: User) => !existingMembers.some(m => m.id === u.id)
      );
      setSearchResults(filtered);
    } catch {
      // ignore search errors
    } finally {
      setLoading(false);
    }
  }

  async function handleAddByEmail(emailToAdd: string) {
    setError('');
    setAdding(true);
    try {
      await api.post(`/groups/${groupId}/members`, { email: emailToAdd });
      setSuccess(`Member added successfully!`);
      setEmail('');
      setSearchResults([]);
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setAdding(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    await handleAddByEmail(email.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Invite Member</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search by email
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Enter email address..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
              />
            </div>
          </form>

          {loading && (
            <div className="text-center text-sm text-gray-500 py-2">Searching...</div>
          )}

          {searchResults.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {searchResults.map(user => (
                <div key={user.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: user.avatar_color }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddByEmail(user.email)}
                    disabled={adding}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}

          {email.length >= 2 && !loading && searchResults.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">No users found with that email</p>
              <button
                onClick={() => handleAddByEmail(email)}
                disabled={adding}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 mx-auto"
              >
                <UserPlus className="w-4 h-4" />
                Invite "{email}"
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
