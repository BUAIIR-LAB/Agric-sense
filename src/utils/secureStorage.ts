import * as SecureStore from 'expo-secure-store';

const SENSITIVE_KEYS = new Set(['auth_token']);

/**
 * Secure storage for sensitive data. Auth tokens never fall back to AsyncStorage.
 */
export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      if (SENSITIVE_KEYS.has(key)) {
        console.error('SecureStore failed for sensitive key — refusing AsyncStorage fallback:', error);
        throw error;
      }
      console.warn('SecureStore not available:', error);
      throw error;
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      if (SENSITIVE_KEYS.has(key)) {
        console.error('SecureStore read failed for sensitive key:', error);
        return null;
      }
      console.warn('SecureStore not available:', error);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      if (SENSITIVE_KEYS.has(key)) {
        console.error('SecureStore delete failed for sensitive key:', error);
      }
    }
  },
};
