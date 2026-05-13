import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Users, Plus, ArrowRight, Activity } from 'lucide-react';
import api from '../api/client';
import useAuthStore from '../store/useAuthStore';
import { Group } from '../types';

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'Fr' };

interface ActivityItem {
  id: number;
  group_id?: number;
  user_id: number;
  user_name?: string;
  type: string;
  data?: any;
  created_at: string;
  group_name?: string;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [groupsRes] = await Promise.all([
        api.get('/groups'),
      ]);
      setGroups(groupsRes.data);

      // Fetch activities for each group
      const allActivities: ActivityItem[] = [];
      for (const group of groupsRes.data.slice(0, 5)) {
        try {
          const details = await api.get(`/groups/${group.id}`);
          // activities from group details not available in basic API, skip
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const symbol = CURRENCY_SYMBOLS[user?.currency || 'EUR'] || '€';

  const totalOwedToMe = groups.reduce((sum, g) => {
    if ((g.my_balance || 0) > 0) return sum + (g.my_balance || 0);
    return sum;
  }, 0);

  const totalIOwe = groups.reduce((sum, g) => {
    if ((g.my_balance || 0) < 0) return sum + Math.abs(g.my_balance || 0);
    return sum;
  }, 0);

  const netBalance = totalOwedToMe - totalIOwe;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]}!
        </h1>
        <p className="text-gray-500 mt-1">Here's your expense summary</p>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-500">You are owed</p>
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            {symbol}{totalOwedToMe.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-500">You owe</p>
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-500">
            {symbol}{totalIOwe.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-500">Net balance</p>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${netBalance >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
              {netBalance >= 0
                ? <TrendingUp className="w-4 h-4 text-emerald-600" />
                : <TrendingDown className="w-4 h-4 text-red-500" />
              }
            </div>
          </div>
          <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {netBalance >= 0 ? '+' : ''}{symbol}{netBalance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Groups */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Your Groups
          </h2>
          <Link
            to="/groups"
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {groups.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">No groups yet</h3>
            <p className="text-sm text-gray-500 mb-4">Create a group to start tracking expenses</p>
            <Link
              to="/groups"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Group
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {groups.slice(0, 5).map(group => (
              <Link
                key={group.id}
                to={`/groups/${group.id}`}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-emerald-300 hover:shadow-sm transition-all flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: group.cover_color }}
                  >
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{group.name}</p>
                    <p className="text-xs text-gray-500">
                      {group.member_count || 0} member{(group.member_count || 0) !== 1 ? 's' : ''}
                      {group.type && group.type !== 'other' && ` · ${group.type}`}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {(group.my_balance || 0) === 0 ? (
                    <p className="text-sm font-medium text-gray-400">settled up</p>
                  ) : (group.my_balance || 0) > 0 ? (
                    <div>
                      <p className="text-sm font-bold text-emerald-600">+{symbol}{(group.my_balance || 0).toFixed(2)}</p>
                      <p className="text-xs text-emerald-500">you're owed</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-red-500">-{symbol}{Math.abs(group.my_balance || 0).toFixed(2)}</p>
                      <p className="text-xs text-red-400">you owe</p>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {groups.length > 5 && (
        <div className="text-center">
          <Link
            to="/groups"
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            View all {groups.length} groups →
          </Link>
        </div>
      )}
    </div>
  );
}
