import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';

export default function AppLayout() {
  const { ready, isAuthenticated, selectedRole } = useAuth();
  const theme = useTheme();

  if (!ready) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }
  if (!isAuthenticated) return <Redirect href="/login" />;

  // Staff don't see reports/ledger on mobile — entry-only per ux-restoledger.md personas
  // ("Youssef ... doesn't need or want to see reports").
  const canViewLedger = selectedRole === 'owner' || selectedRole === 'accountant';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Brand.primary,
        tabBarStyle: { backgroundColor: theme.background },
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="entry"
        options={{
          title: 'Quick Entry',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          title: 'Ledger',
          href: canViewLedger ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="list" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
