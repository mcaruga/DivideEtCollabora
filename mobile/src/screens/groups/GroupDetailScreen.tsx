import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Plus,
  CreditCard,
  Users,
  ArrowRight,
  UserPlus,
  X,
  Receipt,
  Wallet,
} from 'lucide-react-native';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { api } from '../../api/client';
import { Balance, Expense, Payment, User, Group } from '../../types';
import { GroupsStackParamList } from '../../navigation';
import { useAuthStore } from '../../store/useAuthStore';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupDetail'>;

type TabType = 'spese' | 'pagamenti' | 'membri';

const CATEGORY_ICONS: Record<string, string> = {
  cibo: '🍕',
  trasporti: '🚗',
  alloggio: '🏠',
  intrattenimento: '🎭',
  shopping: '🛍️',
  altro: '📌',
};

export default function GroupDetailScreen({ navigation, route }: Props) {
  const { groupId, groupName } = route.params;
  const [activeTab, setActiveTab] = useState<TabType>('spese');
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleTarget, setSettleTarget] = useState<Balance | null>(null);

  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const {
    data: groupData,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<{
    group: Group;
    expenses: Expense[];
    balances: Balance[];
    payments: Payment[];
  }>({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const [groupRes, expensesRes, balancesRes, paymentsRes] = await Promise.all([
        api.get(`/groups/${groupId}`),
        api.get(`/groups/${groupId}/expenses`),
        api.get(`/groups/${groupId}/balances`),
        api.get(`/groups/${groupId}/payments`),
      ]);
      return {
        group: groupRes.data.group || groupRes.data,
        expenses: expensesRes.data.expenses || expensesRes.data || [],
        balances: balancesRes.data.balances || balancesRes.data || [],
        payments: paymentsRes.data.payments || paymentsRes.data || [],
      };
    },
  });

  const settleMutation = useMutation({
    mutationFn: async (paymentData: {
      to_user_id: number;
      amount: number;
      currency: string;
      group_id: number;
    }) => {
      const res = await api.post('/payments', paymentData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowSettleModal(false);
      setSettleAmount('');
      setSettleTarget(null);
    },
    onError: (error: any) => {
      Alert.alert('Errore', error.response?.data?.error || 'Errore nel pagamento');
    },
  });

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      await api.post(`/groups/${groupId}/members`, { email: inviteEmail.trim() });
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      setInviteEmail('');
      setShowInviteModal(false);
      Alert.alert('Successo', 'Membro invitato con successo!');
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.error || 'Errore nell\'invito');
    } finally {
      setInviteLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'Fr' };
    const symbol = symbols[currency] || currency;
    return `${symbol}${Math.abs(amount).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'd MMM', { locale: it });
    } catch {
      return dateStr;
    }
  };

  const handleSettleOpen = (balance: Balance) => {
    setSettleTarget(balance);
    setSettleAmount(balance.amount.toFixed(2));
    setShowSettleModal(true);
  };

  const handleSettle = () => {
    if (!settleTarget || !settleAmount) return;
    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Errore', 'Inserisci un importo valido');
      return;
    }
    settleMutation.mutate({
      to_user_id: settleTarget.to_user_id,
      amount,
      currency: settleTarget.currency,
      group_id: groupId,
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Errore nel caricamento</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { group, expenses = [], balances = [], payments = [] } = groupData || {};
  const members = group?.members || [];
  const currency = group?.members?.[0]?.currency || user?.currency || 'EUR';

  const myDebts = balances.filter((b) => b.from_user_id === user?.id);
  const owedToMe = balances.filter((b) => b.to_user_id === user?.id);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
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
        {/* Balance Summary */}
        {(myDebts.length > 0 || owedToMe.length > 0) && (
          <View style={styles.balanceSection}>
            <Text style={styles.balanceSectionTitle}>Stato dei conti</Text>
            {owedToMe.map((b, i) => (
              <View key={i} style={styles.balanceRow}>
                <View style={styles.balanceInfo}>
                  <View style={styles.avatarSmall}>
                    <Text style={styles.avatarText}>{b.from_user_name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.balanceText}>
                    <Text style={styles.balanceName}>{b.from_user_name}</Text>
                    <Text> ti deve </Text>
                    <Text style={styles.balanceAmountGreen}>{formatCurrency(b.amount, b.currency)}</Text>
                  </Text>
                </View>
              </View>
            ))}
            {myDebts.map((b, i) => (
              <View key={i} style={styles.balanceRow}>
                <View style={styles.balanceInfo}>
                  <View style={[styles.avatarSmall, styles.avatarRed]}>
                    <Text style={styles.avatarText}>{b.to_user_name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.balanceText}>
                    <Text>Devi </Text>
                    <Text style={styles.balanceAmountRed}>{formatCurrency(b.amount, b.currency)}</Text>
                    <Text> a </Text>
                    <Text style={styles.balanceName}>{b.to_user_name}</Text>
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.settleButton}
                  onPress={() => handleSettleOpen(b)}
                >
                  <Text style={styles.settleButtonText}>Salda</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              navigation.navigate('AddExpense', {
                groupId,
                groupName,
                members: members.map((m) => ({ id: m.id, name: m.name })),
              })
            }
            activeOpacity={0.8}
          >
            <Plus size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Aggiungi spesa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButtonOutline}
            onPress={() => {
              const firstDebt = myDebts[0];
              if (firstDebt) handleSettleOpen(firstDebt);
              else Alert.alert('Info', 'Non hai debiti in questo gruppo');
            }}
            activeOpacity={0.8}
          >
            <CreditCard size={20} color="#10B981" />
            <Text style={styles.actionButtonOutlineText}>Regola i conti</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {(['spese', 'pagamenti', 'membri'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab ? styles.tabActive : null]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab ? styles.tabTextActive : null]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'spese' && (
          <View style={styles.tabContent}>
            {expenses.length === 0 ? (
              <View style={styles.emptyTab}>
                <Receipt size={40} color="#D1D5DB" />
                <Text style={styles.emptyTabText}>Nessuna spesa ancora</Text>
                <Text style={styles.emptyTabSubtext}>
                  Aggiungi la prima spesa del gruppo
                </Text>
              </View>
            ) : (
              expenses.map((expense) => (
                <View key={expense.id} style={styles.expenseItem}>
                  <View style={styles.expenseCategoryIcon}>
                    <Text style={styles.expenseCategoryEmoji}>
                      {CATEGORY_ICONS[expense.category?.toLowerCase()] || '📌'}
                    </Text>
                  </View>
                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseDescription} numberOfLines={1}>
                      {expense.description}
                    </Text>
                    <Text style={styles.expenseMeta}>
                      {expense.paid_by_name || 'Tu'} • {formatDate(expense.date)}
                    </Text>
                  </View>
                  <View style={styles.expenseAmountCol}>
                    <Text style={styles.expenseAmount}>
                      {formatCurrency(expense.amount, expense.currency)}
                    </Text>
                    {expense.splits?.find((s) => s.user_id === user?.id) && (
                      <Text style={styles.expenseYourShare}>
                        tua quota:{' '}
                        {formatCurrency(
                          expense.splits.find((s) => s.user_id === user?.id)!.amount,
                          expense.currency
                        )}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'pagamenti' && (
          <View style={styles.tabContent}>
            {payments.length === 0 ? (
              <View style={styles.emptyTab}>
                <Wallet size={40} color="#D1D5DB" />
                <Text style={styles.emptyTabText}>Nessun pagamento ancora</Text>
                <Text style={styles.emptyTabSubtext}>
                  I pagamenti per saldare i debiti appariranno qui
                </Text>
              </View>
            ) : (
              payments.map((payment) => (
                <View key={payment.id} style={styles.paymentItem}>
                  <View style={styles.paymentIcon}>
                    <ArrowRight size={18} color="#10B981" />
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentText}>
                      <Text style={styles.paymentName}>{payment.from_user_name || 'Tu'}</Text>
                      <Text> ha pagato </Text>
                      <Text style={styles.paymentName}>{payment.to_user_name}</Text>
                    </Text>
                    <Text style={styles.paymentDate}>{formatDate(payment.created_at)}</Text>
                  </View>
                  <Text style={styles.paymentAmount}>
                    {formatCurrency(payment.amount, payment.currency)}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'membri' && (
          <View style={styles.tabContent}>
            {members.map((member) => (
              <View key={member.id} style={styles.memberItem}>
                <View style={[styles.memberAvatar, { backgroundColor: member.avatar_color || '#10B981' }]}>
                  <Text style={styles.memberAvatarText}>
                    {member.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberEmail}>{member.email}</Text>
                </View>
                {member.id === group?.created_by && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
              </View>
            ))}
            <TouchableOpacity
              style={styles.inviteButton}
              onPress={() => setShowInviteModal(true)}
            >
              <UserPlus size={18} color="#10B981" />
              <Text style={styles.inviteButtonText}>Invita membro</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Settle Modal */}
      <Modal
        visible={showSettleModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettleModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Regola i conti</Text>
              <TouchableOpacity onPress={() => setShowSettleModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {settleTarget && (
              <>
                <Text style={styles.settleDescription}>
                  Pagamento a <Text style={styles.settleName}>{settleTarget.to_user_name}</Text>
                </Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Importo ({settleTarget.currency})</Text>
                  <TextInput
                    style={styles.input}
                    value={settleAmount}
                    onChangeText={setSettleAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowSettleModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Annulla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.createButton, settleMutation.isPending ? styles.createButtonDisabled : null]}
                    onPress={handleSettle}
                    disabled={settleMutation.isPending}
                  >
                    {settleMutation.isPending ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.createButtonText}>Conferma pagamento</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInviteModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invita membro</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email del membro</Text>
              <TextInput
                style={styles.input}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="email@esempio.com"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowInviteModal(false)}
              >
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createButton, inviteLoading ? styles.createButtonDisabled : null]}
                onPress={handleInvite}
                disabled={inviteLoading}
              >
                {inviteLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.createButtonText}>Invita</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  errorTitle: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
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
    paddingBottom: 32,
  },
  balanceSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginBottom: 0,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  balanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRed: {
    backgroundColor: '#EF4444',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  balanceText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  balanceName: {
    fontWeight: '700',
    color: '#111827',
  },
  balanceAmountGreen: {
    color: '#059669',
    fontWeight: '700',
  },
  balanceAmountRed: {
    color: '#EF4444',
    fontWeight: '700',
  },
  settleButton: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  settleButtonText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 13,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  actionButtonOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  actionButtonOutlineText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 14,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: '#10B981',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabContent: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  emptyTab: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  emptyTabSubtext: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  expenseItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  expenseCategoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  expenseCategoryEmoji: {
    fontSize: 20,
  },
  expenseInfo: {
    flex: 1,
    marginRight: 10,
  },
  expenseDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 3,
  },
  expenseMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  expenseAmountCol: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  expenseYourShare: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  paymentItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  paymentIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentText: {
    fontSize: 14,
    color: '#374151',
  },
  paymentName: {
    fontWeight: '700',
    color: '#111827',
  },
  paymentDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  paymentAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  memberItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  memberAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  memberEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  adminBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  adminBadgeText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#D1FAE5',
    borderStyle: 'dashed',
    marginTop: 4,
  },
  inviteButtonText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  settleDescription: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 16,
  },
  settleName: {
    fontWeight: '700',
    color: '#111827',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 15,
  },
  createButton: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#10B981',
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
