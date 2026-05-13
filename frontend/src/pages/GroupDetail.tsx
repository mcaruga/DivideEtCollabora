import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, CreditCard, Zap, Users, UserMinus, Trash2
} from 'lucide-react';
import api from '../api/client';
import useAuthStore from '../store/useAuthStore';
import { Group, Expense, Payment, Balance, User } from '../types';
import ExpenseItem from '../components/ExpenseItem';
import AddExpenseModal from '../components/AddExpenseModal';
import SettleUpModal from '../components/SettleUpModal';
import InviteMemberModal from '../components/InviteMemberModal';

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'Fr' };

type Tab = 'expenses' | 'payments' | 'members';

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('expenses');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [showSettleUp, setShowSettleUp] = useState(false);
  const [settleBalance, setSettleBalance] = useState<Balance | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [simplifiedDebts, setSimplifiedDebts] = useState<Balance[] | null>(null);
  const [showSimplified, setShowSimplified] = useState(false);
  const [loadingSimplify, setLoadingSimplify] = useState(false);

  const groupId = parseInt(id!);

  useEffect(() => {
    loadGroupData();
  }, [id]);

  async function loadGroupData() {
    try {
      const [groupRes, expensesRes, paymentsRes] = await Promise.all([
        api.get(`/groups/${groupId}`),
        api.get(`/expenses/group/${groupId}`),
        api.get(`/payments/group/${groupId}`),
      ]);
      setGroup(groupRes.data);
      setExpenses(expensesRes.data);
      setPayments(paymentsRes.data);
    } catch (err: any) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        navigate('/groups');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteExpense(expenseId: number) {
    if (!confirm('Delete this expense?')) return;
    try {
      await api.delete(`/expenses/${expenseId}`);
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      loadGroupData(); // Refresh balances
    } catch {
      // ignore
    }
  }

  async function handleSimplifyDebts() {
    if (!currentUser?.is_premium) {
      navigate('/premium');
      return;
    }
    setLoadingSimplify(true);
    try {
      // Use the balances from group (already simplified) and show them
      const res = await api.get(`/groups/${groupId}`);
      setSimplifiedDebts(res.data.balances);
      setShowSimplified(true);
    } catch {
      // ignore
    } finally {
      setLoadingSimplify(false);
    }
  }

  async function handleRemoveMember(userId: number) {
    if (!confirm('Remove this member?')) return;
    try {
      await api.delete(`/groups/${groupId}/members/${userId}`);
      loadGroupData();
    } catch {
      // ignore
    }
  }

  async function handleDeleteGroup() {
    if (!confirm('Delete this group and all its data? This cannot be undone.')) return;
    try {
      await api.delete(`/groups/${groupId}`);
      navigate('/groups');
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!group) return null;

  const members = group.members || [];
  const balances = group.balances || [];
  const symbol = CURRENCY_SYMBOLS['EUR'];

  const myBalance = balances.reduce((sum, b) => {
    if (b.to_user_id === currentUser?.id) return sum + b.amount;
    if (b.from_user_id === currentUser?.id) return sum - b.amount;
    return sum;
  }, 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/groups')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Groups
        </button>

        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
            style={{ backgroundColor: group.cover_color }}
          >
            {group.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{group.name}</h1>
            {group.description && (
              <p className="text-sm text-gray-500 mt-0.5">{group.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-gray-400 flex items-center gap-1">
                <Users className="w-4 h-4" />
                {members.length} member{members.length !== 1 ? 's' : ''}
              </span>
              <span className="text-sm text-gray-400">{group.type}</span>
            </div>
          </div>
          {group.created_by === currentUser?.id && (
            <button
              onClick={handleDeleteGroup}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete group"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Balance Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Balances</h2>
        {balances.length === 0 ? (
          <p className="text-sm text-gray-500">Everyone is settled up!</p>
        ) : (
          <div className="space-y-2">
            {balances.map((b, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-medium text-gray-900 truncate">{b.from_user_name}</span>
                  <span className="text-gray-400 flex-shrink-0">owes</span>
                  <span className="font-medium text-gray-900 truncate">{b.to_user_name}</span>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <span className="font-semibold text-red-500">
                    {symbol}{b.amount.toFixed(2)}
                  </span>
                  {(b.from_user_id === currentUser?.id || b.to_user_id === currentUser?.id) && (
                    <button
                      onClick={() => { setSettleBalance(b); setShowSettleUp(true); }}
                      className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors"
                    >
                      Settle
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* My balance summary */}
        {Math.abs(myBalance) > 0.005 && (
          <div className={`mt-3 pt-3 border-t border-gray-100 text-sm font-medium ${myBalance > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {myBalance > 0
              ? `Overall, you are owed ${symbol}${myBalance.toFixed(2)}`
              : `Overall, you owe ${symbol}${Math.abs(myBalance).toFixed(2)}`
            }
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => { setEditExpense(null); setShowAddExpense(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
        <button
          onClick={() => { setSettleBalance(null); setShowSettleUp(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
        >
          <CreditCard className="w-4 h-4" />
          Settle Up
        </button>
        <button
          onClick={handleSimplifyDebts}
          disabled={loadingSimplify}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentUser?.is_premium
              ? 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'
              : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Zap className="w-4 h-4" />
          {loadingSimplify ? 'Loading...' : 'Simplify Debts'}
          {!currentUser?.is_premium && (
            <span className="text-xs bg-amber-100 text-amber-700 px-1 py-0.5 rounded">Pro</span>
          )}
        </button>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
        >
          <Users className="w-4 h-4" />
          Invite
        </button>
      </div>

      {/* Simplified Debts Panel */}
      {showSimplified && simplifiedDebts && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-amber-800 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Simplified Debts
            </h3>
            <button
              onClick={() => setShowSimplified(false)}
              className="text-amber-600 hover:text-amber-800 text-sm"
            >
              ×
            </button>
          </div>
          {simplifiedDebts.length === 0 ? (
            <p className="text-sm text-amber-700">All debts are already settled!</p>
          ) : (
            <div className="space-y-1">
              {simplifiedDebts.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-amber-900">{b.from_user_name}</span>
                  <span className="text-amber-600">→</span>
                  <span className="font-medium text-amber-900">{b.to_user_name}</span>
                  <span className="ml-auto font-semibold text-amber-800">{symbol}{b.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {(['expenses', 'payments', 'members'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
            {t === 'expenses' && <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{expenses.length}</span>}
            {t === 'payments' && <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{payments.length}</span>}
          </button>
        ))}
      </div>

      {/* Expenses Tab */}
      {tab === 'expenses' && (
        <div className="space-y-3">
          {expenses.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-500 mb-3">No expenses yet</p>
              <button
                onClick={() => { setEditExpense(null); setShowAddExpense(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add First Expense
              </button>
            </div>
          ) : (
            expenses.map(expense => (
              <ExpenseItem
                key={expense.id}
                expense={expense}
                onDelete={handleDeleteExpense}
                onEdit={e => { setEditExpense(e); setShowAddExpense(true); }}
              />
            ))
          )}
        </div>
      )}

      {/* Payments Tab */}
      {tab === 'payments' && (
        <div className="space-y-3">
          {payments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-500 mb-3">No payments recorded yet</p>
              <button
                onClick={() => { setSettleBalance(null); setShowSettleUp(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
              >
                <CreditCard className="w-4 h-4" />
                Record Payment
              </button>
            </div>
          ) : (
            payments.map(payment => (
              <div key={payment.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-900">{payment.from_user_name}</span>
                    <span className="text-gray-400">paid</span>
                    <span className="font-medium text-gray-900">{payment.to_user_name}</span>
                  </div>
                  {payment.notes && (
                    <p className="text-xs text-gray-500 mt-0.5 italic">"{payment.notes}"</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(payment.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600">
                    {CURRENCY_SYMBOLS[payment.currency] || payment.currency}{payment.amount.toFixed(2)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="space-y-2">
          {members.map(member => (
            <div key={member.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: member.avatar_color }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {member.name}
                    {member.id === currentUser?.id && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                    {member.id === group.created_by && <span className="ml-2 text-xs text-emerald-600">admin</span>}
                  </p>
                  <p className="text-xs text-gray-500">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const memberBalance = balances.reduce((sum, b) => {
                    if (b.to_user_id === member.id) return sum + b.amount;
                    if (b.from_user_id === member.id) return sum - b.amount;
                    return sum;
                  }, 0);
                  return memberBalance !== 0 ? (
                    <span className={`text-sm font-medium ${memberBalance > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {memberBalance > 0 ? '+' : ''}{symbol}{memberBalance.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">settled</span>
                  );
                })()}
                {(group.created_by === currentUser?.id || member.id === currentUser?.id) &&
                  member.id !== group.created_by && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
              </div>
            </div>
          ))}
          <button
            onClick={() => setShowInvite(true)}
            className="w-full py-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Invite member
          </button>
        </div>
      )}

      {/* Modals */}
      {showAddExpense && (
        <AddExpenseModal
          groupId={groupId}
          members={members}
          editExpense={editExpense}
          onClose={() => { setShowAddExpense(false); setEditExpense(null); }}
          onSuccess={() => {
            setShowAddExpense(false);
            setEditExpense(null);
            loadGroupData();
          }}
        />
      )}

      {showSettleUp && (
        <SettleUpModal
          groupId={groupId}
          members={members}
          suggestedBalance={settleBalance}
          onClose={() => { setShowSettleUp(false); setSettleBalance(null); }}
          onSuccess={() => {
            setShowSettleUp(false);
            setSettleBalance(null);
            loadGroupData();
          }}
        />
      )}

      {showInvite && (
        <InviteMemberModal
          groupId={groupId}
          existingMembers={members}
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            setShowInvite(false);
            loadGroupData();
          }}
        />
      )}
    </div>
  );
}
