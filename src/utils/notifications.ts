import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * expo-notifications can crash Expo Go on Android at module evaluation time
 * if it's imported at the top level. We use lazy loading and guards to prevent this.
 */
const isExpoGo = Constants.executionEnvironment === 'storeClient';
const isAndroid = Platform.OS === 'android';
const isRestricted = isAndroid && isExpoGo;

function getNotifications() {
    if (isRestricted) return null;
    try {
        return require('expo-notifications');
    } catch {
        return null;
    }
}

// ─── Notification Handler ─────────────────────────────────────────────────────

/**
 * Initializes the notification handler.
 * Called early in the app lifecycle (RootLayout).
 */
export function initNotifications() {
    if (isRestricted) return;

    const Notifications = getNotifications();
    if (!Notifications) return;

    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
}

// ─── Android Channels ─────────────────────────────────────────────────────────

const CHANNEL_IDS = {
    DIAGNOSIS: 'diagnosis',
    WEATHER: 'weather-alerts',
    GENERAL: 'general',
} as const;

async function ensureAndroidChannels() {
    if (!isAndroid || isRestricted) return;

    const Notifications = getNotifications();
    if (!Notifications) return;

    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.DIAGNOSIS, {
        name: 'Diagnosis Results',
        description: 'Crop diagnosis completion alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 100, 300],
        lightColor: '#2E7D32',
        sound: 'default',
    });

    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.WEATHER, {
        name: 'Weather Alerts',
        description: 'Important weather conditions for your crops',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6F00',
        sound: 'default',
    });

    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.GENERAL, {
        name: 'General',
        description: 'General AgriSense notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2E7D32',
    });
}

// ─── Push Token Registration ──────────────────────────────────────────────────

/**
 * Registers the device for push notifications and sets up Android channels.
 * Should be called once on app startup.
 */
export async function registerForPushNotificationsAsync() {
    if (isRestricted) {
        console.info('Push notifications are not supported in Expo Go on Android.');
        return undefined;
    }

    initNotifications();
    await ensureAndroidChannels();

    if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return undefined;
    }

    const Notifications = getNotifications();
    if (!Notifications) return undefined;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.warn('Notification permission not granted');
        return undefined;
    }

    try {
        const projectId =
            Constants?.expoConfig?.extra?.eas?.projectId ??
            Constants?.easConfig?.projectId;

        if (!projectId) {
            console.warn('Project ID not found in Constants. Ensure EAS project is configured.');
            return undefined;
        }

        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        return token;
    } catch (e) {
        console.warn('Error getting push token:', e);
        return undefined;
    }
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
    WEATHER_ALERT_PREFIX: 'notification:weather-alert:',
} as const;


// ─── Diagnosis Complete Notification ─────────────────────────────────────────

/**
 * Fires an immediate notification when a crop diagnosis finishes.
 * Shows a healthy or issue-detected message with confidence percentage.
 */
export async function scheduleDiagnosisCompleteNotification(
    cropIssue: string,
    confidence: number,
    isHealthy: boolean,
) {
    if (isRestricted) return;

    try {
        const Notifications = getNotifications();
        if (!Notifications) return;

        const pct = Math.round(confidence);
        await Notifications.scheduleNotificationAsync({
            content: {
                title: isHealthy ? '✅ Crop Looks Healthy' : '⚠️ Issue Detected',
                body: isHealthy
                    ? `No disease found (${pct}% confidence). Your crop is doing well!`
                    : `${cropIssue} detected at ${pct}% confidence. Tap for treatment advice.`,
                data: { type: 'diagnosis_complete', cropIssue, confidence, isHealthy },
                ...(isAndroid && { channelId: CHANNEL_IDS.DIAGNOSIS }),
            },
            trigger: null, // Immediate – user is waiting for result
        });
    } catch (e) {
        console.warn('Failed to send diagnosis notification:', e);
    }
}

// ─── Weather Alert Notification ───────────────────────────────────────────────

/**
 * Fires a weather advisory when conditions may impact crops.
 * Triggers on storms, heavy rain, high heat (>36 °C), or frost (<5 °C).
 * Deduplicates: only one alert per calendar day.
 */
export async function scheduleWeatherAlertNotification(
    condition: string,
    temperatureCelsius: number,
) {
    if (isRestricted) return;

    const lower = condition.toLowerCase();
    const isStorm = lower.includes('storm') || lower.includes('lightning');
    const isHeavyRain = lower.includes('pouring') || lower.includes('heavy');
    const isHot = temperatureCelsius > 36;
    const isCold = temperatureCelsius < 5;

    if (!isStorm && !isHeavyRain && !isHot && !isCold) return;

    try {
        // Deduplicate per calendar day
        const dayKey = STORAGE_KEYS.WEATHER_ALERT_PREFIX + new Date().toDateString();
        const alreadySent = await AsyncStorage.getItem(dayKey);
        if (alreadySent) return;

        const Notifications = getNotifications();
        if (!Notifications) return;

        let body = `Current: ${condition}, ${Math.round(temperatureCelsius)}°C. `;
        if (isStorm) body += 'Secure crops and equipment before the storm arrives.';
        else if (isHeavyRain) body += 'Heavy rain incoming – check field drainage.';
        else if (isHot) body += 'High heat stress risk. Irrigate in early morning or evening.';
        else if (isCold) body += 'Frost risk overnight – cover cold-sensitive plants.';

        await Notifications.scheduleNotificationAsync({
            content: {
                title: '🌦️ Weather Advisory for Your Crops',
                body,
                data: { type: 'weather_alert', condition, temperature: temperatureCelsius },
                ...(isAndroid && { channelId: CHANNEL_IDS.WEATHER }),
            },
            trigger: null, // Immediate
        });

        await AsyncStorage.setItem(dayKey, 'true');
    } catch (e) {
        console.warn('Failed to send weather alert notification:', e);
    }
}
