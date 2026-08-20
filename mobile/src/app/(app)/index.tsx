import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, type DashboardSummary } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function HomeScreen() {
  const { selectedTenantId, selectedRole, tenants } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const canViewDashboard = selectedRole === 'owner' || selectedRole === 'accountant';
  const tenantName = tenants.find((m) => m.tenant.id === selectedTenantId)?.tenant.name;

  const load = useCallback(async () => {
    if (!selectedTenantId || !canViewDashboard) {
      setLoading(false);
      return;
    }
    try {
      setSummary(await api.dashboard(selectedTenantId));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTenantId, canViewDashboard]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!selectedTenantId) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="subtitle">No tenant yet</ThemedText>
        <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', marginTop: Spacing.two }}>
          Ask an owner to invite you, or create a restaurant from the web dashboard.
        </ThemedText>
      </ThemedView>
    );
  }

  // Staff: entry-only home per ux-restoledger.md — no P&L, just a fast path to logging a sale.
  if (!canViewDashboard) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="subtitle">{tenantName}</ThemedText>
        <ThemedText themeColor="textSecondary" style={{ marginTop: Spacing.one, marginBottom: Spacing.four }}>
          Ready to log today&apos;s sales?
        </ThemedText>
        <Pressable
          style={[styles.cta, { backgroundColor: Brand.primary }]}
          onPress={() => router.push('/entry')}
        >
          <ThemedText type="smallBold" style={{ color: '#fff' }}>
            Quick Entry
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      <ThemedText type="subtitle">{tenantName}</ThemedText>
      {summary && (
        <View style={{ gap: Spacing.three, marginTop: Spacing.three }}>
          <SnapshotCard label="Today" summary={summary.today} theme={theme} />
          <SnapshotCard label="This week" summary={summary.week} theme={theme} />
          <SnapshotCard label="This month" summary={summary.month} theme={theme} />
        </View>
      )}
    </ScrollView>
  );
}

function SnapshotCard({
  label,
  summary,
  theme,
}: {
  label: string;
  summary: DashboardSummary['today'];
  theme: ReturnType<typeof useTheme>;
}) {
  const negative = summary.cashPosition.startsWith('-');
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText themeColor="textSecondary" type="small">
        {label}
      </ThemedText>
      <Row label="Revenue" value={`${summary.revenue} MAD`} color={Brand.primary} />
      <Row label="Expenses" value={`${summary.expenses} MAD`} color={Brand.error} />
      <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
      <Row
        label="Cash position"
        value={`${summary.cashPosition} MAD`}
        color={negative ? Brand.error : Brand.primary}
        bold
      />
    </View>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <ThemedText type={bold ? 'smallBold' : 'small'}>{label}</ThemedText>
      <ThemedText type={bold ? 'smallBold' : 'small'} style={{ color }}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  scrollContent: { padding: Spacing.three },
  cta: { borderRadius: 8, paddingVertical: Spacing.three, paddingHorizontal: Spacing.five },
  card: { borderRadius: 12, padding: Spacing.three, gap: Spacing.one },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  divider: { height: 1, marginVertical: Spacing.one },
});
