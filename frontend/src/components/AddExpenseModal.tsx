import React, { useState, useEffect } from 'react';
import { X, Upload, RefreshCw } from 'lucide-react';
import api from '../api/client';
import { User, Expense } from '../types';
import useAuthStore from '../store/useAuthStore';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF'];
const CATEGORIES = ['food', 'transport', 'accommodation', 'entertainment', 'shopping', 'utilities', 'health', 'general'];
const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'Fr' };

interface Split {
  user_id: number;
  amount: number;
  percentage?: number;
  shares?: number;
}

interface AddExpenseModalProps {
  groupId: number;
  members: User[];
  onClose: () => void;
  onSuccess: () => void;
  editExpense?: Expense | null;
}

export default function AddExpenseModal({
  groupId,
  members,
  onClose,
  onSuccess,
  editExpense,
}: AddExpenseModalProps) {
  const { user: currentUser } = useAuthStore();
  const [description, setDescription] = useState(editExpense?.description || '');
  const [amount, setAmount] = useState(editExpense?.amount?.toString() || '');
  const [currency, setCurrency] = useState(editExpense?.currency || 'EUR');
  const [paidBy, setPaidBy] = useState<number>(editExpense?.paid_by || currentUser!.id);
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage' | 'shares'>(
    (editExpense?.split_type as any) || 'equal'
  );
  const [splits, setSplits] = useState<Split[]>([]);
  const [category, setCategory] = useState(editExpense?.category || 'general');
  const [date, setDate] = useState(editExpense?.date || new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState(editExpense?.notes || '');
  const [isRecurring, setIsRecurring] = useState(editExpense?.is_recurring || false);
  const [recurInterval, setRecurInterval] = useState(editExpense?.recur_interval || 'monthly');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isPremium = currentUser?.is_premium;

  useEffect(() => {
    initializeSplits();
  }, [splitType, amount, members]);

  function initializeSplits() {
    const parsedAmount = parseFloat(amount) || 0;
    const equalShare = parsedAmount > 0 ? parsedAmount / members.length : 0;
    const equalPct = 100 / members.length;
    const newSplits: Split[] = members.map((m) => ({
      user_id: m.id,
      amount: splitType === 'equal' ? Math.round(equalShare * 100) / 100 : (editExpense?.splits.find(s => s.user_id === m.id)?.amount || 0),
      percentage: splitType === 'percentage' ? Math.round(equalPct * 100) / 100 : undefined,
      shares: splitType === 'shares' ? 1 : undefined,
    }));

    if (splitType === 'equal' && parsedAmount > 0) {
      // Fix rounding
      const total = newSplits.reduce((s, x) => s + x.amount, 0);
      const diff = Math.round((parsedAmount - total) * 100) / 100;
      if (diff !== 0 && newSplits.length > 0) {
        newSplits[0].amount = Math.round((newSplits[0].amount + diff) * 100) / 100;
      }
    }

    setSplits(newSplits);
  }

  function updateSplit(userId: number, field: 'amount' | 'percentage' | 'shares', value: number) {
    setSplits(prev => {
      const updated = prev.map(s =>
        s.user_id === userId ? { ...s, [field]: value } : s
      );

      if (field === 'percentage') {
        const parsedAmount = parseFloat(amount) || 0;
        return updated.map(s => ({
          ...s,
          amount: s.percentage !== undefined ? Math.round(parsedAmount * s.percentage / 100 * 100) / 100 : s.amount,
        }));
      }

      if (field === 'shares') {
        const parsedAmount = parseFloat(amount) || 0;
        const totalShares = updated.reduce((sum, s) => sum + (s.shares || 0), 0);
        if (totalShares > 0) {
          return updated.map(s => ({
            ...s,
            amount: Math.round(parsedAmount * (s.shares || 0) / totalShares * 100) / 100,
          }));
        }
      }

      return updated;
    });
  }

  function getSplitsForSubmit(): { user_id: number; amount: number }[] {
    const parsedAmount = parseFloat(amount) || 0;
    if (splitType === 'equal') {
      const equalShare = parsedAmount / members.length;
      const result = members.map((m, i) => ({
        user_id: m.id,
        amount: Math.round(equalShare * 100) / 100,
      }));
      // Fix rounding on first item
      const total = result.reduce((s, x) => s + x.amount, 0);
      const diff = Math.round((parsedAmount - total) * 100) / 100;
      if (diff !== 0 && result.length > 0) result[0].amount += diff;
      return result;
    }
    return splits.map(s => ({ user_id: s.user_id, amount: s.amount }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount);
    if (!description.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Description and valid amount are required');
      return;
    }

    const finalSplits = getSplitsForSubmit();
    const total = finalSplits.reduce((s, x) => s + x.amount, 0);
    if (Math.abs(total - parsedAmount) > 0.05) {
      setError(`Splits total (${total.toFixed(2)}) must equal amount (${parsedAmount.toFixed(2)})`);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('group_id', groupId.toString());
      formData.append('description', description.trim());
      formData.append('amount', parsedAmount.toString());
      formData.append('currency', currency);
      formData.append('paid_by', paidBy.toString());
      formData.append('split_type', splitType);
      formData.append('splits', JSON.stringify(finalSplits));
      formData.append('category', category);
      formData.append('date', date);
      formData.append('notes', notes);
      formData.append('is_recurring', isRecurring ? 'true' : 'false');
      if (isRecurring) formData.append('recur_interval', recurInterval);
      if (receiptFile) formData.append('receipt', receiptFile);

      if (editExpense) {
        await api.put(`/expenses/${editExpense.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/expenses', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  }

  const symbol = CURRENCY_SYMBOLS[currency] || currency;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-lg font-semibold text-gray-900">
            {editExpense ? 'Edit Expense' : 'Add Expense'}
          </h2>
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

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's this expense for?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
              required
            />
          </div>

          {/* Amount and Currency */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
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

          {/* Paid By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paid by</label>
            <select
              value={paidBy}
              onChange={e => setPaidBy(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.id === currentUser?.id ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Split Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Split type</label>
            <div className="grid grid-cols-4 gap-1 bg-gray-100 p-1 rounded-lg">
              {(['equal', 'exact', 'percentage', 'shares'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSplitType(type)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                    splitType === type
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Splits */}
          {splitType !== 'equal' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {splitType === 'exact' && 'Amounts'}
                {splitType === 'percentage' && 'Percentages'}
                {splitType === 'shares' && 'Shares'}
              </label>
              <div className="space-y-2">
                {splits.map(split => {
                  const member = members.find(m => m.id === split.user_id);
                  return (
                    <div key={split.user_id} className="flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
                          style={{ backgroundColor: member?.avatar_color || '#10B981' }}
                        >
                          {member?.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-700 truncate">{member?.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {splitType === 'percentage' ? (
                          <>
                            <input
                              type="number"
                              value={split.percentage ?? 0}
                              onChange={e => updateSplit(split.user_id, 'percentage', parseFloat(e.target.value) || 0)}
                              min="0"
                              max="100"
                              step="0.01"
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                            />
                            <span className="text-sm text-gray-500">%</span>
                            <span className="text-xs text-gray-400 w-16 text-right">
                              = {symbol}{split.amount.toFixed(2)}
                            </span>
                          </>
                        ) : splitType === 'shares' ? (
                          <>
                            <input
                              type="number"
                              value={split.shares ?? 1}
                              onChange={e => updateSplit(split.user_id, 'shares', parseInt(e.target.value) || 0)}
                              min="0"
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                            />
                            <span className="text-sm text-gray-500">share{(split.shares || 0) !== 1 ? 's' : ''}</span>
                            <span className="text-xs text-gray-400 w-16 text-right">
                              = {symbol}{split.amount.toFixed(2)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-sm text-gray-500">{symbol}</span>
                            <input
                              type="number"
                              value={split.amount}
                              onChange={e => updateSplit(split.user_id, 'amount', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-right">
                Total: {symbol}{splits.reduce((s, x) => s + x.amount, 0).toFixed(2)}
                {amount && (
                  <span className={
                    Math.abs(splits.reduce((s, x) => s + x.amount, 0) - parseFloat(amount)) < 0.05
                      ? 'text-emerald-600 ml-2'
                      : 'text-red-500 ml-2'
                  }>
                    {Math.abs(splits.reduce((s, x) => s + x.amount, 0) - parseFloat(amount)) < 0.05
                      ? '✓ balanced'
                      : `≠ ${symbol}${amount}`}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Category and Date */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c} className="capitalize">{c}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
            />
          </div>

          {/* Receipt Upload (Premium) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              Receipt
              {!isPremium && (
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Premium</span>
              )}
            </label>
            {isPremium ? (
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">
                  {receiptFile ? receiptFile.name : editExpense?.receipt_url ? 'Change receipt' : 'Upload receipt (max 5MB)'}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="px-3 py-2 border border-dashed border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-400">
                Upgrade to Premium to attach receipts
              </div>
            )}
          </div>

          {/* Recurring (Premium) */}
          <div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="recurring"
                checked={isRecurring}
                onChange={e => setIsRecurring(e.target.checked)}
                disabled={!isPremium}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="recurring" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-gray-500" />
                Recurring expense
                {!isPremium && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Premium</span>
                )}
              </label>
            </div>
            {isRecurring && isPremium && (
              <select
                value={recurInterval}
                onChange={e => setRecurInterval(e.target.value)}
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}
          </div>

          {/* Submit */}
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
              {loading ? 'Saving...' : editExpense ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
