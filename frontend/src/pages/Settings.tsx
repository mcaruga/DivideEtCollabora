import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, AlertTriangle, Phone } from 'lucide-react';
import api from '../api/client';
import useAuthStore from '../store/useAuthStore';

const CURRENCIES = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
];

const AVATAR_COLORS = [
  '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#6366F1',
  '#84CC16', '#78716C',
];

export default function Settings() {
  const { user, updateUser, logout } = useAuthStore();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [currency, setCurrency] = useState(user?.currency || 'EUR');
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color || '#4F46E5');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);

    try {
      const res = await api.put('/users/profile', { name, currency, avatar_color: avatarColor, phone });
      updateUser(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await api.delete('/users/account');
      logout();
      navigate('/login', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete account');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account preferences</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">Profile</h2>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {saved && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm">
            Settings saved successfully!
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Avatar Preview */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: avatarColor }}
            >
              {name.charAt(0).toUpperCase() || user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-gray-900">{name || user?.name}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              {user?.is_premium && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">
                  Premium
                </span>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numero di telefono <span className="text-gray-400 font-normal">(opzionale)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+39 333 1234567"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Usato per trovarti più facilmente e per inviti WhatsApp</p>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default currency</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code} – {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Avatar Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Avatar color</label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    avatarColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Account Information</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span className="font-medium text-gray-900">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Member since</span>
            <span className="font-medium text-gray-900">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
                : '-'
              }
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Plan</span>
            <span className="font-medium text-gray-900">
              {user?.is_premium ? '⭐ Premium' : 'Free'}
            </span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="text-base font-semibold text-red-600 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
          >
            Delete Account
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-medium text-red-800 mb-3">
              Are you absolutely sure? This will permanently delete your account and remove you from all groups.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
