import { Platform } from 'react-native';

/** Default production API — override via EXPO_PUBLIC_API_URL in EAS or .env */
const DEFAULT_API_URL = 'http://147.93.116.6:8090';

/** Default chat API — override via EXPO_PUBLIC_CHAT_API_URL */
const DEFAULT_CHAT_API_URL = 'https://wanly-subtemperate-kaylene.ngrok-free.dev';

const useProductionInDev = process.env.EXPO_PUBLIC_USE_PRODUCTION !== 'false';
const physicalDeviceIp = process.env.EXPO_PUBLIC_PHYSICAL_DEVICE_IP ?? '10.10.162.85';
const usePhysicalDevice = process.env.EXPO_PUBLIC_USE_PHYSICAL_DEVICE === 'true';

function getDevApiUrl(): string {
  if (useProductionInDev) {
    return process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;
  }

  if (usePhysicalDevice) {
    return `http://${physicalDeviceIp}:8000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  return 'http://localhost:8000';
}

export const env = {
  apiUrl: __DEV__
    ? getDevApiUrl()
    : (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL),

  chatApiUrl: process.env.EXPO_PUBLIC_CHAT_API_URL ?? DEFAULT_CHAT_API_URL,

  useProductionInDev,
  usePhysicalDevice,
  physicalDeviceIp,
} as const;
