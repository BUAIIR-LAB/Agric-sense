import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'auth_token';

/**
 * Secure storage utility for sensitive data like auth tokens
 * Falls back to AsyncStorage if SecureStore is not available
 */
export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      // Fallback to AsyncStorage if SecureStore fails
      console.warn('SecureStore not available, using AsyncStorage:', error);
      await AsyncStorage.setItem(key, value);
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      // Fallback to AsyncStorage if SecureStore fails
      console.warn('SecureStore not available, using AsyncStorage:', error);
      return await AsyncStorage.getItem(key);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      // Fallback to AsyncStorage if SecureStore fails
      console.warn('SecureStore not available, using AsyncStorage:', error);
      await AsyncStorage.removeItem(key);
    }
  },
};

