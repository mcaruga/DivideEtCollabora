import React, { useState } from 'react';
import {
  Check, Star, BarChart2, Zap, Upload, RefreshCw, Download, Lock
} from 'lucide-react';
import api from '../api/client';
import useAuthStore from '../store/useAuthStore';

const FREE_FEATURES = [
  'Unlimited groups',
  'Add expenses',
  'Equal split',
  'Exact amount split',
  'Percentage split',
  'Shares-based split',
  'Invite members',
  'Record payments',
  'Balance tracking',
];

const PREMIUM_FEATURES = [
  { icon: BarChart2, text: 'Spending analytics & charts' },
  { icon: Download, text: 'Export to CSV' },
  { icon: Zap, text: 'Debt simplification algorithm' },
  { icon: Upload, text: 'Receipt uploads' },
  { icon: RefreshCw, text: 'Recurring expenses' },
  { icon: Star, text: 'Priority support' },
];

export default function Premium() {
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await api.post('/users/upgrade-premium');
      updateUser(res.data);
      setSuccess(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  if (user?.is_premium) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-100 rounded-full mb-6">
            <Star className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">You're a Premium Member!</h1>
          <p className="text-gray-500 mb-6">
            You have access to all premium features including analytics, receipt uploads,
            recurring expenses, and debt simplification.
          </p>
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-6 py-3 rounded-full font-medium">
            <Star className="w-5 h-5" />
            Premium Active
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
          <Star className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Upgrade to Premium</h1>
        <p className="text-gray-500 text-lg">
          Get advanced features to better manage shared expenses
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Free Plan */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">Free</h2>
            <div className="mt-2">
              <span className="text-3xl font-bold text-gray-900">€0</span>
              <span className="text-gray-500">/month</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Perfect for getting started</p>
          </div>

          <div className="space-y-2.5 mb-6">
            {FREE_FEATURES.map(feature => (
              <div key={feature} className="flex items-center gap-2.5 text-sm text-gray-700">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                {feature}
              </div>
            ))}
          </div>

          <div className="px-4 py-2.5 bg-gray-100 rounded-lg text-center text-sm font-medium text-gray-500">
            Current Plan
          </div>
        </div>

        {/* Premium Plan */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-300 p-6 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              RECOMMENDED
            </span>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Premium
              <Star className="w-5 h-5 text-amber-500" />
            </h2>
            <div className="mt-2">
              <span className="text-3xl font-bold text-gray-900">€9.99</span>
              <span className="text-gray-500">/month</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Everything in Free, plus:</p>
          </div>

          <div className="space-y-2.5 mb-6">
            {FREE_FEATURES.map(feature => (
              <div key={feature} className="flex items-center gap-2.5 text-sm text-gray-700">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                {feature}
              </div>
            ))}
            <div className="border-t border-amber-200 my-2 pt-2">
              {PREMIUM_FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 text-sm font-medium text-amber-800 mt-2">
                  <Icon className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  {text}
                </div>
              ))}
            </div>
          </div>

          {success ? (
            <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-lg font-medium text-sm">
              <Check className="w-4 h-4" />
              Upgraded Successfully!
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Star className="w-4 h-4" />
              {loading ? 'Upgrading...' : 'Upgrade Now – €9.99/mo'}
            </button>
          )}

          <p className="text-xs text-center text-amber-600 mt-3">
            Demo: click to instantly activate Premium
          </p>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PREMIUM_FEATURES.map(({ icon: Icon, text }) => (
          <div key={text} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{text}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {text.includes('analytics') && 'Visualize your spending over time with beautiful charts'}
                {text.includes('CSV') && 'Export all expenses to spreadsheet for detailed analysis'}
                {text.includes('simplification') && 'Minimize the number of transactions to settle up'}
                {text.includes('Receipt') && 'Attach photos or PDFs of receipts to expenses'}
                {text.includes('Recurring') && 'Set up automatic recurring expense tracking'}
                {text.includes('support') && 'Get help from our team faster than free users'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
