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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Plus, Users, X, ChevronRight } from 'lucide-react-native';
import { api } from '../../api/client';
import { Group } from '../../types';
import { GroupsStackParamList } from '../../navigation';
import { useAuthStore } from '../../store/useAuthStore';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupsList'>;

const GROUP_TYPES = [
  { value: 'trip', label: 'Viaggio', emoji: '✈️' },
  { value: 'home', label: 'Casa', emoji: '🏠' },
  { value: 'couple', label: 'Coppia', emoji: '❤️' },
  { value: 'other', label: 'Altro', emoji: '📌' },
];

const GROUP_COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
];

export default function GroupsScreen({ navigation }: Props) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupType, setNewGroupType] = useState<'trip' | 'home' | 'couple' | 'other'>('other');
  const [selectedColor, setSelectedColor] = useState(GROUP_COLORS[0]);
  const [formErrors, setFormErrors] = useState<{ name?: string }>({});

  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await api.get('/groups');
      return res.data.groups || res.data || [];
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (groupData: {
      name: string;
      description?: string;
      type: string;
      cover_color: string;
    }) => {
      const res = await api.post('/groups', groupData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      handleCloseModal();
    },
    onError: (error: any) => {
      const message =
        error.response?.data?.error || error.response?.data?.message || 'Errore nella creazione del gruppo';
      Alert.alert('Errore', message);
    },
  });

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setNewGroupName('');
    setNewGroupDescription('');
    setNewGroupType('other');
    setSelectedColor(GROUP_COLORS[0]);
    setFormErrors({});
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      setFormErrors({ name: 'Il nome del gruppo è richiesto' });
      return;
    }
    createGroupMutation.mutate({
      name: newGroupName.trim(),
      description: newGroupDescription.trim() || undefined,
      type: newGroupType,
      cover_color: selectedColor,
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'Fr' };
    const symbol = symbols[currency] || currency;
    return `${symbol}${Math.abs(amount).toFixed(2)}`;
  };

  const currency = user?.currency || 'EUR';

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
          <Text style={styles.errorTitle}>Errore nel caricamento dei gruppi</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const groups = data || [];

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
        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>Nessun gruppo</Text>
            <Text style={styles.emptyStateText}>
              Crea il tuo primo gruppo per iniziare a dividere le spese
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.emptyStateButtonText}>Crea gruppo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.groupsList}>
            {groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.groupCard}
                onPress={() =>
                  navigation.navigate('GroupDetail', {
                    groupId: group.id,
                    groupName: group.name,
                  })
                }
                activeOpacity={0.7}
              >
                <View
                  style={[styles.groupCardHeader, { backgroundColor: group.cover_color || '#10B981' }]}
                >
                  <Text style={styles.groupCardEmoji}>
                    {GROUP_TYPES.find((t) => t.value === group.type)?.emoji || '📌'}
                  </Text>
                </View>
                <View style={styles.groupCardBody}>
                  <Text style={styles.groupName} numberOfLines={2}>
                    {group.name}
                  </Text>
                  {group.description ? (
                    <Text style={styles.groupDescription} numberOfLines={1}>
                      {group.description}
                    </Text>
                  ) : null}
                  <View style={styles.groupMeta}>
                    <View style={styles.memberCountBadge}>
                      <Users size={12} color="#6B7280" />
                      <Text style={styles.memberCountText}>
                        {group.member_count || group.members?.length || 0}
                      </Text>
                    </View>
                    {group.my_balance !== undefined && group.my_balance !== null && group.my_balance !== 0 ? (
                      <Text
                        style={[
                          styles.groupBalance,
                          group.my_balance > 0 ? styles.balancePositive : styles.balanceNegative,
                        ]}
                      >
                        {group.my_balance > 0 ? '+' : ''}
                        {formatCurrency(group.my_balance, currency)}
                      </Text>
                    ) : (
                      <Text style={styles.balancePar}>In pari</Text>
                    )}
                  </View>
                </View>
                <ChevronRight size={18} color="#9CA3AF" style={styles.chevron} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      {groups.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.85}
        >
          <Plus size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Create Group Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuovo Gruppo</Text>
              <TouchableOpacity onPress={handleCloseModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome gruppo *</Text>
                <TextInput
                  style={[styles.input, formErrors.name ? styles.inputError : null]}
                  placeholder="Es. Vacanza a Roma"
                  placeholderTextColor="#9CA3AF"
                  value={newGroupName}
                  onChangeText={(t) => {
                    setNewGroupName(t);
                    if (formErrors.name) setFormErrors({});
                  }}
                  maxLength={60}
                />
                {formErrors.name ? <Text style={styles.errorText}>{formErrors.name}</Text> : null}
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Descrizione (opzionale)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Breve descrizione del gruppo..."
                  placeholderTextColor="#9CA3AF"
                  value={newGroupDescription}
                  onChangeText={setNewGroupDescription}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                />
              </View>

              {/* Type */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tipo di gruppo</Text>
                <View style={styles.typeSelector}>
                  {GROUP_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeOption,
                        newGroupType === type.value ? styles.typeOptionSelected : null,
                      ]}
                      onPress={() => setNewGroupType(type.value as any)}
                    >
                      <Text style={styles.typeEmoji}>{type.emoji}</Text>
                      <Text
                        style={[
                          styles.typeLabel,
                          newGroupType === type.value ? styles.typeLabelSelected : null,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Color */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Colore</Text>
                <View style={styles.colorPicker}>
                  {GROUP_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        selectedColor === color ? styles.colorOptionSelected : null,
                      ]}
                      onPress={() => setSelectedColor(color)}
                    />
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCloseModal}>
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.createButton,
                  createGroupMutation.isPending ? styles.createButtonDisabled : null,
                ]}
                onPress={handleCreateGroup}
                disabled={createGroupMutation.isPending}
              >
                {createGroupMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.createButtonText}>Crea gruppo</Text>
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
    padding: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  groupsList: {
    gap: 12,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupCardHeader: {
    width: 60,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCardEmoji: {
    fontSize: 28,
  },
  groupCardBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  groupName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  groupDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  memberCountText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  groupBalance: {
    fontSize: 14,
    fontWeight: '700',
  },
  balancePositive: {
    color: '#059669',
  },
  balanceNegative: {
    color: '#EF4444',
  },
  balancePar: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  chevron: {
    marginRight: 12,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
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
    maxHeight: '90%',
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
  inputGroup: {
    marginBottom: 18,
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
  inputError: {
    borderColor: '#EF4444',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  typeOptionSelected: {
    borderColor: '#10B981',
    backgroundColor: '#D1FAE5',
  },
  typeEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  typeLabelSelected: {
    color: '#059669',
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#111827',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
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
