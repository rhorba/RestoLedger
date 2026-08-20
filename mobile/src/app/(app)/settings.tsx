import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';

export default function SettingsScreen() {
  const { tenants, selectedTenantId, selectedRole, selectTenant, logout } = useAuth();
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        RESTAURANTS
      </ThemedText>
      <View style={{ gap: Spacing.one, marginTop: Spacing.one, marginBottom: Spacing.four }}>
        {tenants.map((m) => {
          const active = m.tenant.id === selectedTenantId;
          return (
            <Pressable
              key={m.tenant.id}
              style={[
                styles.tenantRow,
                { backgroundColor: active ? theme.backgroundSelected : theme.backgroundElement },
              ]}
              onPress={() => selectTenant(m.tenant.id)}
            >
              <ThemedText type={active ? 'smallBold' : 'small'}>{m.tenant.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {m.role}
              </ThemedText>
            </Pressable>
          );
        })}
        {tenants.length === 0 && (
          <ThemedText themeColor="textSecondary" type="small">
            No restaurants yet — ask an owner to invite you.
          </ThemedText>
        )}
      </View>

      {selectedRole && (
        <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.four }}>
          Signed in as {selectedRole}
        </ThemedText>
      )}

      <Pressable style={[styles.logout, { borderColor: Brand.error }]} onPress={() => logout()}>
        <ThemedText type="smallBold" style={{ color: Brand.error }}>
          Log out
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.three },
  tenantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: Spacing.three,
  },
  logout: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
