import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, type LedgerEntry } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function LedgerScreen() {
  const { selectedTenantId } = useAuth();
  const theme = useTheme();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!selectedTenantId) return;
      setLoading(true);
      api
        .ledgerEntries(selectedTenantId)
        .then(setEntries)
        .finally(() => setLoading(false));
    }, [selectedTenantId]),
  );

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (entries.length === 0) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">No entries yet.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}
      data={entries}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const negative = item.amount.startsWith('-');
        return (
          <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">
                {item.entryType}
                {item.reversalOfId ? ' (reversal)' : ''}
              </ThemedText>
              {item.description ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {item.description}
                </ThemedText>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary">
                {new Date(item.occurredAt).toLocaleDateString()}
              </ThemedText>
            </View>
            <ThemedText type="smallBold" style={{ color: negative ? Brand.error : theme.text }}>
              {item.amount} {item.currency}
            </ThemedText>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: Spacing.three, gap: Spacing.two },
});
