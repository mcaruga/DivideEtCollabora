import React, { useState } from 'react';
import { Trash2, Edit2, ChevronDown, ChevronUp, RefreshCw, Receipt } from 'lucide-react';
import { Expense } from '../types';
import useAuthStore from '../store/useAuthStore';

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'Fr'
};

const CATEGORY_COLORS: Record<string, string> = {
  food: 'bg-orange-100 text-orange-700',
  transport: 'bg-blue-100 text-blue-700',
  accommodation: 'bg-purple-100 text-purple-700',
  entertainment: 'bg-pink-100 text-pink-700',
  shopping: 'bg-yellow-100 text-yellow-700',
  utilities: 'bg-gray-100 text-gray-700',
  health: 'bg-red-100 text-red-700',
  general: 'bg-green-100 text-green-700',
};

interface ExpenseItemProps {
  expense: Expense;
  onDelete: (id: number) => void;
  onEdit: (expense: Expense) => void;
}

export default function ExpenseItem({ expense, onDelete, onEdit }: ExpenseItemProps) {
  const { user } = useAuthStore();
  const [expanded, setExpanded] = useState(false);
  const symbol = CURRENCY_SYMBOLS[expense.currency] || expense.currency;

  const myUser = user!;
  const myShare = expense.splits.find(s => s.user_id === myUser.id);
  const iPaid = expense.paid_by === myUser.id;

  let balanceText = '';
  let balanceColor = '';
  if (iPaid && myShare) {
    const othersOwe = expense.amount - myShare.amount;
    if (othersOwe > 0.005) {
      balanceText = `you lent ${symbol}${othersOwe.toFixed(2)}`;
      balanceColor = 'text-emerald-600';
    } else {
      balanceText = 'you paid for yourself';
      balanceColor = 'text-gray-500';
    }
  } else if (!iPaid && myShare && myShare.amount > 0.005) {
    balanceText = `you owe ${symbol}${myShare.amount.toFixed(2)}`;
    balanceColor = 'text-red-500';
  } else if (!myShare) {
    balanceText = 'not involved';
    balanceColor = 'text-gray-400';
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  CATEGORY_COLORS[expense.category] || 'bg-gray-100 text-gray-700'
                }`}
              >
                {expense.category}
              </span>
              {expense.is_recurring && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  {expense.recur_interval || 'recurring'}
                </span>
              )}
              {expense.receipt_url && (
                <a
                  href={expense.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium flex items-center gap-1 hover:bg-gray-200"
                >
                  <Receipt className="w-3 h-3" />
                  receipt
                </a>
              )}
            </div>
            <p className="mt-1 font-semibold text-gray-900 truncate">{expense.description}</p>
            <p className="text-sm text-gray-500">
              {new Date(expense.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' · '}
              paid by <span className="font-medium text-gray-700">{expense.paid_by_name}</span>
            </p>
            {expense.notes && (
              <p className="text-sm text-gray-500 mt-1 italic">"{expense.notes}"</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <p className="font-bold text-gray-900 text-lg">
              {symbol}{expense.amount.toFixed(2)}
            </p>
            {balanceText && (
              <p className={`text-xs font-medium ${balanceColor}`}>{balanceText}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expense.splits.length} split{expense.splits.length !== 1 ? 's' : ''}
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(expense)}
              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(expense.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Split Details</p>
          <div className="space-y-1">
            {expense.splits.map((split) => (
              <div key={split.user_id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {split.user_name || `User ${split.user_id}`}
                  {split.user_id === expense.paid_by && (
                    <span className="ml-1 text-xs text-emerald-600">(paid)</span>
                  )}
                </span>
                <span className="font-medium text-gray-900">
                  {symbol}{split.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
