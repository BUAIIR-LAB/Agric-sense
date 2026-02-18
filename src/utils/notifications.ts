import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Notification Handler ─────────────────────────────────────────────────────
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

// ─── Android Channels ─────────────────────────────────────────────────────────
const CHANNEL_IDS = {
    DAILY_TIPS: 'daily-tips',
    DIAGNOSIS:  'diagnosis',
    WEATHER:    'weather-alerts',
    GENERAL:    'general',
} as const;

async function ensureAndroidChannels() {
    if (Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync(CHANNEL_IDS.DAILY_TIPS, {
        name: 'Daily Farming Tips',
        description: 'AI-powered daily crop care recommendations',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#2E7D32',
        sound: 'default',
    });

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
    await ensureAndroidChannels();

    if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return undefined;
    }

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
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        return token;
    } catch (e) {
        console.warn('Error getting push token:', e);
        return undefined;
    }
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
    LAST_TIP_DATE:        'notification:last-tip-date',
    WEATHER_ALERT_PREFIX: 'notification:weather-alert:',
} as const;

// ─── Daily Tip Notification ───────────────────────────────────────────────────
/**
 * Schedules a farming tip notification for 8:00 AM the following morning.
 * Deduplicates: only one tip notification is scheduled per calendar day.
 */
export async function scheduleDailyTipNotification(title: string, body: string) {
    try {
        // Deduplicate – skip if already scheduled today
        const today = new Date().toDateString();
        const lastSentDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_TIP_DATE);
        if (lastSentDate === today) return;

        // Cancel any stale daily-tip notifications
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        const stale = scheduled.filter(n => n.content.data?.type === 'daily_tip');
        await Promise.all(
            stale.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
        );

        // Schedule for 8:00 AM tomorrow
        const target = new Date();
        target.setDate(target.getDate() + 1);
        target.setHours(8, 0, 0, 0);

        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data: { type: 'daily_tip' },
                ...(Platform.OS === 'android' && { channelId: CHANNEL_IDS.DAILY_TIPS }),
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: target,
            },
        });

        await AsyncStorage.setItem(STORAGE_KEYS.LAST_TIP_DATE, today);
    } catch (e) {
        console.warn('Failed to schedule daily tip notification:', e);
    }
}

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
    try {
        const pct = Math.round(confidence);
        await Notifications.scheduleNotificationAsync({
            content: {
                title: isHealthy ? '✅ Crop Looks Healthy' : '⚠️ Issue Detected',
                body: isHealthy
                    ? `No disease found (${pct}% confidence). Your crop is doing well!`
                    : `${cropIssue} detected at ${pct}% confidence. Tap for treatment advice.`,
                data: { type: 'diagnosis_complete', cropIssue, confidence, isHealthy },
                ...(Platform.OS === 'android' && { channelId: CHANNEL_IDS.DIAGNOSIS }),
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
    const lower = condition.toLowerCase();
    const isStorm     = lower.includes('storm') || lower.includes('lightning');
    const isHeavyRain = lower.includes('pouring') || lower.includes('heavy');
    const isHot       = temperatureCelsius > 36;
    const isCold      = temperatureCelsius < 5;

    if (!isStorm && !isHeavyRain && !isHot && !isCold) return;

    try {
        // Deduplicate per calendar day
        const dayKey = STORAGE_KEYS.WEATHER_ALERT_PREFIX + new Date().toDateString();
        const alreadySent = await AsyncStorage.getItem(dayKey);
        if (alreadySent) return;

        let body = `Current: ${condition}, ${Math.round(temperatureCelsius)}°C. `;
        if (isStorm)      body += 'Secure crops and equipment before the storm arrives.';
        else if (isHeavyRain) body += 'Heavy rain incoming – check field drainage.';
        else if (isHot)   body += 'High heat stress risk. Irrigate in early morning or evening.';
        else if (isCold)  body += 'Frost risk overnight – cover cold-sensitive plants.';

        await Notifications.scheduleNotificationAsync({
            content: {
                title: '🌦️ Weather Advisory for Your Crops',
                body,
                data: { type: 'weather_alert', condition, temperature: temperatureCelsius },
                ...(Platform.OS === 'android' && { channelId: CHANNEL_IDS.WEATHER }),
            },
            trigger: null, // Immediate
        });

        await AsyncStorage.setItem(dayKey, 'true');
    } catch (e) {
        console.warn('Failed to send weather alert notification:', e);
    }
}
