import { useState } from 'react';
import { Redirect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function LoginScreen() {
  const { ready, isAuthenticated, login, register } = useAuth();
  const theme = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (ready && isAuthenticated) return <Redirect href="/(app)" />;

  async function onSubmit() {
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, fullName);
      }
    } catch (err) {
      Alert.alert('Could not sign in', err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', default: undefined })}
    >
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          RestoLedger
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          Financial ledger for restaurant accounting
        </ThemedText>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, mode === 'login' && { backgroundColor: theme.backgroundSelected }]}
            onPress={() => setMode('login')}
          >
            <ThemedText type="smallBold">Log in</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.tab, mode === 'register' && { backgroundColor: theme.backgroundSelected }]}
            onPress={() => setMode('register')}
          >
            <ThemedText type="smallBold">Register</ThemedText>
          </Pressable>
        </View>

        {mode === 'register' && (
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            placeholder="Full name"
            placeholderTextColor={theme.textSecondary}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
        )}
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={[styles.submit, { backgroundColor: Brand.primary, opacity: submitting ? 0.6 : 1 }]}
          onPress={onSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText type="smallBold" style={{ color: '#fff' }}>
              {mode === 'login' ? 'Log in' : 'Create account'}
            </ThemedText>
          )}
        </Pressable>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: { fontSize: 32, lineHeight: 38 },
  subtitle: { marginBottom: Spacing.three },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  submit: {
    marginTop: Spacing.two,
    borderRadius: 8,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
