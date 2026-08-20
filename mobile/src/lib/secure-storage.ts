import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// expo-secure-store has no web implementation (it wraps iOS Keychain / Android Keystore,
// neither of which exist in a browser). iOS/Android are the only shipped targets (PRD,
// architecture-restoledger.md) — this fallback exists only so the app can be visually QA'd
// via `expo start --web` in a browser during development. Real devices always use
// SecureStore; only the web dev-preview target uses AsyncStorage (unencrypted, fine for
// throwaway local test accounts, never a channel for real user data).
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    return Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};
