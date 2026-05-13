import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TrendingUp, TrendingDown, ChevronRight, Users } from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../api/client';
import { Group, Balance } from '../../types';
import { MainTabsParamList, GroupsStackParamList } from '../../navigation';

type DashboardNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList, 'Dashboard'>,
  NativeStackNavigationProp<GroupsStackParamList>
>;

interface DashboardData {
  groups: Group[];
  total_owed: number;
  total_owe: number;
  currency: string;
}

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<DashboardNavProp>();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [groupsRes, balancesRes] = await Promise.all([
        api.get('/groups'),
        api.get('/balances'),
      ]);
      const groups: Group[] = groupsRes.data.groups || groupsRes.data || [];
      const balances: Balance[] = balancesRes.data.balances || balancesRes.data || [];
      const currentUserId = user?.id;
      let total_owed = 0;
      let total_owe = 0;
      balances.forEach((b) => {
        if (b.to_user_id === currentUserId) total_owed += b.amount;
        if (b.from_user_id === currentUserId) total_owe += b.amount;
      });
      return {
        groups,
        total_owed,
        total_owe,
        currency: user?.currency || 'EUR',
      };
    },
    enabled: !!user,
  });

  const handleGroupPress = useCallback(
    (group: Group) => {
      navigation.navigate('GroupsStack' as any, {
        screen: 'GroupDetail',
        params: { groupId: group.id, groupName: group.name },
      } as any);
    },
    [navigation]
  );

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'Fr' };
    const symbol = symbols[currency] || currency;
    return `${symbol}${Math.abs(amount).toFixed(2)}`;
  };

  const getFirstName = (name: string) => name.split(' ')[0];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Caricamento...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Ops, qualcosa è andato storto</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { groups = [], total_owed = 0, total_owe = 0, currency = 'EUR' } = data || {};
  const netBalance = total_owed - total_owe;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#10B981"
            colors={['#10B981']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Ciao, {user ? getFirstName(user.name) : ''}! 👋
            </Text>
            <Text style={styles.subGreeting}>Ecco il riepilogo dei tuoi conti</Text>
          </View>
          {user?.is_premium && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>PREMIUM</Text>
            </View>
          )}
        </View>

        {/* Balance Summary Cards */}
        <View style={styles.balanceRow}>
          <View style={[styles.balanceCard, styles.balanceCardGreen]}>
            <View style={styles.balanceCardIcon}>
              <TrendingUp size={20} color="#10B981" />
            </View>
            <Text style={styles.balanceCardLabel}>Ti devono</Text>
            <Text style={[styles.balanceCardAmount, styles.amountGreen]}>
              {formatCurrency(total_owed, currency)}
            </Text>
          </View>

          <View style={[styles.balanceCard, styles.balanceCardRed]}>
            <View style={[styles.balanceCardIcon, styles.balanceCardIconRed]}>
              <TrendingDown size={20} color="#EF4444" />
            </View>
            <Text style={styles.balanceCardLabel}>Devi</Text>
            <Text style={[styles.balanceCardAmount, styles.amountRed]}>
              {formatCurrency(total_owe, currency)}
            </Text>
          </View>
        </View>

        {/* Net Balance */}
        <View style={styles.netBalanceCard}>
          <Text style={styles.netBalanceLabel}>Bilancio netto</Text>
          <Text
            style={[
              styles.netBalanceAmount,
              netBalance >= 0 ? styles.amountGreen : styles.amountRed,
            ]}
          >
            {netBalance >= 0 ? '+' : '-'}
            {formatCurrency(Math.abs(netBalance), currency)}
          </Text>
        </View>

        {/* Groups Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>I tuoi gruppi</Text>
          <Text style={styles.sectionCount}>{groups.length}</Text>
        </View>

        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={48} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>Nessun gruppo ancora</Text>
            <Text style={styles.emptyStateText}>
              Vai alla scheda Gruppi per creare il tuo primo gruppo
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={styles.groupCard}
              onPress={() => handleGroupPress(group)}
              activeOpacity={0.7}
            >
              <View style={[styles.groupColorBar, { backgroundColor: group.cover_color || '#10B981' }]} />
              <View style={styles.groupCardContent}>
                <View style={styles.groupCardLeft}>
                  <Text style={styles.groupName} numberOfLines={1}>
                    {group.name}
                  </Text>
                  <Text style={styles.groupMeta}>
                    {group.member_count || group.members?.length || 0} membri
                  </Text>
                </View>
                <View style={styles.groupCardRight}>
                  {group.my_balance !== undefined && group.my_balance !== null && group.my_balance !== 0 ? (
                    <Text
                      style={[
                        styles.groupBalance,
                        group.my_balance > 0 ? styles.amountGreen : styles.amountRed,
                      ]}
                    >
                      {group.my_balance > 0 ? '+' : ''}
                      {formatCurrency(group.my_balance, currency)}
                    </Text>
                  ) : (
                    <Text style={styles.groupBalanceZero}>In pari</Text>
                  )}
                  <ChevronRight size={18} color="#9CA3AF" />
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subGreeting: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  premiumBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  premiumBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  balanceRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceCardGreen: {
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  balanceCardRed: {
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  balanceCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  balanceCardIconRed: {
    backgroundColor: '#FEE2E2',
  },
  balanceCardLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  balanceCardAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  amountGreen: {
    color: '#059669',
  },
  amountRed: {
    color: '#EF4444',
  },
  netBalanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  netBalanceLabel: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
  netBalanceAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  sectionCount: {
    backgroundColor: '#E5E7EB',
    color: '#374151',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  groupColorBar: {
    width: 5,
  },
  groupCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  groupCardLeft: {
    flex: 1,
    marginRight: 12,
  },
  groupName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 3,
  },
  groupMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  groupCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupBalance: {
    fontSize: 15,
    fontWeight: '700',
  },
  groupBalanceZero: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
