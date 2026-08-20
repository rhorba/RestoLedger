import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { enqueueEntry, subscribeToQueue, trySync, type PendingEntry } from '@/lib/offline-queue';

export default function EntryScreen() {
  const { selectedTenantId } = useAuth();
  const theme = useTheme();
  const [entryType, setEntryType] = useState<'revenue' | 'expense'>('revenue');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState<PendingEntry[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToQueue(setPending);
    trySync();
    return unsubscribe;
  }, []);

  const myPending = pending.filter((e) => e.tenantId === selectedTenantId);
  const amountValid = /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0;

  async function onSave() {
    if (!selectedTenantId || !amountValid) return;
    await enqueueEntry({
      tenantId: selectedTenantId,
      entryType,
      amount: Number(amount),
      description: description || undefined,
    });
    setAmount('');
    setDescription('');
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  }

  if (!selectedTenantId) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">No tenant selected.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.toggleRow}>
        <ToggleButton
          label="Revenue"
          active={entryType === 'revenue'}
          onPress={() => setEntryType('revenue')}
          theme={theme}
        />
        <ToggleButton
          label="Expense"
          active={entryType === 'expense'}
          onPress={() => setEntryType('expense')}
          theme={theme}
        />
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Amount (MAD)
      </ThemedText>
      <TextInput
        style={[styles.amountInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
        placeholder="0.00"
        placeholderTextColor={theme.textSecondary}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
        Note (optional)
      </ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        placeholder="e.g. Lunch service"
        placeholderTextColor={theme.textSecondary}
        value={description}
        onChangeText={setDescription}
      />

      <Pressable
        style={[
          styles.saveButton,
          { backgroundColor: Brand.primary, opacity: amountValid ? 1 : 0.5 },
        ]}
        disabled={!amountValid}
        onPress={onSave}
      >
        <ThemedText type="smallBold" style={{ color: '#fff' }}>
          {justSaved ? 'Saved ✓' : 'Save Entry'}
        </ThemedText>
      </Pressable>

      {myPending.length > 0 && (
        <View style={[styles.pendingBanner, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small">
            {myPending.length} {myPending.length === 1 ? 'entry' : 'entries'} pending sync
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

function ToggleButton({
  label,
  active,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      style={[
        styles.toggleButton,
        { backgroundColor: active ? Brand.primary : theme.backgroundElement },
      ]}
      onPress={onPress}
    >
      <ThemedText type="smallBold" style={{ color: active ? '#fff' : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.three },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  toggleButton: { flex: 1, borderRadius: 8, paddingVertical: Spacing.three, alignItems: 'center' },
  amountInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 28,
    marginTop: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    marginTop: Spacing.one,
  },
  saveButton: {
    marginTop: Spacing.four,
    borderRadius: 8,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  pendingBanner: {
    marginTop: Spacing.three,
    borderRadius: 8,
    padding: Spacing.two,
    alignItems: 'center',
  },
});
