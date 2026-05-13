import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Calendar, ChevronDown, X, Check } from 'lucide-react-native';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { api } from '../../api/client';
import { GroupsStackParamList } from '../../navigation';
import { useAuthStore } from '../../store/useAuthStore';

type Props = NativeStackScreenProps<GroupsStackParamList, 'AddExpense'>;

const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF'];

const CATEGORIES = [
  { value: 'cibo', label: 'Cibo', emoji: '🍕' },
  { value: 'trasporti', label: 'Trasporti', emoji: '🚗' },
  { value: 'alloggio', label: 'Alloggio', emoji: '🏠' },
  { value: 'intrattenimento', label: 'Intrattenimento', emoji: '🎭' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { value: 'altro', label: 'Altro', emoji: '📌' },
];

const SPLIT_TYPES = [
  { value: 'equal', label: 'Equale' },
  { value: 'exact', label: 'Importi' },
  { value: 'percentage', label: 'Percentuali' },
  { value: 'shares', label: 'Quote' },
];

interface SplitEntry {
  user_id: number;
  name: string;
  value: string;
}

export default function AddExpenseScreen({ navigation, route }: Props) {
  const { groupId, members } = route.params;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(user?.currency || 'EUR');
  const [paidBy, setPaidBy] = useState(user?.id || 0);
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage' | 'shares'>('equal');
  const [category, setCategory] = useState('altro');
  const [date, setDate] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [splits, setSplits] = useState<SplitEntry[]>([]);

  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showPaidByPicker, setShowPaidByPicker] = useState(false);

  const [errors, setErrors] = useState<{ description?: string; amount?: string; splits?: string }>({});

  useEffect(() => {
    if (members.length > 0) {
      setSplits(members.map((m) => ({ user_id: m.id, name: m.name, value: '' })));
    }
  }, []);

  const createExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post(`/groups/${groupId}/expenses`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigation.goBack();
    },
    onError: (error: any) => {
      Alert.alert('Errore', error.response?.data?.error || 'Errore nel salvataggio della spesa');
    },
  });

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!description.trim()) newErrors.description = 'Descrizione richiesta';
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) newErrors.amount = 'Importo non valido';
    if (splitType !== 'equal') {
      const total = splits.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
      if (splitType === 'percentage') {
        if (Math.abs(total - 100) > 0.01) newErrors.splits = `La somma delle percentuali deve essere 100% (attuale: ${total.toFixed(1)}%)`;
      } else if (splitType === 'exact') {
        if (Math.abs(total - amountNum) > 0.01) newErrors.splits = `La somma deve essere ${amountNum.toFixed(2)} (attuale: ${total.toFixed(2)})`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const amountNum = parseFloat(amount);
    let splitsData;
    if (splitType === 'equal') {
      const equalAmount = amountNum / members.length;
      splitsData = members.map((m) => ({ user_id: m.id, amount: parseFloat(equalAmount.toFixed(2)) }));
    } else if (splitType === 'percentage') {
      splitsData = splits.map((s) => ({
        user_id: s.user_id,
        amount: parseFloat(((parseFloat(s.value) / 100) * amountNum).toFixed(2)),
      }));
    } else if (splitType === 'exact') {
      splitsData = splits.map((s) => ({
        user_id: s.user_id,
        amount: parseFloat(s.value) || 0,
      }));
    } else {
      const totalShares = splits.reduce((sum, s) => sum + (parseFloat(s.value) || 1), 0);
      splitsData = splits.map((s) => ({
        user_id: s.user_id,
        amount: parseFloat((((parseFloat(s.value) || 1) / totalShares) * amountNum).toFixed(2)),
      }));
    }
    createExpenseMutation.mutate({
      description: description.trim(),
      amount: amountNum,
      currency,
      paid_by: paidBy,
      split_type: splitType,
      category,
      date: format(date, 'yyyy-MM-dd'),
      notes: notes.trim() || undefined,
      splits: splitsData,
    });
  };

  const handlePickReceipt = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permesso negato', 'Servono i permessi per accedere alla galleria');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  const updateSplitValue = (userId: number, value: string) => {
    setSplits((prev) => prev.map((s) => (s.user_id === userId ? { ...s, value } : s)));
    if (errors.splits) setErrors((e) => ({ ...e, splits: undefined }));
  };

  const getSplitSuffix = () => {
    if (splitType === 'percentage') return '%';
    if (splitType === 'shares') return 'q';
    return currency === 'EUR' ? '€' : currency;
  };

  const paidByMember = members.find((m) => m.id === paidBy);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Descrizione *</Text>
          <TextInput
            style={[styles.input, errors.description ? styles.inputError : null]}
            placeholder="Es. Cena al ristorante"
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              if (errors.description) setErrors((e) => ({ ...e, description: undefined }));
            }}
            maxLength={100}
          />
          {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
        </View>

        {/* Amount + Currency */}
        <View style={styles.amountRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Importo *</Text>
            <TextInput
              style={[styles.input, errors.amount ? styles.inputError : null]}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              value={amount}
              onChangeText={(t) => {
                setAmount(t);
                if (errors.amount) setErrors((e) => ({ ...e, amount: undefined }));
              }}
              keyboardType="decimal-pad"
            />
            {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}
          </View>
          <View style={styles.currencyContainer}>
            <Text style={styles.label}>Valuta</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowCurrencyPicker(true)}
            >
              <Text style={styles.pickerButtonText}>{currency}</Text>
              <ChevronDown size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Paid By */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Pagato da</Text>
          <TouchableOpacity
            style={styles.pickerButtonFull}
            onPress={() => setShowPaidByPicker(true)}
          >
            <Text style={styles.pickerButtonFullText}>
              {paidByMember ? paidByMember.name : 'Seleziona chi ha pagato'}
            </Text>
            <ChevronDown size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Category */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.categoryChip, category === cat.value ? styles.categoryChipSelected : null]}
                  onPress={() => setCategory(cat.value)}
                >
                  <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                  <Text
                    style={[
                      styles.categoryLabel,
                      category === cat.value ? styles.categoryLabelSelected : null,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Split Type */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Come dividere</Text>
          <View style={styles.splitTypeRow}>
            {SPLIT_TYPES.map((st) => (
              <TouchableOpacity
                key={st.value}
                style={[styles.splitTypeChip, splitType === st.value ? styles.splitTypeChipSelected : null]}
                onPress={() => setSplitType(st.value as any)}
              >
                <Text
                  style={[
                    styles.splitTypeLabel,
                    splitType === st.value ? styles.splitTypeLabelSelected : null,
                  ]}
                >
                  {st.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Split Inputs (non-equal) */}
        {splitType !== 'equal' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {splitType === 'percentage'
                ? 'Percentuali per membro'
                : splitType === 'exact'
                ? 'Importi per membro'
                : 'Quote per membro'}
            </Text>
            {errors.splits ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errors.splits}</Text>
              </View>
            ) : null}
            {splits.map((s) => (
              <View key={s.user_id} style={styles.splitRow}>
                <View style={styles.splitMemberInfo}>
                  <View style={styles.splitAvatar}>
                    <Text style={styles.splitAvatarText}>{s.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.splitMemberName}>{s.name}</Text>
                </View>
                <View style={styles.splitInputContainer}>
                  <TextInput
                    style={styles.splitInput}
                    value={s.value}
                    onChangeText={(v) => updateSplitValue(s.user_id, v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text style={styles.splitSuffix}>{getSplitSuffix()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Date */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Data</Text>
          <View style={styles.dateDisplay}>
            <Calendar size={18} color="#6B7280" />
            <Text style={styles.dateText}>{format(date, 'd MMMM yyyy', { locale: it })}</Text>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Note (opzionale)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Note aggiuntive..."
            placeholderTextColor="#9CA3AF"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            maxLength={300}
          />
        </View>

        {/* Receipt */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ricevuta</Text>
          <TouchableOpacity
            style={styles.receiptButton}
            onPress={handlePickReceipt}
          >
            <Camera size={20} color="#6B7280" />
            <Text style={styles.receiptButtonText}>
              {receiptUri ? 'Ricevuta allegata ✓' : 'Allega foto ricevuta'}
            </Text>
            {receiptUri ? (
              <TouchableOpacity
                onPress={() => setReceiptUri(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={16} color="#EF4444" />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, createExpenseMutation.isPending ? styles.saveButtonDisabled : null]}
          onPress={handleSave}
          disabled={createExpenseMutation.isPending}
          activeOpacity={0.8}
        >
          {createExpenseMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Salva spesa</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Currency Picker Modal */}
      <Modal
        visible={showCurrencyPicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerModalOverlay}
          onPress={() => setShowCurrencyPicker(false)}
          activeOpacity={1}
        >
          <View style={styles.pickerModalContent}>
            <Text style={styles.pickerModalTitle}>Seleziona valuta</Text>
            {CURRENCIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={styles.pickerOption}
                onPress={() => {
                  setCurrency(c);
                  setShowCurrencyPicker(false);
                }}
              >
                <Text style={styles.pickerOptionText}>{c}</Text>
                {currency === c && <Check size={18} color="#10B981" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Paid By Picker Modal */}
      <Modal
        visible={showPaidByPicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPaidByPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerModalOverlay}
          onPress={() => setShowPaidByPicker(false)}
          activeOpacity={1}
        >
          <View style={styles.pickerModalContent}>
            <Text style={styles.pickerModalTitle}>Chi ha pagato?</Text>
            {members.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.pickerOption}
                onPress={() => {
                  setPaidBy(m.id);
                  setShowPaidByPicker(false);
                }}
              >
                <View style={styles.pickerMemberRow}>
                  <View style={styles.pickerAvatar}>
                    <Text style={styles.pickerAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.pickerOptionText}>
                    {m.name} {m.id === user?.id ? '(tu)' : ''}
                  </Text>
                </View>
                {paidBy === m.id && <Check size={18} color="#10B981" />}
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
    padding: 16,
    paddingBottom: 40,
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
    backgroundColor: '#FFFFFF',
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
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 13,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  currencyContainer: {
    width: 90,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  pickerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  pickerButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
  },
  pickerButtonFullText: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  categoryChipSelected: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  categoryLabelSelected: {
    color: '#059669',
  },
  splitTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  splitTypeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  splitTypeChipSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  splitTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  splitTypeLabelSelected: {
    color: '#FFFFFF',
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  splitMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  splitAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  splitMemberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  splitInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  splitInput: {
    width: 70,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    textAlign: 'right',
  },
  splitSuffix: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 13,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    fontWeight: '600',
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dateText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderStyle: 'dashed',
  },
  receiptButtonText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  pickerModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  pickerMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
