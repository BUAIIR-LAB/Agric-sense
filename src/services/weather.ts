import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { scheduleWeatherAlertNotification } from '@/utils/notifications';

export type HourlyForecast = {
  time: string;
  temperature: number;
  conditionLabel: string;
  conditionIcon: keyof typeof MaterialCommunityIcons.glyphMap;
};

export type DailyForecast = {
  date: string;
  high: number;
  low: number;
  conditionLabel: string;
  conditionIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  precipitationMm?: number;
};

export type WeatherSnapshot = {
  currentTemperature: number;
  currentHumidity: number;
  currentWindspeed: number;
  currentConditionLabel: string;
  currentConditionIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  locationLabel: string;
  latitude?: number;
  longitude?: number;
  todayHigh?: number;
  todayLow?: number;
  todayConditionLabel?: string;
  todayConditionIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  hourlyForecast: HourlyForecast[];
  tomorrowHigh?: number;
  tomorrowLow?: number;
  tomorrowConditionLabel?: string;
  tomorrowConditionIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Up to 16 days from Open-Meteo */
  dailyForecast: DailyForecast[];
  /** @deprecated use dailyForecast — kept for older cache payloads */
  fiveDayForecast: DailyForecast[];
  cachedAt?: string;
  isCached?: boolean;
};

export const WEATHER_STORAGE_KEY = 'weather-data-cache';
export const CACHE_EXPIRY_HOURS = 2;
export const FORECAST_DAYS = 16;

export function interpretWeatherCode(
  code: number,
): { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap } {
  if ([0].includes(code)) return { label: 'Sunny', icon: 'weather-sunny' };
  if ([1, 2].includes(code)) return { label: 'Partly cloudy', icon: 'weather-partly-cloudy' };
  if ([3].includes(code)) return { label: 'Cloudy', icon: 'weather-cloudy' };
  if ([45, 48].includes(code)) return { label: 'Foggy', icon: 'weather-fog' };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Light rain', icon: 'weather-rainy' };
  if ([61, 63, 65].includes(code)) return { label: 'Rainy', icon: 'weather-pouring' };
  if ([66, 67, 80, 81, 82].includes(code)) return { label: 'Rainy', icon: 'weather-rainy' };
  if ([71, 73, 75, 77].includes(code)) return { label: 'Snowy', icon: 'weather-snowy' };
  if ([85, 86].includes(code)) return { label: 'Snowy', icon: 'weather-snowy-heavy' };
  if ([95, 96, 99].includes(code)) return { label: 'Stormy', icon: 'weather-lightning' };
  return { label: 'Cloudy', icon: 'weather-cloudy' };
}

export async function saveWeatherCache(data: WeatherSnapshot) {
  try {
    const dataToCache = {
      ...data,
      cachedAt: new Date().toISOString(),
      isCached: false,
    };
    await AsyncStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(dataToCache));
  } catch (error) {
    console.warn('Failed to cache weather data', error);
  }
}

export async function loadWeatherCache(): Promise<WeatherSnapshot | null> {
  try {
    const cached = await AsyncStorage.getItem(WEATHER_STORAGE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as WeatherSnapshot & { cachedAt: string };
    const normalized = normalizeSnapshot(parsed);
    if (!parsed.cachedAt) return { ...normalized, isCached: true };
    const cacheAgeHours =
      (Date.now() - new Date(parsed.cachedAt).getTime()) / (1000 * 60 * 60);
    if (cacheAgeHours >= CACHE_EXPIRY_HOURS) return null;
    return { ...normalized, isCached: true };
  } catch {
    return null;
  }
}

/** Ensure older caches without dailyForecast still work. */
function normalizeSnapshot(data: WeatherSnapshot): WeatherSnapshot {
  const daily =
    data.dailyForecast?.length > 0
      ? data.dailyForecast
      : data.fiveDayForecast?.length > 0
        ? data.fiveDayForecast
        : [];
  return {
    ...data,
    dailyForecast: daily,
    fiveDayForecast: daily.slice(0, 5),
  };
}

function buildSnapshot(
  payload: any,
  locationLabel: string,
  coords?: { latitude: number; longitude: number },
): WeatherSnapshot {
  const currentWeatherCode = payload.current_weather?.weathercode ?? 0;
  const { label: currentLabel, icon: currentIcon } = interpretWeatherCode(currentWeatherCode);

  const humidityIndex = payload.hourly?.time?.findIndex(
    (timestamp: string) => timestamp === payload.current_weather?.time,
  );
  const currentHumidity =
    humidityIndex != null && humidityIndex >= 0
      ? payload.hourly.relativehumidity_2m?.[humidityIndex]
      : undefined;

  const todayWeatherCode = payload.daily?.weathercode?.[0] ?? 0;
  const { label: todayLabel, icon: todayIcon } = interpretWeatherCode(todayWeatherCode);

  const tomorrowWeatherCode = payload.daily?.weathercode?.[1] ?? 0;
  const { label: tomorrowLabel, icon: tomorrowIcon } = interpretWeatherCode(tomorrowWeatherCode);

  const currentTime = payload.current_weather?.time;
  const hourlyTimes = payload.hourly?.time || [];
  const hourlyTemps = payload.hourly?.temperature_2m || [];
  const hourlyCodes = payload.hourly?.weathercode || [];
  const currentTimeIndex = hourlyTimes.findIndex((time: string) => time === currentTime);
  const nextHours: HourlyForecast[] = [];

  for (let i = 1; i <= 12 && currentTimeIndex + i < hourlyTimes.length; i++) {
    const hourIndex = currentTimeIndex + i;
    const { label: hourLabel, icon: hourIcon } = interpretWeatherCode(hourlyCodes[hourIndex] ?? 0);
    nextHours.push({
      time: hourlyTimes[hourIndex],
      temperature: hourlyTemps[hourIndex] ?? 0,
      conditionLabel: hourLabel,
      conditionIcon: hourIcon,
    });
  }

  const dailyForecast: DailyForecast[] = [];
  const dayCount = payload.daily?.time?.length ?? 0;
  for (let i = 0; i < dayCount; i++) {
    const { label: dayLabel, icon: dayIcon } = interpretWeatherCode(
      payload.daily?.weathercode?.[i] ?? 0,
    );
    dailyForecast.push({
      date: payload.daily?.time?.[i] ?? '',
      high: payload.daily?.temperature_2m_max?.[i] ?? 0,
      low: payload.daily?.temperature_2m_min?.[i] ?? 0,
      conditionLabel: dayLabel,
      conditionIcon: dayIcon,
      precipitationMm: payload.daily?.precipitation_sum?.[i],
    });
  }

  return {
    currentTemperature: payload.current_weather?.temperature ?? 0,
    currentWindspeed: payload.current_weather?.windspeed ?? 0,
    currentHumidity: currentHumidity ?? payload.hourly?.relativehumidity_2m?.[0] ?? 0,
    currentConditionLabel: currentLabel,
    currentConditionIcon: currentIcon,
    locationLabel,
    latitude: coords?.latitude,
    longitude: coords?.longitude,
    todayHigh: payload.daily?.temperature_2m_max?.[0],
    todayLow: payload.daily?.temperature_2m_min?.[0],
    todayConditionLabel: todayLabel,
    todayConditionIcon: todayIcon,
    hourlyForecast: nextHours,
    tomorrowHigh: payload.daily?.temperature_2m_max?.[1],
    tomorrowLow: payload.daily?.temperature_2m_min?.[1],
    tomorrowConditionLabel: tomorrowLabel,
    tomorrowConditionIcon: tomorrowIcon,
    dailyForecast,
    fiveDayForecast: dailyForecast.slice(0, 5),
  };
}

export type FetchWeatherResult =
  | { ok: true; weather: WeatherSnapshot; permissionDenied?: false }
  | { ok: false; permissionDenied: true; error: null }
  | { ok: false; permissionDenied: false; error: string; weather?: WeatherSnapshot };

export async function fetchWeatherSnapshot(): Promise<FetchWeatherResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      return { ok: false, permissionDenied: true, error: null };
    }

    let position: Location.LocationObject;
    try {
      position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch (locationError: unknown) {
      if (locationError instanceof Error) {
        const msg = locationError.message.toLowerCase();
        if (msg.includes('location') || msg.includes('unavailable')) {
          return { ok: false, permissionDenied: true, error: null };
        }
      }
      throw locationError;
    }

    const { latitude, longitude } = position.coords;
    let locationLabel = 'Your area';
    try {
      const geocodePromise = Location.reverseGeocodeAsync({ latitude, longitude });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Geocoding timeout')), 3000),
      );
      const geocode = (await Promise.race([
        geocodePromise,
        timeoutPromise,
      ])) as Location.LocationGeocodedAddress[];
      const place = geocode?.[0];
      if (place) {
        locationLabel = [place.city, place.country].filter(Boolean).join(', ') || 'Your area';
      }
    } catch {
      locationLabel = `Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`;
    }

    const requestUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current_weather=true` +
      `&hourly=weathercode,temperature_2m,relativehumidity_2m` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&timezone=auto&forecast_days=${FORECAST_DAYS}`;
    const response = await fetch(requestUrl);
    if (!response.ok) throw new Error('Unable to fetch weather data');
    const payload = await response.json();
    const snapshot = buildSnapshot(payload, locationLabel, { latitude, longitude });
    await saveWeatherCache(snapshot);
    scheduleWeatherAlertNotification(
      snapshot.currentConditionLabel,
      snapshot.currentTemperature,
    );
    return { ok: true, weather: snapshot };
  } catch (error: unknown) {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('location') || msg.includes('unavailable')) {
        return { ok: false, permissionDenied: true, error: null };
      }
    }
    const cached = await loadWeatherCache();
    if (cached) {
      return {
        ok: false,
        permissionDenied: false,
        error: null,
        weather: cached,
      };
    }
    const errorMessage =
      error instanceof Error && error.message.includes('internet')
        ? 'No internet connection'
        : 'Unable to load weather';
    return { ok: false, permissionDenied: false, error: errorMessage };
  }
}

export type WeatherRange = 'today' | 'week' | 'month';

export function daysForRange(weather: WeatherSnapshot, range: WeatherRange): DailyForecast[] {
  const days = weather.dailyForecast?.length
    ? weather.dailyForecast
    : weather.fiveDayForecast || [];
  if (range === 'today') return days.slice(0, 1);
  if (range === 'week') return days.slice(0, 7);
  return days.slice(0, FORECAST_DAYS);
}

export function buildWeatherAiPrompt(
  weather: WeatherSnapshot,
  range: WeatherRange,
  language = 'English',
): string {
  const days = daysForRange(weather, range);
  const rangeLabel =
    range === 'today' ? 'today' : range === 'week' ? 'the next 7 days' : 'the next 16 days (extended monthly outlook)';

  const dayLines = days
    .map((d) => {
      const precip =
        d.precipitationMm != null ? `, precip ${d.precipitationMm.toFixed(1)} mm` : '';
      return `- ${d.date}: ${d.conditionLabel}, high ${Math.round(d.high)}°C / low ${Math.round(d.low)}°C${precip}`;
    })
    .join('\n');

  return `I am a farmer near ${weather.locationLabel}. Please reply in ${language}.

Current conditions: ${Math.round(weather.currentTemperature)}°C, ${weather.currentConditionLabel}, wind ${Math.round(weather.currentWindspeed)} km/h, humidity ${Math.round(weather.currentHumidity)}%.

I need farm-focused advice for ${rangeLabel}:
${dayLines || '(daily breakdown unavailable)'}

Please advise on:
1. Irrigation and water management
2. Field work timing (planting, spraying, harvesting)
3. Pest and disease risk from this weather
4. Any precautions I should take

Keep advice practical for smallholder farming.`;
}
