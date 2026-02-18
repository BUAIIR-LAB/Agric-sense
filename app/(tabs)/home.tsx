import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatTile } from '@/components/ui/StatTile';
import { useAppContext } from '@/context/AppContext';
import { MiniLineChart } from '@/components/charts/MiniLineChart';
import { palette } from '@/theme/colors';
import { radius, spacing, getResponsiveSpacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { elevation } from '@/theme/elevation';
import { useResponsiveDimensions, responsiveFontSize, moderateScale } from '@/utils/responsive';
import * as Haptics from 'expo-haptics';
import { insightService, type DailyInsight } from '@/services/insightService';
import {
  scheduleDailyTipNotification,
  scheduleWeatherAlertNotification,
} from '@/utils/notifications';
const appFont = Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }) ?? 'System';

type HourlyForecast = {
  time: string;
  temperature: number;
  conditionLabel: string;
  conditionIcon: keyof typeof MaterialCommunityIcons.glyphMap;
};

type DailyForecast = {
  date: string;
  high: number;
  low: number;
  conditionLabel: string;
  conditionIcon: keyof typeof MaterialCommunityIcons.glyphMap;
};

type WeatherSnapshot = {
  // Current weather
  currentTemperature: number;
  currentHumidity: number;
  currentWindspeed: number;
  currentConditionLabel: string;
  currentConditionIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  locationLabel: string;
  // Today's forecast
  todayHigh?: number;
  todayLow?: number;
  todayConditionLabel?: string;
  todayConditionIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  // Hourly forecast (next 5 hours)
  hourlyForecast: HourlyForecast[];
  // Tomorrow's forecast
  tomorrowHigh?: number;
  tomorrowLow?: number;
  tomorrowConditionLabel?: string;
  tomorrowConditionIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  // 5-day forecast
  fiveDayForecast: DailyForecast[];
  // Metadata
  cachedAt?: string;
  isCached?: boolean;
};

const WEATHER_STORAGE_KEY = 'weather-data-cache';
const CACHE_EXPIRY_HOURS = 2; // Cache expires after 2 hours

export default function HomeScreen() {
  const router = useRouter();
  const { state } = useAppContext();

  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyInsight, setDailyInsight] = useState<DailyInsight | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const { width: screenWidth, height: screenHeight, isSmall, deviceType } = useResponsiveDimensions();
  const responsiveSpacing = getResponsiveSpacing();

  // Save weather data to cache
  // This function caches the complete weather snapshot including:
  // - Current weather (temperature, humidity, wind, condition, location)
  // - Today's forecast (high/low temperatures, condition)
  // - Next 5 hours forecast (hourly data array)
  // - Tomorrow's forecast (high/low temperatures, condition)
  // - 5-day forecast (daily data array)
  // Cache is automatically updated every time fresh data is fetched successfully
  const saveWeatherCache = async (data: WeatherSnapshot) => {
    try {
      const dataToCache = {
        ...data,
        cachedAt: new Date().toISOString(),
        isCached: false,
      };
      await AsyncStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(dataToCache));
      console.log('Weather data cached successfully');
    } catch (error) {
      console.warn('Failed to cache weather data', error);
    }
  };

  // Load cached weather data on mount (only if permission is granted)
  useEffect(() => {
    const loadCachedWeather = async () => {
      try {
        // Check permission first before loading cache
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          setHasLocationPermission(false);
          setIsWeatherLoading(false);
          return;
        }

        setHasLocationPermission(true);
        const cached = await AsyncStorage.getItem(WEATHER_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as WeatherSnapshot & { cachedAt: string };
          const cacheAge = new Date().getTime() - new Date(parsed.cachedAt).getTime();
          const cacheAgeHours = cacheAge / (1000 * 60 * 60);

          // Use cache if it's less than expiry time old
          if (cacheAgeHours < CACHE_EXPIRY_HOURS) {
            setWeather({ ...parsed, isCached: true });
            setIsWeatherLoading(false);
          }
        }
      } catch (error) {
        console.warn('Failed to load cached weather', error);
        setHasLocationPermission(false);
        setIsWeatherLoading(false);
      }
    };

    loadCachedWeather();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const interpretWeatherCode = (code: number): { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap } => {
      if ([0].includes(code)) {
        return { label: 'Sunny', icon: 'weather-sunny' };
      }
      if ([1, 2].includes(code)) {
        return { label: 'Partly cloudy', icon: 'weather-partly-cloudy' };
      }
      if ([3].includes(code)) {
        return { label: 'Cloudy', icon: 'weather-cloudy' };
      }
      if ([45, 48].includes(code)) {
        return { label: 'Foggy', icon: 'weather-fog' };
      }
      if ([51, 53, 55].includes(code)) {
        return { label: 'Light rain', icon: 'weather-rainy' };
      }
      if ([56, 57].includes(code)) {
        return { label: 'Light rain', icon: 'weather-rainy' };
      }
      if ([61, 63, 65].includes(code)) {
        return { label: 'Rainy', icon: 'weather-pouring' };
      }
      if ([66, 67].includes(code)) {
        return { label: 'Rainy', icon: 'weather-rainy' };
      }
      if ([71, 73, 75, 77].includes(code)) {
        return { label: 'Snowy', icon: 'weather-snowy' };
      }
      if ([80, 81, 82].includes(code)) {
        return { label: 'Rainy', icon: 'weather-rainy' };
      }
      if ([85, 86].includes(code)) {
        return { label: 'Snowy', icon: 'weather-snowy-heavy' };
      }
      if ([95, 96, 99].includes(code)) {
        return { label: 'Stormy', icon: 'weather-lightning' };
      }
      return { label: 'Cloudy', icon: 'weather-cloudy' };
    };

    const loadWeather = async () => {
      try {
        setIsWeatherLoading(true);
        setWeatherError(null);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          if (!isMounted) return;
          setHasLocationPermission(false);
          setWeatherError(null); // Don't show error, just hide the section
          setIsWeatherLoading(false);
          return;
        }

        // Permission granted
        setHasLocationPermission(true);

        // Get current position with error handling
        let position: Location.LocationObject;
        try {
          position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        } catch (locationError: unknown) {
          // Handle location unavailable errors gracefully
          if (locationError instanceof Error) {
            const errorMessage = locationError.message.toLowerCase();
            if (errorMessage.includes('location') || errorMessage.includes('unavailable')) {
              if (!isMounted) return;
              setHasLocationPermission(false);
              setWeatherError(null); // Don't show error, just hide the section
              setIsWeatherLoading(false);
              return;
            }
          }
          // Re-throw if it's not a location error
          throw locationError;
        }

        const { latitude, longitude } = position.coords;

        // Try to get location label with timeout handling
        let locationLabel = 'Your area';
        try {
          // Wrap geocoding in a timeout promise
          const geocodePromise = Location.reverseGeocodeAsync({ latitude, longitude });
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Geocoding timeout')), 3000)
          );

          const geocode = await Promise.race([geocodePromise, timeoutPromise]) as Location.LocationGeocodedAddress[];
          const place = geocode?.[0];
          if (place) {
            locationLabel = [place.city, place.country].filter(Boolean).join(', ') || 'Your area';
          }
        } catch (geocodeError) {
          // If geocoding fails or times out, use fallback label
          console.warn('⚠️ Geocoding failed or timed out, using fallback location label:', geocodeError);
          locationLabel = `Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`;
        }

        const requestUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=weathercode,temperature_2m,relativehumidity_2m&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;

        const response = await fetch(requestUrl);
        if (!response.ok) {
          throw new Error('Unable to fetch weather data');
        }
        const payload = await response.json();

        // Current weather
        const currentWeatherCode = payload.current_weather?.weathercode ?? 0;
        const { label: currentLabel, icon: currentIcon } = interpretWeatherCode(currentWeatherCode);

        const humidityIndex = payload.hourly?.time?.findIndex((timestamp: string) => timestamp === payload.current_weather?.time);
        const currentHumidity = humidityIndex != null && humidityIndex >= 0 ? payload.hourly.relativehumidity_2m?.[humidityIndex] : undefined;

        // Today's forecast (index 0)
        const todayWeatherCode = payload.daily?.weathercode?.[0] ?? 0;
        const { label: todayLabel, icon: todayIcon } = interpretWeatherCode(todayWeatherCode);

        // Tomorrow's forecast (index 1)
        const tomorrowWeatherCode = payload.daily?.weathercode?.[1] ?? 0;
        const { label: tomorrowLabel, icon: tomorrowIcon } = interpretWeatherCode(tomorrowWeatherCode);

        // Process hourly forecast (next 5 hours)
        const currentTime = payload.current_weather?.time;
        const hourlyTimes = payload.hourly?.time || [];
        const hourlyTemps = payload.hourly?.temperature_2m || [];
        const hourlyCodes = payload.hourly?.weathercode || [];

        const currentTimeIndex = hourlyTimes.findIndex((time: string) => time === currentTime);
        const next5Hours: HourlyForecast[] = [];

        for (let i = 1; i <= 5 && currentTimeIndex + i < hourlyTimes.length; i++) {
          const hourIndex = currentTimeIndex + i;
          const hourCode = hourlyCodes[hourIndex] ?? 0;
          const { label: hourLabel, icon: hourIcon } = interpretWeatherCode(hourCode);
          next5Hours.push({
            time: hourlyTimes[hourIndex],
            temperature: hourlyTemps[hourIndex] ?? 0,
            conditionLabel: hourLabel,
            conditionIcon: hourIcon,
          });
        }

        // Process 5-day forecast
        const fiveDayForecast: DailyForecast[] = [];
        for (let i = 0; i < 5 && i < (payload.daily?.time?.length ?? 0); i++) {
          const dayCode = payload.daily?.weathercode?.[i] ?? 0;
          const { label: dayLabel, icon: dayIcon } = interpretWeatherCode(dayCode);
          fiveDayForecast.push({
            date: payload.daily?.time?.[i] ?? '',
            high: payload.daily?.temperature_2m_max?.[i] ?? 0,
            low: payload.daily?.temperature_2m_min?.[i] ?? 0,
            conditionLabel: dayLabel,
            conditionIcon: dayIcon,
          });
        }

        const snapshot: WeatherSnapshot = {
          // Current weather
          currentTemperature: payload.current_weather?.temperature ?? 0,
          currentWindspeed: payload.current_weather?.windspeed ?? 0,
          currentHumidity: currentHumidity ?? payload.hourly?.relativehumidity_2m?.[0] ?? 0,
          currentConditionLabel: currentLabel,
          currentConditionIcon: currentIcon,
          locationLabel,
          // Today's forecast
          todayHigh: payload.daily?.temperature_2m_max?.[0],
          todayLow: payload.daily?.temperature_2m_min?.[0],
          todayConditionLabel: todayLabel,
          todayConditionIcon: todayIcon,
          // Hourly forecast
          hourlyForecast: next5Hours,
          // Tomorrow's forecast
          tomorrowHigh: payload.daily?.temperature_2m_max?.[1],
          tomorrowLow: payload.daily?.temperature_2m_min?.[1],
          tomorrowConditionLabel: tomorrowLabel,
          tomorrowConditionIcon: tomorrowIcon,
          // 5-day forecast
          fiveDayForecast,
        };

        if (!isMounted) return;
        setWeather(snapshot);
        // Save to cache
        await saveWeatherCache(snapshot);
        // Fire weather advisory for extreme conditions
        scheduleWeatherAlertNotification(
          snapshot.currentConditionLabel,
          snapshot.currentTemperature
        );
      } catch (error: unknown) {
        // Only log non-location errors to avoid stack traces for expected location issues
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          // Skip logging location unavailable errors as they're handled gracefully
          if (!errorMessage.includes('location') && !errorMessage.includes('unavailable')) {
            console.error('Weather fetch failed', error.message);
          }
        } else {
          console.error('Weather fetch failed', error);
        }

        if (!isMounted) return;

        // Check if it's a location error
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          if (errorMessage.includes('location') || errorMessage.includes('unavailable')) {
            setHasLocationPermission(false);
            setWeatherError(null); // Don't show error, just hide the section
            setIsWeatherLoading(false);
            return;
          }
        }

        // Try to load cached data if available
        try {
          const cached = await AsyncStorage.getItem(WEATHER_STORAGE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as WeatherSnapshot & { cachedAt: string };
            setWeather({ ...parsed, isCached: true });
            setWeatherError(null);
            setIsWeatherLoading(false);
            return;
          }
        } catch (cacheError) {
          console.warn('Failed to load cached weather', cacheError);
        }

        const errorMessage = error instanceof Error && error.message.includes('internet')
          ? 'No internet connection'
          : 'Unable to load weather';
        setWeatherError(errorMessage);
      } finally {
        if (isMounted) {
          setIsWeatherLoading(false);
        }
      }
    };

    loadWeather();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch AI Daily Insight when weather is available
  useEffect(() => {
    if (weather && state.profile && !dailyInsight && !isInsightLoading) {
      const fetchInsight = async () => {
        setIsInsightLoading(true);
        const insight = await insightService.getDailyInsight(
          weather,
          state.profile?.id || 'guest',
          state.profile?.preferredLanguage || 'English'
        );
        if (insight) {
          setDailyInsight(insight);
          // Trigger a notification for the new tip if it's not from today's cache?
          // For simplicity, we trigger it if it's the first fetch in this session
          await scheduleDailyTipNotification('Daily Farming Tip 🌾', insight.tip);
        }
        setIsInsightLoading(false);
      };
      fetchInsight();
    }
  }, [weather, state.profile]);



  // Refresh weather data
  const refreshWeather = async () => {
    setRefreshing(true);
    try {
      setIsWeatherLoading(true);
      setWeatherError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        setHasLocationPermission(false);
        setWeatherError(null); // Don't show error, just hide the section
        setIsWeatherLoading(false);
        setRefreshing(false);
        return;
      }

      // Permission granted
      setHasLocationPermission(true);

      // Get current position with error handling
      let position: Location.LocationObject;
      try {
        position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (locationError: unknown) {
        // Handle location unavailable errors gracefully
        if (locationError instanceof Error) {
          const errorMessage = locationError.message.toLowerCase();
          if (errorMessage.includes('location') || errorMessage.includes('unavailable')) {
            setHasLocationPermission(false);
            setWeatherError(null); // Don't show error, just hide the section
            setIsWeatherLoading(false);
            setRefreshing(false);
            return;
          }
        }
        // Re-throw if it's not a location error
        throw locationError;
      }

      const { latitude, longitude } = position.coords;

      // Try to get location label with timeout handling
      let locationLabel = 'Your area';
      try {
        // Wrap geocoding in a timeout promise
        const geocodePromise = Location.reverseGeocodeAsync({ latitude, longitude });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Geocoding timeout')), 3000)
        );

        const geocode = await Promise.race([geocodePromise, timeoutPromise]) as Location.LocationGeocodedAddress[];
        const place = geocode?.[0];
        if (place) {
          locationLabel = [place.city, place.country].filter(Boolean).join(', ') || 'Your area';
        }
      } catch (geocodeError) {
        // If geocoding fails or times out, use fallback label
        console.warn('⚠️ Geocoding failed or timed out, using fallback location label:', geocodeError);
        locationLabel = `Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`;
      }

      const requestUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=weathercode,temperature_2m,relativehumidity_2m&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;

      const response = await fetch(requestUrl);
      if (!response.ok) {
        throw new Error('Unable to fetch weather data');
      }
      const payload = await response.json();

      const interpretWeatherCode = (code: number): { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap } => {
        if ([0].includes(code)) return { label: 'Sunny', icon: 'weather-sunny' };
        if ([1, 2].includes(code)) return { label: 'Partly cloudy', icon: 'weather-partly-cloudy' };
        if ([3].includes(code)) return { label: 'Cloudy', icon: 'weather-cloudy' };
        if ([45, 48].includes(code)) return { label: 'Foggy', icon: 'weather-fog' };
        if ([51, 53, 55].includes(code)) return { label: 'Light rain', icon: 'weather-rainy' };
        if ([56, 57].includes(code)) return { label: 'Light rain', icon: 'weather-rainy' };
        if ([61, 63, 65].includes(code)) return { label: 'Rainy', icon: 'weather-pouring' };
        if ([66, 67].includes(code)) return { label: 'Rainy', icon: 'weather-rainy' };
        if ([71, 73, 75, 77].includes(code)) return { label: 'Snowy', icon: 'weather-snowy' };
        if ([80, 81, 82].includes(code)) return { label: 'Rainy', icon: 'weather-rainy' };
        if ([85, 86].includes(code)) return { label: 'Snowy', icon: 'weather-snowy-heavy' };
        if ([95, 96, 99].includes(code)) return { label: 'Stormy', icon: 'weather-lightning' };
        return { label: 'Cloudy', icon: 'weather-cloudy' };
      };

      const currentWeatherCode = payload.current_weather?.weathercode ?? 0;
      const { label: currentLabel, icon: currentIcon } = interpretWeatherCode(currentWeatherCode);

      const humidityIndex = payload.hourly?.time?.findIndex((timestamp: string) => timestamp === payload.current_weather?.time);
      const currentHumidity = humidityIndex != null && humidityIndex >= 0 ? payload.hourly.relativehumidity_2m?.[humidityIndex] : undefined;

      const todayWeatherCode = payload.daily?.weathercode?.[0] ?? 0;
      const { label: todayLabel, icon: todayIcon } = interpretWeatherCode(todayWeatherCode);

      const tomorrowWeatherCode = payload.daily?.weathercode?.[1] ?? 0;
      const { label: tomorrowLabel, icon: tomorrowIcon } = interpretWeatherCode(tomorrowWeatherCode);

      const currentTime = payload.current_weather?.time;
      const hourlyTimes = payload.hourly?.time || [];
      const hourlyTemps = payload.hourly?.temperature_2m || [];
      const hourlyCodes = payload.hourly?.weathercode || [];

      const currentTimeIndex = hourlyTimes.findIndex((time: string) => time === currentTime);
      const next5Hours: HourlyForecast[] = [];

      for (let i = 1; i <= 5 && currentTimeIndex + i < hourlyTimes.length; i++) {
        const hourIndex = currentTimeIndex + i;
        const hourCode = hourlyCodes[hourIndex] ?? 0;
        const { label: hourLabel, icon: hourIcon } = interpretWeatherCode(hourCode);
        next5Hours.push({
          time: hourlyTimes[hourIndex],
          temperature: hourlyTemps[hourIndex] ?? 0,
          conditionLabel: hourLabel,
          conditionIcon: hourIcon,
        });
      }

      const fiveDayForecast: DailyForecast[] = [];
      for (let i = 0; i < 5 && i < (payload.daily?.time?.length ?? 0); i++) {
        const dayCode = payload.daily?.weathercode?.[i] ?? 0;
        const { label: dayLabel, icon: dayIcon } = interpretWeatherCode(dayCode);
        fiveDayForecast.push({
          date: payload.daily?.time?.[i] ?? '',
          high: payload.daily?.temperature_2m_max?.[i] ?? 0,
          low: payload.daily?.temperature_2m_min?.[i] ?? 0,
          conditionLabel: dayLabel,
          conditionIcon: dayIcon,
        });
      }

      const snapshot: WeatherSnapshot = {
        currentTemperature: payload.current_weather?.temperature ?? 0,
        currentWindspeed: payload.current_weather?.windspeed ?? 0,
        currentHumidity: currentHumidity ?? payload.hourly?.relativehumidity_2m?.[0] ?? 0,
        currentConditionLabel: currentLabel,
        currentConditionIcon: currentIcon,
        locationLabel,
        todayHigh: payload.daily?.temperature_2m_max?.[0],
        todayLow: payload.daily?.temperature_2m_min?.[0],
        todayConditionLabel: todayLabel,
        todayConditionIcon: todayIcon,
        hourlyForecast: next5Hours,
        tomorrowHigh: payload.daily?.temperature_2m_max?.[1],
        tomorrowLow: payload.daily?.temperature_2m_min?.[1],
        tomorrowConditionLabel: tomorrowLabel,
        tomorrowConditionIcon: tomorrowIcon,
        fiveDayForecast,
      };

      setWeather(snapshot);
      await saveWeatherCache(snapshot);
      // Fire weather advisory for extreme conditions
      scheduleWeatherAlertNotification(
        snapshot.currentConditionLabel,
        snapshot.currentTemperature
      );
    } catch (error: unknown) {
      // Only log non-location errors to avoid stack traces for expected location issues
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        // Skip logging location unavailable errors as they're handled gracefully
        if (!errorMessage.includes('location') && !errorMessage.includes('unavailable')) {
          console.error('Weather refresh failed', error.message);
        }
      } else {
        console.error('Weather refresh failed', error);
      }

      // Check if it's a location error
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('location') || errorMessage.includes('unavailable')) {
          setHasLocationPermission(false);
          setWeatherError(null); // Don't show error, just hide the section
          setIsWeatherLoading(false);
          setRefreshing(false);
          return;
        }
      }

      setWeatherError('Unable to refresh weather');
    } finally {
      setIsWeatherLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    await refreshWeather();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.brandGreen}
            colors={[palette.brandGreen]}
          />
        }
      >
        {/* Hero Section */}
        <LinearGradient
          colors={[palette.brandGreen, palette.brandGreenDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <View style={styles.heroContent}>
            {/* Greeting Section */}
            <View style={styles.heroGreeting}>
              <View style={styles.heroGreetingIcon}>
                <MaterialCommunityIcons name="leaf" size={28} color={palette.white} />
              </View>
              <View style={styles.heroGreetingText}>
                <Text style={styles.heroGreetingLabel}>Welcome back,</Text>
                <Text style={styles.heroTitle}>
                  {state.profile ? state.profile.name.split(' ')[0] : 'Farmer'}
                </Text>
              </View>
            </View>

            {/* Quick Stats */}
            <View style={styles.heroQuickStats}>
              <View style={styles.quickStatItem}>
                <MaterialCommunityIcons name="microscope" size={18} color={palette.white} />
                <Text style={styles.quickStatText}>{state.diagnosisHistory.length}</Text>
                <Text style={styles.quickStatLabel}>Diagnoses</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <MaterialCommunityIcons name="chart-timeline-variant" size={18} color={palette.white} />
                <Text style={styles.quickStatText}>{state.spectroscopyHistory.length}</Text>
                <Text style={styles.quickStatLabel}>Analyses</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <MaterialCommunityIcons name="message-text" size={18} color={palette.white} />
                <Text style={styles.quickStatText}>{state.chatHistory.length}</Text>
                <Text style={styles.quickStatLabel}>Chats</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Actions Strip */}
        <View style={styles.quickActionsContainer}>
          <Pressable
            style={[styles.quickActionBtn, styles.qaGreen]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/diagnosis');
            }}
            accessibilityLabel="Scan Crop"
          >
            <MaterialCommunityIcons name="microscope" size={22} color="#2E7D32" />
            <Text style={[styles.qaLabel, { color: '#2E7D32' }]}>Scan</Text>
          </Pressable>

          <Pressable
            style={[styles.quickActionBtn, styles.qaBlue]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/chat');
            }}
            accessibilityLabel="Ask AI"
          >
            <MaterialCommunityIcons name="robot" size={22} color="#1565C0" />
            <Text style={[styles.qaLabel, { color: '#1565C0' }]}>Ask AI</Text>
          </Pressable>

          <Pressable
            style={[styles.quickActionBtn, styles.qaAmber]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/history');
            }}
            accessibilityLabel="View history"
          >
            <MaterialCommunityIcons name="history" size={22} color="#BF360C" />
            <Text style={[styles.qaLabel, { color: '#BF360C' }]}>History</Text>
          </Pressable>

          <Pressable
            style={[styles.quickActionBtn, styles.qaPurple]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/library');
            }}
            accessibilityLabel="Open library"
          >
            <MaterialCommunityIcons name="book-open-variant" size={22} color="#6A1B9A" />
            <Text style={[styles.qaLabel, { color: '#6A1B9A' }]}>Library</Text>
          </Pressable>
        </View>

        {/* Weather Card - Only show if location permission is granted */}
        {hasLocationPermission !== false && (
          <View style={styles.weatherCardWrapper}>
            <LinearGradient
              colors={['#163d1a', '#1e5224', '#163d1a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.weatherCardStandalone}
            >
              <View style={styles.weatherCardInner}>
                {isWeatherLoading ? (
                  <View style={styles.weatherLoadingContainer}>
                    <ActivityIndicator size="large" color={palette.white} />
                    <Text style={[styles.weatherLoadingText, { color: palette.white }]}>Loading weather…</Text>
                  </View>
                ) : weatherError ? (
                  <View style={styles.weatherErrorContainer}>
                    <MaterialCommunityIcons name="wifi-off" size={48} color={palette.white} />
                    <Text style={[styles.weatherErrorTitle, { color: palette.white }]}>Connection Issue</Text>
                    <Text style={[styles.weatherError, { color: 'rgba(255,255,255,0.9)' }]}>{weatherError}</Text>
                    <Text style={[styles.weatherErrorHint, { color: 'rgba(255,255,255,0.8)' }]}>
                      App still available. Weather will update when connection is restored.
                    </Text>
                  </View>
                ) : weather ? (
                  <>
                    {/* Header with Location and Refresh */}
                    <View style={styles.weatherHeader}>
                      <View style={styles.weatherLocationContainer}>
                        <MaterialCommunityIcons name="map-marker" size={18} color={palette.white} />
                        <Text style={[styles.weatherLocation, { color: palette.white }]} numberOfLines={1}>
                          {weather.locationLabel}
                        </Text>
                      </View>
                      <View style={styles.weatherHeaderRight}>
                        {weather.isCached && weather.cachedAt && (
                          <View style={[styles.cachedIndicator, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                            <MaterialCommunityIcons name="clock-outline" size={14} color={palette.white} />
                            <Text style={[styles.cachedIndicatorText, { color: palette.white }]}>
                              {new Date(weather.cachedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        )}
                        <Pressable
                          style={[styles.refreshButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                          onPress={refreshWeather}
                          disabled={isWeatherLoading}
                          accessibilityLabel="Refresh weather"
                        >
                          <MaterialCommunityIcons
                            name="refresh"
                            size={18}
                            color={palette.white}
                            style={isWeatherLoading && styles.refreshButtonSpinning}
                          />
                        </Pressable>
                      </View>
                    </View>

                    {/* Compact Weather Card */}
                    <View style={styles.weatherCompactCard}>
                      <LinearGradient
                        colors={['rgba(46, 125, 50, 0.95)', 'rgba(27, 94, 32, 0.98)']}
                        style={styles.weatherCompactGradient}
                      >
                        {/* Main Current Weather Section */}
                        <View style={styles.weatherMainSection}>
                          <View style={styles.weatherCurrentInfo}>
                            <View style={styles.weatherTempRow}>
                              <MaterialCommunityIcons
                                name={weather.currentConditionIcon}
                                size={48}
                                color={palette.white}
                              />
                              <Text style={styles.weatherTempLarge}>
                                {Math.round(weather.currentTemperature)}°
                              </Text>
                            </View>
                            <Text style={styles.weatherConditionLabel}>
                              {weather.currentConditionLabel}
                            </Text>
                          </View>

                          {/* Key Metrics Grid */}
                          <View style={styles.weatherMetricsGrid}>
                            <View style={styles.weatherMetricItem}>
                              <MaterialCommunityIcons name="arrow-up-down" size={16} color={palette.brandGreenLight} />
                              <Text style={styles.weatherMetricValue}>
                                {Math.round(weather.todayHigh ?? 0)}°/{Math.round(weather.todayLow ?? 0)}°
                              </Text>
                            </View>
                            <View style={styles.weatherMetricItem}>
                              <MaterialCommunityIcons name="weather-windy" size={16} color={palette.brandGreenLight} />
                              <Text style={styles.weatherMetricValue}>
                                {Math.round(weather.currentWindspeed)} <Text style={styles.weatherMetricUnit}>km/h</Text>
                              </Text>
                            </View>
                            <View style={styles.weatherMetricItem}>
                              <MaterialCommunityIcons name="water-percent" size={16} color={palette.brandGreenLight} />
                              <Text style={styles.weatherMetricValue}>
                                {Math.round(weather.currentHumidity)}%
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Divider */}
                        <View style={styles.weatherDivider} />

                        {/* Hourly & Tomorrow Section */}
                        <View style={styles.weatherForecastSection}>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.weatherHourlyContainer}
                          >
                            {weather.hourlyForecast.map((hour, index) => (
                              <View key={index} style={styles.weatherHourlyCompactItem}>
                                <Text style={styles.weatherHourlyTimeCompact}>
                                  {new Date(hour.time).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}
                                </Text>
                                <MaterialCommunityIcons name={hour.conditionIcon} size={20} color={palette.white} />
                                <Text style={styles.weatherHourlyTempCompact}>{Math.round(hour.temperature)}°</Text>
                              </View>
                            ))}

                            {/* Tomorrow Preview at the end */}
                            <View style={styles.weatherTomorrowCompact}>
                              <Text style={styles.weatherHourlyTimeCompact}>Tom</Text>
                              <MaterialCommunityIcons name={weather.tomorrowConditionIcon ?? 'weather-cloudy'} size={20} color={palette.brandGreenLight} />
                              <Text style={styles.weatherHourlyTempCompact}>{Math.round(weather.tomorrowHigh ?? 0)}°</Text>
                            </View>
                          </ScrollView>
                        </View>
                      </LinearGradient>
                    </View>

                  </>
                ) : (
                  <View style={styles.weatherLoadingContainer}>
                    <ActivityIndicator size="large" color={palette.white} />
                    <Text style={[styles.weatherLoadingText, { color: palette.white }]}>Loading weather…</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>
        )}

        {/* AI Daily Insight Card */}
        {(dailyInsight || isInsightLoading) && (
          <View style={styles.insightCardContainer}>
            <LinearGradient
              colors={['#FFFDE7', '#FFF8E1', '#FFF3CD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.insightCard}
            >
              {/* Decorative accent bar */}
              <View style={styles.insightAccentBar} />

              <View style={styles.insightHeader}>
                <LinearGradient
                  colors={['#FFD54F', '#FFA000']}
                  style={styles.insightIconContainer}
                >
                  <MaterialCommunityIcons name="lightbulb-on" size={20} color="#FFFFFF" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>AI Daily Tip</Text>
                  <Text style={styles.insightSubtitle}>Personalized for your crops & weather</Text>
                </View>
                <View style={styles.insightBadge}>
                  <MaterialCommunityIcons name="robot" size={12} color="#F57F17" />
                  <Text style={styles.insightBadgeText}>AI</Text>
                </View>
              </View>

              {isInsightLoading ? (
                <View style={styles.insightLoading}>
                  <View style={styles.insightSkeletonLine} />
                  <View style={[styles.insightSkeletonLine, { width: '75%', marginTop: 8 }]} />
                  <View style={[styles.insightSkeletonLine, { width: '88%', marginTop: 8 }]} />
                </View>
              ) : (
                <View style={styles.insightContent}>
                  {!!dailyInsight?.weatherSummary && (
                    <Text style={styles.weatherSummaryText}>{dailyInsight.weatherSummary}</Text>
                  )}
                  <View style={styles.tipBox}>
                    <MaterialCommunityIcons
                      name="sprout"
                      size={16}
                      color="#F9A825"
                      style={{ marginBottom: 4 }}
                    />
                    <Text style={styles.tipText}>{dailyInsight?.tip}</Text>
                  </View>
                </View>
              )}
            </LinearGradient>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5FBF6',
  },
  insightCardContainer: {
    marginHorizontal: spacing.screen,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    ...Platform.select({
      ios: {
        shadowColor: '#F57F17',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  insightCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#FFE082',
    overflow: 'hidden',
  },
  insightAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#FFA000',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  insightIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  insightBadgeText: {
    fontFamily: appFont,
    fontSize: 10,
    fontWeight: '700',
    color: '#F57F17',
    letterSpacing: 0.5,
  },
  insightTitle: {
    fontFamily: appFont,
    fontSize: 16,
    fontWeight: '800',
    color: '#E65100',
    letterSpacing: -0.3,
  },
  insightSubtitle: {
    fontFamily: appFont,
    fontSize: 11,
    color: '#A1720A',
    fontWeight: '500',
    marginTop: 1,
  },
  insightContent: {
    gap: spacing.md,
  },
  weatherSummaryText: {
    fontFamily: appFont,
    fontSize: 14,
    color: '#5D4037',
    lineHeight: 21,
    fontWeight: '500',
    fontStyle: 'italic',
    paddingHorizontal: 2,
  },
  tipBox: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: '#FFA000',
  },
  tipText: {
    fontFamily: appFont,
    fontSize: 14,
    color: '#4E342E',
    lineHeight: 21,
    fontWeight: '500',
  },
  insightLoading: {
    paddingVertical: spacing.sm,
  },
  insightSkeletonLine: {
    height: 12,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 6,
  },
  insightLoadingText: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.text.tertiary,
  },
  content: {
    paddingBottom: spacing.xxl * 2,
  },

  // ── Quick Actions ────────────────────────────────────────────────────────────
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: 5,
  },
  qaGreen:  { backgroundColor: '#E8F5E9' },
  qaBlue:   { backgroundColor: '#E3F2FD' },
  qaAmber:  { backgroundColor: '#FBE9E7' },
  qaPurple: { backgroundColor: '#F3E5F5' },
  qaLabel: {
    fontFamily: appFont,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  heroSection: {
    paddingTop: spacing.mega + spacing.md,
    paddingBottom: spacing.xxl + spacing.md,
    paddingHorizontal: spacing.screen,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroContent: {
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'center',
  },
  heroGreeting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    justifyContent: 'center',
  },
  heroGreetingIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  heroGreetingText: {
    flex: 1,
    alignItems: 'flex-start',
  },
  heroGreetingLabel: {
    ...typography.body.small,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: spacing.xs / 2,
    fontFamily: appFont,
  },
  heroTitle: {
    ...typography.heading.h1,
    color: palette.white,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    ...typography.body.medium,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    marginTop: spacing.md,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 50, 0.1)',
  },
  searchIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(46, 125, 50, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: palette.text.primary,
    fontFamily: appFont,
    paddingVertical: 0,
    fontWeight: '500',
  },
  searchClear: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.sm,
  },
  heroQuickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  quickStatItem: {
    alignItems: 'center',
    gap: spacing.xs / 2,
    flex: 1,
  },
  quickStatText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: appFont,
    lineHeight: 20,
  },
  quickStatLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontFamily: appFont,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 14,
    marginTop: spacing.xs / 4,
  },
  quickStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  contentSection: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.section,
    gap: spacing.lg, // Reduced from xl for tighter spacing
  },
  weatherCardWrapper: {
    width: '100%',
    paddingHorizontal: spacing.screen, // Screen-level padding
    marginVertical: spacing.md,
  },
  weatherCardStandalone: {
    width: '100%',
    minHeight: 380,
    borderRadius: spacing.lg,
    overflow: 'hidden',
    alignSelf: 'stretch',
    ...elevation.high,
  },
  weatherCardInner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    minHeight: 380,
    width: '100%',
    flex: 1,
    borderRadius: spacing.lg,
  },
  weatherLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  weatherLoadingText: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.gray500,
  },
  weatherErrorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  weatherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weatherLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  weatherLocation: {
    fontFamily: appFont,
    fontSize: 15,
    fontWeight: '600',
    color: palette.charcoal,
    flex: 1,
  },
  weatherHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonSpinning: {
    opacity: 0.6,
  },
  cachedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    backgroundColor: '#F5F5F5',
    borderRadius: spacing.sm,
  },
  cachedIndicatorText: {
    fontFamily: appFont,
    fontSize: 11,
    color: palette.gray500,
    fontWeight: '500',
  },
  overviewCard: {
    backgroundColor: palette.white,
    borderRadius: spacing.lg,
    padding: spacing.card,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border.light,
    ...elevation.medium, // Changed from 12 to medium (4)
  },
  mainCard: {
    width: '100%',
    gap: spacing.lg,
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: spacing.card,
    backgroundColor: palette.white,
    ...elevation.high, // Changed from 12 to high (8)
    marginHorizontal: 0,
    alignSelf: 'stretch',
  },
  sectionHeading: {
    ...typography.heading.h2,
    color: palette.text.primary,
    marginBottom: spacing.sm,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    marginBottom: spacing.md,
  },
  statItemInner: {
    width: '100%',
  },
  recentActivityCard: {
    backgroundColor: palette.white,
    borderRadius: spacing.lg,
    padding: spacing.card,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.border.light,
    ...elevation.medium, // Changed from 12 to medium (4)
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recentItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F8F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentItemContent: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  recentItemTitle: {
    fontFamily: appFont,
    fontSize: 15,
    fontWeight: '700',
    color: palette.charcoal,
  },
  recentItemSubtitle: {
    fontFamily: appFont,
    fontSize: 13,
    color: palette.gray500,
  },
  recentItemTime: {
    fontFamily: appFont,
    fontSize: 11,
    color: palette.gray500,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  emptyStateTitle: {
    fontFamily: appFont,
    fontSize: 18,
    fontWeight: '700',
    color: palette.charcoal,
    marginTop: spacing.md,
  },
  emptyStateText: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.gray500,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.brandGreen,
    borderRadius: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  emptyStateButtonText: {
    fontFamily: appFont,
    fontSize: 15,
    fontWeight: '600',
    color: palette.white,
  },
  weatherError: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.gray500,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  weatherErrorTitle: {
    fontFamily: appFont,
    fontSize: 18,
    fontWeight: '700',
    color: palette.charcoal,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  weatherErrorHint: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.gray500,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    lineHeight: 18,
  },
  weatherCarouselContainer: {
    width: '100%',
    marginBottom: spacing.lg,
    minHeight: 400,
    alignSelf: 'stretch',
  },
  weatherCarouselSlide: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginHorizontal: spacing.xs,
    minHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  weatherCompactCard: {
    paddingHorizontal: spacing.screen,
    marginBottom: spacing.lg, // Reduced margin
  },
  weatherCompactGradient: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    minHeight: 200, // Much smaller than 400
  },
  weatherMainSection: {
    marginBottom: spacing.md,
  },
  weatherCurrentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  weatherTempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weatherTempLarge: {
    fontFamily: appFont,
    fontSize: 48,
    fontWeight: '800',
    color: palette.white,
    lineHeight: 56,
  },
  weatherConditionLabel: {
    fontFamily: appFont,
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
    textTransform: 'capitalize',
  },
  weatherMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  weatherMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  weatherMetricValue: {
    fontFamily: appFont,
    fontSize: 13,
    fontWeight: '600',
    color: palette.white,
  },
  weatherMetricUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  weatherDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: spacing.md,
  },
  weatherForecastSection: {
    // Container for the hourly scroll
  },
  weatherHourlyContainer: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  weatherHourlyCompactItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radius.md,
    minWidth: 55,
  },
  weatherHourlyTimeCompact: {
    fontFamily: appFont,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  weatherHourlyTempCompact: {
    fontFamily: appFont,
    fontSize: 14,
    fontWeight: '700',
    color: palette.white,
  },
  weatherTomorrowCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,

    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // Slightly distinct background
    borderRadius: radius.md,
    minWidth: 55,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  weatherSection: {
    marginBottom: spacing.xxl,
    gap: spacing.md,
  },
  weatherSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  weatherSectionTitle: {
    fontFamily: appFont,
    fontSize: 16,
    fontWeight: '700',
    color: palette.charcoal,
  },
  weatherCurrentContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weatherCurrentLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  weatherCurrentMetrics: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E1EDE4',
  },
  weatherCurrentMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  weatherCurrentMetricText: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.gray500,
  },
  weatherForecastGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  weatherForecastCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: palette.white,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#E1EDE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  },
  weatherForecastCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weatherForecastDay: {
    fontFamily: appFont,
    fontSize: 16,
    fontWeight: '700',
    color: palette.charcoal,
  },
  weatherForecastTemps: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  weatherForecastTempItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  weatherForecastTempValue: {
    fontFamily: appFont,
    fontSize: 20,
    fontWeight: '700',
    color: palette.charcoal,
  },
  weatherForecastCondition: {
    fontFamily: appFont,
    fontSize: 13,
    color: palette.gray500,
  },
});

