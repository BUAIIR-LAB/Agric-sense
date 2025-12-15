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
  ImageBackground,
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
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { elevation } from '@/theme/elevation';
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
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const carouselRef = useRef<FlatList>(null);
  const { width: screenWidth } = useWindowDimensions(); // Responsive width
  const carouselIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Calculate carousel item width responsively
  // Account for: screen padding (20px each side) + card padding (20px each side) + slide margins (8px each side)
  const carouselItemWidth = useMemo(() => {
    const screenPadding = spacing.screen * 2; // Left and right screen padding
    const cardPadding = spacing.screen * 2; // Left and right card padding
    const slideMargins = spacing.xs * 4; // Left and right margins for each slide (2 slides visible edges)
    return screenWidth - screenPadding - cardPadding - slideMargins;
  }, [screenWidth]);

  const latestDiagnosis = state.diagnosisHistory[0];
  const latestSpectra = state.spectroscopyHistory[0];
  const assistantNote = useMemo(
    () =>
      [...state.chatHistory]
        .reverse()
        .find((message) => message.role === 'assistant')?.content,
    [state.chatHistory],
  );

  // Calculate trend data for last 7 days
  const getTrendData = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const diagnosisTrend = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      return state.diagnosisHistory.filter(
        (d) => new Date(d.timestamp).toDateString() === date.toDateString()
      ).length;
    });
    
    const spectraTrend = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      return state.spectroscopyHistory.filter(
        (s) => new Date(s.timestamp).toDateString() === date.toDateString()
      ).length;
    });
    
    const chatTrend = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      return state.chatHistory.filter(
        (c) => new Date(c.timestamp).toDateString() === date.toDateString()
      ).length;
    });
    
    return { diagnosisTrend, spectraTrend, chatTrend };
  }, [state.diagnosisHistory, state.spectroscopyHistory, state.chatHistory]);

  const statCards = [
    {
      label: 'Diagnoses',
      value: state.diagnosisHistory.length,
      trendText: latestDiagnosis
        ? `Last run ${new Date(latestDiagnosis.timestamp).toLocaleDateString()}`
        : 'Run your first scan',
      trendData: getTrendData.diagnosisTrend,
      icon: <MaterialCommunityIcons name="microscope" size={20} color={palette.brandGreen} />,
    },
    {
      label: 'Spectra',
      value: state.spectroscopyHistory.length,
      trendText: latestSpectra
        ? `Last capture ${new Date(latestSpectra.timestamp).toLocaleDateString()}`
        : 'Log a reading',
      trendData: getTrendData.spectraTrend,
      icon: <MaterialCommunityIcons name="chart-timeline-variant" size={20} color={palette.brandGreen} />,
    },
    {
      label: 'Chats',
      value: state.chatHistory.length,
      trendText: assistantNote ? 'Assistant ready to help' : 'Start a conversation',
      trendData: getTrendData.chatTrend,
      icon: <MaterialCommunityIcons name="robot-outline" size={20} color={palette.brandGreen} />,
    },
  ] as const;

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

  // Auto-scroll carousel every 8 seconds (slower)
  useEffect(() => {
    if (!weather || isWeatherLoading || isCarouselPaused) return;

    const scrollToNext = () => {
      if (isCarouselPaused) return;
      setCarouselIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % 4;
        carouselRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        return nextIndex;
      });
    };

    // Start auto-scroll
    carouselIntervalRef.current = setInterval(scrollToNext, 8000);

    return () => {
      if (carouselIntervalRef.current) {
        clearInterval(carouselIntervalRef.current);
      }
    };
  }, [weather, isWeatherLoading, isCarouselPaused]);

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

            {/* Subtitle */}
            <Text style={styles.heroSubtitle}>
              Your AI-powered agronomy assistant
            </Text>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={styles.searchIconContainer}>
                <MaterialCommunityIcons name="magnify" size={22} color={palette.brandGreen} />
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder="Search crops, diseases, or advice..."
                placeholderTextColor={palette.gray500}
                value={searchQuery}
                onChangeText={setSearchQuery}
                accessibilityLabel="Search"
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  style={styles.searchClear}
                  accessibilityLabel="Clear search"
                >
                  <MaterialCommunityIcons name="close-circle" size={20} color={palette.gray400} />
                </Pressable>
              )}
            </View>

            {/* Quick Stats */}
            <View style={styles.heroQuickStats}>
              <View style={styles.quickStatItem}>
                <MaterialCommunityIcons name="microscope" size={18} color={palette.white} />
                <Text style={styles.quickStatText}>{state.diagnosisHistory.length}</Text>
                <Text style={styles.quickStatLabel}>Diagnose</Text>
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

        {/* Weather Card - Only show if location permission is granted */}
        {hasLocationPermission !== false && (
          <View style={styles.weatherCardWrapper}>
            <ImageBackground
              source={{ uri: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1200&h=600&fit=crop&q=90' }}
              style={styles.weatherCardStandalone}
              imageStyle={styles.weatherCardBackgroundImage}
            >
            <View style={styles.weatherCardOverlay}>
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

              {/* Weather Carousel */}
              <View style={styles.weatherCarouselContainer}>
                <FlatList
                  ref={carouselRef}
                  data={[
                    { type: 'today', data: weather },
                    { type: 'hourly', data: weather.hourlyForecast },
                    { type: 'tomorrow', data: weather },
                    { type: 'fiveDay', data: weather.fiveDayForecast },
                  ]}
                  keyExtractor={(item, index) => `${item.type}-${index}`}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={carouselItemWidth + spacing.xs * 2}
                  snapToAlignment="center"
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingHorizontal: spacing.xs }}
                  getItemLayout={(data, index) => ({
                    length: carouselItemWidth + spacing.xs * 2,
                    offset: (carouselItemWidth + spacing.xs * 2) * index,
                    index,
                  })}
                  onMomentumScrollEnd={(event) => {
                    const itemWidth = carouselItemWidth + spacing.xs * 2;
                    const index = Math.round(event.nativeEvent.contentOffset.x / itemWidth);
                    setCarouselIndex(index);
                    setIsCarouselPaused(false);
                    if (carouselIntervalRef.current) {
                      clearInterval(carouselIntervalRef.current);
                    }
                    carouselIntervalRef.current = setInterval(() => {
                      setCarouselIndex((prevIndex) => {
                        const nextIndex = (prevIndex + 1) % 4;
                        carouselRef.current?.scrollToIndex({ index: nextIndex, animated: true });
                        return nextIndex;
                      });
                    }, 8000);
                  }}
                  onTouchStart={() => setIsCarouselPaused(true)}
                  onTouchEnd={() => {
                    setTimeout(() => setIsCarouselPaused(false), 3000);
                  }}
                  onScrollToIndexFailed={(info) => {
                    const wait = new Promise((resolve) => setTimeout(resolve, 500));
                    wait.then(() => {
                      carouselRef.current?.scrollToIndex({ index: info.index, animated: true });
                    });
                  }}
                  renderItem={({ item }) => {
                    if (item.type === 'today') {
                      return (
                        <View style={[styles.weatherCarouselSlide, { width: carouselItemWidth }]}>
                          <LinearGradient
                            colors={['rgba(46, 125, 50, 0.95)', 'rgba(27, 94, 32, 0.98)']}
                            style={styles.weatherSlideGradient}
                          >
                            <View style={styles.weatherSlideContent}>
                              <View style={styles.weatherSlideHeader}>
                                <View style={styles.weatherSlideHeaderIcon}>
                                  <MaterialCommunityIcons name="weather-sunny" size={22} color={palette.white} />
                                </View>
                                <Text style={styles.weatherSlideTitle}>Today's Weather</Text>
                              </View>
                              
                              <View style={styles.weatherTodayMain}>
                                <MaterialCommunityIcons
                                  name={weather.currentConditionIcon}
                                  size={72}
                                  color={palette.white}
                                />
                                <View style={styles.weatherTemperatureContainer}>
                                  <Text style={styles.weatherTemperature}>{Math.round(weather.currentTemperature)}</Text>
                                  <Text style={styles.weatherTemperatureUnit}>°C</Text>
                                </View>
                              </View>
                              
                              <Text style={styles.weatherCondition}>
                                {weather.currentConditionLabel.charAt(0).toUpperCase() + weather.currentConditionLabel.slice(1)}
                              </Text>
                              
                              <View style={styles.weatherTodayMetrics}>
                                <View style={styles.weatherTodayMetricCard}>
                                  <MaterialCommunityIcons name="arrow-up" size={18} color={palette.brandGreen} />
                                  <Text style={styles.weatherTodayMetricValue}>{Math.round(weather.todayHigh ?? 0)}°</Text>
                                  <Text style={styles.weatherTodayMetricLabel}>High</Text>
                                </View>
                                <View style={styles.weatherTodayMetricCard}>
                                  <MaterialCommunityIcons name="arrow-down" size={18} color={palette.brandGreen} />
                                  <Text style={styles.weatherTodayMetricValue}>{Math.round(weather.todayLow ?? 0)}°</Text>
                                  <Text style={styles.weatherTodayMetricLabel}>Low</Text>
                                </View>
                                <View style={styles.weatherTodayMetricCard}>
                                  <MaterialCommunityIcons name="weather-windy" size={18} color={palette.brandGreen} />
                                  <Text style={styles.weatherTodayMetricValue}>{Math.round(weather.currentWindspeed)}</Text>
                                  <Text style={styles.weatherTodayMetricLabel}>km/h</Text>
                                </View>
                                <View style={styles.weatherTodayMetricCard}>
                                  <MaterialCommunityIcons name="water-percent" size={18} color={palette.brandGreen} />
                                  <Text style={styles.weatherTodayMetricValue}>{Math.round(weather.currentHumidity)}</Text>
                                  <Text style={styles.weatherTodayMetricLabel}>Humidity</Text>
                                </View>
                              </View>
                            </View>
                          </LinearGradient>
                        </View>
                      );
                    }
                    if (item.type === 'hourly') {
                      return (
                        <View style={[styles.weatherCarouselSlide, { width: carouselItemWidth }]}>
                          <LinearGradient
                            colors={['rgba(46, 125, 50, 0.95)', 'rgba(27, 94, 32, 0.98)']}
                            style={styles.weatherSlideGradient}
                          >
                            <View style={styles.weatherSlideContent}>
                              <View style={styles.weatherSlideHeader}>
                                <View style={styles.weatherSlideHeaderIcon}>
                                  <MaterialCommunityIcons name="clock-time-four-outline" size={22} color={palette.white} />
                                </View>
                                <Text style={styles.weatherSlideTitle}>Hourly Forecast</Text>
                              </View>
                              
                              <View style={styles.weatherHourlyList}>
                                {(item.data as HourlyForecast[]).map((hour: HourlyForecast, index: number) => {
                                  const hourDate = new Date(hour.time);
                                  const hourStr = hourDate.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
                                  return (
                                    <View key={index} style={styles.weatherHourlyItem}>
                                      <Text style={styles.weatherHourlyTime}>{hourStr}</Text>
                                      <MaterialCommunityIcons name={hour.conditionIcon} size={28} color={palette.white} />
                                      <Text style={styles.weatherHourlyTemp}>{Math.round(hour.temperature)}°</Text>
                                      <Text style={styles.weatherHourlyCondition} numberOfLines={1}>
                                        {hour.conditionLabel}
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                            </View>
                          </LinearGradient>
                        </View>
                      );
                    }
                    if (item.type === 'tomorrow') {
                      return (
                        <View style={[styles.weatherCarouselSlide, { width: carouselItemWidth }]}>
                          <LinearGradient
                            colors={['rgba(46, 125, 50, 0.95)', 'rgba(27, 94, 32, 0.98)']}
                            style={styles.weatherSlideGradient}
                          >
                            <View style={styles.weatherSlideContent}>
                              <View style={styles.weatherSlideHeader}>
                                <View style={styles.weatherSlideHeaderIcon}>
                                  <MaterialCommunityIcons name="calendar-arrow-right" size={22} color={palette.white} />
                                </View>
                                <Text style={styles.weatherSlideTitle}>Tomorrow</Text>
                              </View>
                              
                              <View style={styles.weatherTomorrowContent}>
                                <MaterialCommunityIcons
                                  name={weather.tomorrowConditionIcon ?? 'weather-cloudy'}
                                  size={72}
                                  color={palette.white}
                                />
                                <View style={styles.weatherTomorrowTemps}>
                                  <View style={styles.weatherTomorrowTempCard}>
                                    <MaterialCommunityIcons name="arrow-up" size={20} color={palette.brandGreenLight} />
                                    <Text style={styles.weatherTomorrowTempValue}>{Math.round(weather.tomorrowHigh ?? 0)}°</Text>
                                    <Text style={styles.weatherTomorrowTempLabel}>High</Text>
                                  </View>
                                  <View style={styles.weatherTomorrowTempCard}>
                                    <MaterialCommunityIcons name="arrow-down" size={20} color={palette.brandGreenLight} />
                                    <Text style={styles.weatherTomorrowTempValue}>{Math.round(weather.tomorrowLow ?? 0)}°</Text>
                                    <Text style={styles.weatherTomorrowTempLabel}>Low</Text>
                                  </View>
                                </View>
                                <Text style={styles.weatherCondition}>
                                  {weather.tomorrowConditionLabel
                                    ? weather.tomorrowConditionLabel.charAt(0).toUpperCase() + weather.tomorrowConditionLabel.slice(1)
                                    : 'Clear skies'}
                                </Text>
                              </View>
                            </View>
                          </LinearGradient>
                        </View>
                      );
                    }
                    if (item.type === 'fiveDay') {
                      return (
                        <View style={[styles.weatherCarouselSlide, { width: carouselItemWidth }]}>
                          <LinearGradient
                            colors={['rgba(46, 125, 50, 0.95)', 'rgba(27, 94, 32, 0.98)']}
                            style={styles.weatherSlideGradient}
                          >
                            <View style={styles.weatherSlideContent}>
                              <View style={styles.weatherSlideHeader}>
                                <View style={styles.weatherSlideHeaderIcon}>
                                  <MaterialCommunityIcons name="calendar-range" size={22} color={palette.white} />
                                </View>
                                <Text style={styles.weatherSlideTitle}>5-Day Forecast</Text>
                              </View>
                              
                              <View style={styles.weatherFiveDayList}>
                                {(item.data as DailyForecast[]).map((day: DailyForecast, index: number) => {
                                  const dayDate = new Date(day.date);
                                  const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                                  const dayNumber = dayDate.getDate();
                                  const isToday = index === 0;
                                  return (
                                    <View key={index} style={styles.weatherFiveDayItem}>
                                      <View style={styles.weatherFiveDayLeft}>
                                        <Text style={styles.weatherFiveDayName}>{isToday ? 'Today' : dayName}</Text>
                                        <Text style={styles.weatherFiveDayDate}>{dayNumber}</Text>
                                      </View>
                                      <MaterialCommunityIcons name={day.conditionIcon} size={28} color={palette.white} />
                                      <View style={styles.weatherFiveDayTemps}>
                                        <Text style={styles.weatherFiveDayHigh}>{Math.round(day.high)}°</Text>
                                        <Text style={styles.weatherFiveDayLow}>{Math.round(day.low)}°</Text>
                                      </View>
                                    </View>
                                  );
                                })}
                              </View>
                            </View>
                          </LinearGradient>
                        </View>
                      );
                    }
                    return null;
                  }}
                />
                {/* Pagination Indicators */}
                <View style={styles.weatherPaginationContainer}>
                  <View style={styles.weatherPagination}>
                    {[0, 1, 2, 3].map((index) => (
                      <View
                        key={index}
                        style={[
                          styles.weatherPaginationDot,
                          carouselIndex === index && styles.weatherPaginationDotActive,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.weatherLoadingContainer}>
              <ActivityIndicator size="large" color={palette.white} />
              <Text style={[styles.weatherLoadingText, { color: palette.white }]}>Loading weather…</Text>
            </View>
          )}
            </View>
          </ImageBackground>
          </View>
        )}

        {/* Recent Activity */}
        {(latestDiagnosis || latestSpectra) && (
          <View style={styles.contentSection}>
            <View style={styles.recentActivityCard}>
              <Text style={styles.sectionHeading}>Recent Activity</Text>
              {latestDiagnosis && (
                <Pressable 
                  style={styles.recentItem}
                  onPress={() => router.push(`/history/diagnosis/${latestDiagnosis.id}`)}
                  accessibilityLabel="View latest diagnosis"
                >
                  <View style={styles.recentItemIcon}>
                    <MaterialCommunityIcons name="microscope" size={20} color={palette.brandGreen} />
                  </View>
                  <View style={styles.recentItemContent}>
                    <Text style={styles.recentItemTitle}>Latest Diagnosis</Text>
                    <Text style={styles.recentItemSubtitle} numberOfLines={1}>
                      {latestDiagnosis.suspectedIssues[0] || 'Crop analysis'}
                    </Text>
                    <Text style={styles.recentItemTime}>
                      {new Date(latestDiagnosis.timestamp).toLocaleDateString()}
                      </Text>
                    </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={palette.gray500} />
                </Pressable>
              )}
              {latestSpectra && (
                <Pressable 
                  style={styles.recentItem}
                  onPress={() => router.push(`/history/spectroscopy/${latestSpectra.id}`)}
                  accessibilityLabel="View latest spectroscopy"
                >
                  <View style={styles.recentItemIcon}>
                    <MaterialCommunityIcons name="chart-timeline-variant" size={20} color={palette.brandGreen} />
                  </View>
                  <View style={styles.recentItemContent}>
                    <Text style={styles.recentItemTitle}>Latest Spectrum</Text>
                    <Text style={styles.recentItemSubtitle} numberOfLines={1}>
                      {latestSpectra.sampleName || 'Spectral data'}
                    </Text>
                    <Text style={styles.recentItemTime}>
                      {new Date(latestSpectra.timestamp).toLocaleDateString()}
                      </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={palette.gray500} />
                </Pressable>
              )}
                    </View>
                  </View>
                )}

        {/* Main Content Section */}
        <View style={styles.contentSection}>
          <View style={styles.overviewCard}>
            <Text style={styles.sectionHeading}>Today's Overview</Text>
            {statCards.length > 0 ? (
              <View style={styles.statGrid}>
                {statCards.map((stat) => {
                  const handlePress = () => {
                    if (stat.label === 'Diagnoses') {
                      router.push('/(tabs)/history');
                    } else if (stat.label === 'Spectra') {
                      router.push('/(tabs)/history');
                    } else if (stat.label === 'Chats') {
                      router.push('/(tabs)/chat');
                    }
                  };
                  
                  return (
                    <Pressable
                      key={stat.label}
                      onPress={handlePress}
                      style={styles.statItem}
                      accessibilityLabel={`View ${stat.label}`}
                    >
                      <StatTile
                        icon={stat.icon}
                        label={stat.label}
                        value={stat.value}
                        trendText={stat.trendText}
                        trendData={stat.trendData}
                        style={styles.statItemInner}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyStateContainer}>
                <MaterialCommunityIcons name="chart-timeline-variant" size={48} color={palette.gray500} />
                <Text style={styles.emptyStateTitle}>No Activity Yet</Text>
                <Text style={styles.emptyStateText}>Start using the app to see your stats here</Text>
                <Pressable 
                  style={styles.emptyStateButton}
                  onPress={() => router.push('/(tabs)/diagnosis')}
                >
                  <MaterialCommunityIcons name="camera-iris" size={20} color={palette.white} />
                  <Text style={styles.emptyStateButtonText}>Start Diagnosis</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5FBF6',
  },
  content: {
    paddingBottom: spacing.xxl * 2,
  },
  heroSection: {
    paddingTop: spacing.mega + spacing.lg,
    paddingBottom: spacing.xxl + spacing.lg,
    paddingHorizontal: spacing.screen,
    borderBottomLeftRadius: spacing.xl * 2,
    borderBottomRightRadius: spacing.xl * 2,
    overflow: 'hidden',
  },
  heroContent: {
    alignItems: 'center',
    gap: spacing.lg,
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
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
    marginTop: spacing.md,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
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
    minHeight: 380, // Reduced from 450 for more compact design
    borderRadius: spacing.lg,
    overflow: 'hidden',
    alignSelf: 'stretch',
    ...elevation.high, // Changed from 12 to high (8)
  },
  weatherCardBackgroundImage: {
    opacity: 0.9,
    resizeMode: 'cover',
    width: '100%',
    height: '100%',
  },
  weatherCardOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    minHeight: 380, // Match card minHeight
    width: '100%',
    height: '100%', // Fill parent
    flex: 1, // Allow flexible height
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
  weatherSlideGradient: {
    width: '100%',
    height: '100%',
    minHeight: 400,
    borderRadius: radius.xl,
  },
  weatherSlideContent: {
    padding: spacing.xl,
    height: '100%',
    justifyContent: 'space-between',
    minHeight: 400,
  },
  weatherSlideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.25)',
  },
  weatherSlideHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherSlideTitle: {
    fontFamily: appFont,
    fontSize: 18,
    fontWeight: '700',
    color: palette.white,
    letterSpacing: 0.5,
    flex: 1,
  },
  weatherTodayMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginVertical: spacing.lg,
  },
  weatherTemperatureContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  weatherTemperature: {
    fontFamily: appFont,
    fontSize: 64,
    fontWeight: '800',
    color: palette.white,
    lineHeight: 72,
  },
  weatherTemperatureUnit: {
    fontFamily: appFont,
    fontSize: 28,
    fontWeight: '600',
    color: palette.white,
    marginTop: spacing.xs,
  },
  weatherCondition: {
    fontFamily: appFont,
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginBottom: spacing.lg,
    letterSpacing: 0.3,
  },
  weatherTodayMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  weatherTodayMetricCard: {
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 70,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    flex: 1,
    maxWidth: '48%',
  },
  weatherTodayMetricValue: {
    fontFamily: appFont,
    fontSize: 20,
    fontWeight: '700',
    color: palette.white,
  },
  weatherTodayMetricLabel: {
    fontFamily: appFont,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weatherHourlyList: {
    gap: spacing.sm,
    flex: 1,
  },
  weatherHourlyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: spacing.xs,
  },
  weatherHourlyTime: {
    fontFamily: appFont,
    fontSize: 14,
    fontWeight: '600',
    color: palette.white,
    minWidth: 65,
  },
  weatherHourlyTemp: {
    fontFamily: appFont,
    fontSize: 18,
    fontWeight: '700',
    color: palette.white,
    minWidth: 50,
    textAlign: 'center',
  },
  weatherHourlyCondition: {
    fontFamily: appFont,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  weatherTomorrowContent: {
    alignItems: 'center',
    gap: spacing.lg,
    flex: 1,
    justifyContent: 'center',
  },
  weatherTomorrowTemps: {
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  weatherTomorrowTempCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 100,
  },
  weatherTomorrowTempValue: {
    fontFamily: appFont,
    fontSize: 36,
    fontWeight: '800',
    color: palette.white,
  },
  weatherTomorrowTempLabel: {
    fontFamily: appFont,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weatherFiveDayList: {
    gap: spacing.sm,
    flex: 1,
  },
  weatherFiveDayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: spacing.xs,
  },
  weatherFiveDayLeft: {
    gap: spacing.xs / 2,
    minWidth: 85,
  },
  weatherFiveDayName: {
    fontFamily: appFont,
    fontSize: 15,
    fontWeight: '700',
    color: palette.white,
  },
  weatherFiveDayDate: {
    fontFamily: appFont,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  weatherFiveDayTemps: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    minWidth: 70,
  },
  weatherFiveDayHigh: {
    fontFamily: appFont,
    fontSize: 18,
    fontWeight: '700',
    color: palette.white,
  },
  weatherFiveDayLow: {
    fontFamily: appFont,
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  weatherPaginationContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  weatherPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    alignItems: 'center',
  },
  weatherPaginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D2DAD4',
  },
  weatherPaginationDotActive: {
    backgroundColor: palette.brandGreen,
    width: 24,
    height: 8,
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
  weatherForecastSection: {
    gap: spacing.md,
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

