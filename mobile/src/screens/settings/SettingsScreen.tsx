import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Mail,
  Globe,
  Crown,
  LogOut,
  Edit2,
  Check,
  X,
  ChevronRight,
  Info,
} from 'lucide-react-native';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';

const CURRENCIES = [
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'USD', label: 'Dollaro USA', symbol: '$' },
  { value: 'GBP', label: 'Sterlina', symbol: '£' },
  { value: 'JPY', label: 'Yen giapponese', symbol: '¥' },
  { value: 'CHF', label: 'Franco svizzero', symbol: 'Fr' },
];

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const { user, logout, updateUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const updateUserMutation = useMutation({
    mutationFn: async (data: { name?: string; currency?: string }) => {
      const res = await api.put('/users/me', data);
      return res.data;
    },
    onSuccess: (data) => {
      updateUser(data.user || data);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: any) => {
      Alert.alert('Errore', error.response?.data?.error || 'Errore nell\'aggiornamento del profilo');
    },
  });

  const handleSaveName = () => {
    if (!editedName.trim()) {
      Alert.alert('Errore', 'Il nome non può essere vuoto');
      return;
    }
    updateUserMutation.mutate({ name: editedName.trim() });
    setIsEditingName(false);
  };

  const handleCancelEditName = () => {
    setEditedName(user?.name || '');
    setIsEditingName(false);
  };

  const handleChangeCurrency = (currency: string) => {
    updateUserMutation.mutate({ currency });
    setShowCurrencyModal(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Esci',
      'Sei sicuro di voler uscire dall\'account?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Esci',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
              queryClient.clear();
            } catch {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleUpgradePremium = () => {
    Alert.alert(
      'Passa a Premium',
      'Con Premium ottieni:\n\n• Allegare foto alle spese\n• Gruppi illimitati\n• Statistiche avanzate\n• Esporta report PDF\n\n€4.99/mese',
      [
        { text: 'Non ora', style: 'cancel' },
        { text: 'Abbonati', onPress: () => Alert.alert('Presto disponibile!', 'Il pagamento sarà disponibile a breve.') },
      ]
    );
  };

  const currentCurrency = CURRENCIES.find((c) => c.value === user?.currency);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View style={styles.profileCard}>
          <View style={[styles.avatarLarge, { backgroundColor: user?.avatar_color || '#10B981' }]}>
            <Text style={styles.avatarLargeText}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            {isEditingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={styles.nameInput}
                  value={editedName}
                  onChangeText={setEditedName}
                  autoFocus
                  maxLength={60}
                />
                <TouchableOpacity onPress={handleSaveName} style={styles.nameEditButton}>
                  {updateUserMutation.isPending ? (
                    <ActivityIndicator size="small" color="#10B981" />
                  ) : (
                    <Check size={20} color="#10B981" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCancelEditName} style={styles.nameEditButton}>
                  <X size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.nameRow}>
                <Text style={styles.profileName}>{user?.name}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setEditedName(user?.name || '');
                    setIsEditingName(true);
                  }}
                  style={styles.editNameButton}
                >
                  <Edit2 size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.profileEmail}>{user?.email}</Text>
            {user?.is_premium && (
              <View style={styles.premiumBadge}>
                <Crown size={12} color="#92400E" />
                <Text style={styles.premiumBadgeText}>PREMIUM</Text>
              </View>
            )}
          </View>
        </View>

        {/* Settings Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: '#DBEAFE' }]}>
                <Mail size={18} color="#3B82F6" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Email</Text>
                <Text style={styles.settingValue}>{user?.email}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setShowCurrencyModal(true)}
            >
              <View style={[styles.settingIcon, { backgroundColor: '#D1FAE5' }]}>
                <Globe size={18} color="#10B981" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Valuta predefinita</Text>
                <Text style={styles.settingValue}>
                  {currentCurrency ? `${currentCurrency.symbol} ${currentCurrency.label}` : user?.currency}
                </Text>
              </View>
              {updateUserMutation.isPending && !isEditingName ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <ChevronRight size={18} color="#9CA3AF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Premium Section */}
        {!user?.is_premium && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Premium</Text>
            <TouchableOpacity style={styles.premiumCard} onPress={handleUpgradePremium}>
              <View style={styles.premiumCardContent}>
                <View style={styles.premiumIconContainer}>
                  <Crown size={28} color="#F59E0B" />
                </View>
                <View style={styles.premiumCardInfo}>
                  <Text style={styles.premiumCardTitle}>Passa a Premium</Text>
                  <Text style={styles.premiumCardDesc}>
                    Foto spese, gruppi illimitati e molto altro
                  </Text>
                </View>
              </View>
              <View style={styles.premiumButton}>
                <Text style={styles.premiumButtonText}>€4.99/mese</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {user?.is_premium && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Premium</Text>
            <View style={styles.premiumActiveCard}>
              <Crown size={24} color="#F59E0B" />
              <View style={styles.premiumActiveInfo}>
                <Text style={styles.premiumActiveTitle}>Sei un utente Premium</Text>
                <Text style={styles.premiumActiveDesc}>Hai accesso a tutte le funzionalità</Text>
              </View>
            </View>
          </View>
        )}

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informazioni</Text>
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: '#F3F4F6' }]}>
                <Info size={18} color="#6B7280" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Versione app</Text>
                <Text style={styles.settingValue}>{APP_VERSION}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator color="#EF4444" size="small" />
            ) : (
              <LogOut size={20} color="#EF4444" />
            )}
            <Text style={styles.logoutButtonText}>Esci dall'account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Currency Modal */}
      <Modal
        visible={showCurrencyModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCurrencyModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleziona valuta</Text>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {CURRENCIES.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={styles.currencyOption}
                onPress={() => handleChangeCurrency(c.value)}
              >
                <View style={styles.currencyOptionLeft}>
                  <Text style={styles.currencySymbol}>{c.symbol}</Text>
                  <View>
                    <Text style={styles.currencyCode}>{c.value}</Text>
                    <Text style={styles.currencyName}>{c.label}</Text>
                  </View>
                </View>
                {user?.currency === c.value && <Check size={20} color="#10B981" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#10B981',
    padding: 24,
    paddingTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarLargeText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  editNameButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    padding: 6,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  nameEditButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 8,
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  premiumBadgeText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    marginTop: 20,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  settingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  settingValue: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 66,
  },
  premiumCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  premiumCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  premiumIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumCardInfo: {
    flex: 1,
  },
  premiumCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#92400E',
  },
  premiumCardDesc: {
    fontSize: 13,
    color: '#B45309',
    marginTop: 3,
  },
  premiumButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  premiumButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  premiumActiveCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  premiumActiveInfo: {
    flex: 1,
  },
  premiumActiveTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  premiumActiveDesc: {
    fontSize: 13,
    color: '#B45309',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  logoutButtonText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
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
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  currencyOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    width: 28,
    textAlign: 'center',
  },
  currencyCode: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  currencyName: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
});
