import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import { Download, TrendingUp } from 'lucide-react';
import api from '../api/client';
import { Group } from '../types';

const COLORS = ['#10B981', '#4F46E5', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#EC4899'];

interface SpendingData {
  month: string;
  total: number;
}

interface CategoryData {
  category: string;
  total: number;
}

interface PersonData {
  name: string;
  id: number;
  total: number;
}

export default function Analytics() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [period, setPeriod] = useState<'3' | '6' | '12'>('6');
  const [spendingData, setSpendingData] = useState<SpendingData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [personData, setPersonData] = useState<PersonData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/groups').then(res => setGroups(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [selectedGroup, period]);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (selectedGroup) params.set('groupId', selectedGroup);

      const [spendingRes, catRes, personRes] = await Promise.all([
        api.get(`/analytics/spending?${params}`),
        api.get(`/analytics/categories?${selectedGroup ? `groupId=${selectedGroup}` : ''}`),
        api.get(`/analytics/per-person?${selectedGroup ? `groupId=${selectedGroup}` : ''}`),
      ]);

      setSpendingData(spendingRes.data);
      setCategoryData(catRes.data);
      setPersonData(personRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    try {
      const url = `/api/analytics/export/csv${selectedGroup ? `?groupId=${selectedGroup}` : ''}`;
      const token = localStorage.getItem('token');
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'expenses.csv';
      a.click();
    } catch {
      // ignore
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Track your spending patterns</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="">All Groups</option>
            {groups.map(g => (
              <option key={g.id} value={g.id.toString()}>{g.name}</option>
            ))}
          </select>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['3', '6', '12'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  period === p ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {p}mo
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Spending Over Time */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Spending Over Time
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={spendingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tickFormatter={v => {
                    const [y, m] = v.split('-');
                    return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-GB', { month: 'short' });
                  }}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${v}`} />
                <Tooltip
                  formatter={(value: number) => [`€${value.toFixed(2)}`, 'Spending']}
                  labelFormatter={(label: string) => {
                    const [y, m] = label.split('-');
                    return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Spending by Category */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">By Category</h2>
              {categoryData.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ category, percent }) =>
                        `${category} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`€${v.toFixed(2)}`]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Spending by Person */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">By Person</h2>
              {personData.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={personData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `€${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v: number) => [`€${v.toFixed(2)}`, 'Share']} />
                    <Bar dataKey="total" fill="#10B981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Summary table */}
          {categoryData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Category Summary</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {categoryData.map((cat, i) => (
                  <div key={cat.category} className="px-6 py-3 flex items-center gap-4">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-sm font-medium text-gray-900 capitalize flex-1">{cat.category}</span>
                    <span className="text-sm font-semibold text-gray-900">€{cat.total.toFixed(2)}</span>
                    <span className="text-xs text-gray-400 w-12 text-right">
                      {((cat.total / categoryData.reduce((s, c) => s + c.total, 0)) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
