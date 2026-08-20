import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/lib/auth-context';

export default function RootIndex() {
  const { ready, isAuthenticated } = useAuth();

  if (!ready) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return <Redirect href={isAuthenticated ? '/(app)' : '/login'} />;
}
