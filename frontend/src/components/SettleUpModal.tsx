import React, { useState } from 'react';
import { X } from 'lucide-react';
import api from '../api/client';
import { User, Balance } from '../types';
import useAuthStore from '../store/useAuthStore';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF'];
const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'Fr' };

interface SettleUpModalProps {
  groupId: number;
  members: User[];
  suggestedBalance?: Balance | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SettleUpModal({
  groupId,
  members,
  suggestedBalance,
  onClose,
  onSuccess,
}: SettleUpModalProps) {
  const { user: currentUser } = useAuthStore();
  const [fromUserId, setFromUserId] = useState<number>(
    suggestedBalance?.from_user_id || currentUser!.id
  );
  const [toUserId, setToUserId] = useState<number>(
    suggestedBalance?.to_user_id ||
    members.find(m => m.id !== currentUser!.id)?.id ||
    currentUser!.id
  );
  const [amount, setAmount] = useState(suggestedBalance?.amount?.toString() || '');
  const [currency, setCurrency] = useState(suggestedBalance?.currency || 'EUR');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const symbol = CURRENCY_SYMBOLS[currency] || currency;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Valid amount is required');
      return;
    }

    if (fromUserId === toUserId) {
      setError('Payer and receiver must be different people');
      return;
    }

    setLoading(true);
    try {
      await api.post('/payments', {
        group_id: groupId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount: parsedAmount,
        currency,
        notes: notes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Settle Up</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Who paid?</label>
            <select
              value={fromUserId}
              onChange={e => setFromUserId(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.id === currentUser?.id ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-gray-500 font-medium">paid</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Who received?</label>
            <select
              value={toUserId}
              onChange={e => setToUserId(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.id === currentUser?.id ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{symbol}</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                  required
                />
              </div>
            </div>
            <div className="w-28">
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
              >
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g., via bank transfer"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
