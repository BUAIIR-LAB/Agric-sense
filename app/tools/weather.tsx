import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { useAppContext } from '@/context/AppContext';
import { ResultAiActions } from '@/components/ResultAiActions';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import {
  buildWeatherAiPrompt,
  daysForRange,
  fetchWeatherSnapshot,
  loadWeatherCache,
  type WeatherRange,
  type WeatherSnapshot,
} from '@/services/weather';
import { buildWeatherSession, weatherSuggestions } from '@/utils/aiAdvisor';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { elevation } from '@/theme/elevation';
import { radius, spacing } from '@/theme/spacing';

const RANGE_TABS: { key: WeatherRange; label: string; hint: string }[] = [
  { key: 'today', label: 'Today', hint: 'Current & hourly' },
  { key: 'week', label: '7 days', hint: 'This week' },
  { key: 'month', label: '16 days', hint: 'Extended outlook' },
];

function languageLabel(preferred?: string | null) {
  return preferred?.trim() || 'English';
}

export default function WeatherScreen() {
  const router = useRouter();
  const { state } = useAppContext();
  const { openAutoSend } = useAiAdvisor();
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<WeatherRange>('today');

  const applyResult = (result: Awaited<ReturnType<typeof fetchWeatherSnapshot>>) => {
    if (result.ok) {
      setWeather(result.weather);
      setError(null);
      setPermissionDenied(false);
      return;
    }
    if (result.permissionDenied) {
      setPermissionDenied(true);
      setError(null);
      return;
    }
    if (result.weather) {
      setWeather(result.weather);
      setError(null);
      return;
    }
    setError(result.error);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED) {
      const cached = await loadWeatherCache();
      if (cached) setWeather(cached);
    }
    const result = await fetchWeatherSnapshot();
    applyResult(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    const result = await fetchWeatherSnapshot();
    applyResult(result);
    setRefreshing(false);
  };

  const forecastDays = useMemo(
    () => (weather ? daysForRange(weather, range) : []),
    [weather, range],
  );

  const askAgriSenseAi = (followUp?: string) => {
    if (!weather) return;
    const language = languageLabel(state.profile?.preferredLanguage);
    const base = buildWeatherAiPrompt(weather, range, language);
    const prompt = followUp ? `${base}\n\nFollow-up question: ${followUp}` : base;
    const session = buildWeatherSession({ weather, range });
    openAutoSend({ session, prompt });
  };

  const shopInputs = () => {
    router.push({
      pathname: '/(tabs)/marketplace',
      params: { mode: 'buy' },
    });
  };

  const renderDayRow = (day: (typeof forecastDays)[number], index: number) => {
    const isToday = index === 0 && range !== 'today';
    const label = new Date(day.date).toLocaleDateString('en-US', {
      weekday: range === 'month' ? 'short' : 'short',
      month: range === 'month' ? 'short' : undefined,
      day: range === 'month' ? 'numeric' : undefined,
    });
    return (
      <View key={`${day.date}-${index}`} style={styles.dayRow}>
        <Text style={styles.dayLabel} numberOfLines={1}>
          {isToday ? 'Today' : label}
        </Text>
        <MaterialCommunityIcons name={day.conditionIcon} size={26} color={palette.white} />
        <View style={styles.dayMid}>
          <Text style={styles.dayCond} numberOfLines={1}>
            {day.conditionLabel}
          </Text>
          {day.precipitationMm != null && day.precipitationMm > 0 ? (
            <Text style={styles.dayPrecip}>{day.precipitationMm.toFixed(1)} mm</Text>
          ) : null}
        </View>
        <Text style={styles.dayHigh}>{Math.round(day.high)}°</Text>
        <Text style={styles.dayLow}>{Math.round(day.low)}°</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={palette.text.primary} />
        </Pressable>
        <Text style={styles.topTitle}>Weather</Text>
        <View style={{ width: 40 }} />
      </View>

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
        {permissionDenied ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="map-marker-off" size={40} color={palette.gray400} />
            <Text style={styles.stateTitle}>Location needed</Text>
            <Text style={styles.stateBody}>
              Allow location access to load local farm weather and forecasts.
            </Text>
            <Pressable style={styles.primaryBtn} onPress={() => void load()}>
              <Text style={styles.primaryBtnText}>Enable location</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.headline}>Farm weather</Text>
            <Text style={styles.sub}>
              Choose a forecast range, then ask AgriSense AI for irrigation and field-work advice.
            </Text>

            <View style={styles.rangeRow}>
              {RANGE_TABS.map((tab) => {
                const active = range === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    style={[styles.rangeChip, active && styles.rangeChipActive]}
                    onPress={() => setRange(tab.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${tab.label} forecast`}
                  >
                    <Text style={[styles.rangeLabel, active && styles.rangeLabelActive]}>
                      {tab.label}
                    </Text>
                    <Text style={[styles.rangeHint, active && styles.rangeHintActive]}>
                      {tab.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <LinearGradient
              colors={['#163d1a', '#1e5224', '#163d1a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.weatherCard}
            >
              {loading && !weather ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={palette.white} />
                  <Text style={styles.loadingText}>Loading forecast…</Text>
                </View>
              ) : error && !weather ? (
                <View style={styles.centered}>
                  <MaterialCommunityIcons name="wifi-off" size={48} color={palette.white} />
                  <Text style={styles.errorTitle}>Connection issue</Text>
                  <Text style={styles.errorBody}>{error}</Text>
                  <Pressable style={styles.retryGhost} onPress={() => void load()}>
                    <Text style={styles.retryGhostText}>Try again</Text>
                  </Pressable>
                </View>
              ) : weather ? (
                <>
                  <View style={styles.weatherHeader}>
                    <View style={styles.locationRow}>
                      <MaterialCommunityIcons name="map-marker" size={18} color={palette.white} />
                      <Text style={styles.locationText} numberOfLines={1}>
                        {weather.locationLabel}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.refreshBtn}
                      onPress={() => void onRefresh()}
                      accessibilityLabel="Refresh weather"
                    >
                      <MaterialCommunityIcons name="refresh" size={18} color={palette.white} />
                    </Pressable>
                  </View>

                  {range === 'today' ? (
                    <View style={styles.daily}>
                      <MaterialCommunityIcons
                        name={weather.currentConditionIcon}
                        size={56}
                        color={palette.white}
                      />
                      <Text style={styles.temp}>{Math.round(weather.currentTemperature)}°</Text>
                      <Text style={styles.condition}>{weather.currentConditionLabel}</Text>
                      <View style={styles.metrics}>
                        <View style={styles.metric}>
                          <Text style={styles.metricLabel}>High/Low</Text>
                          <Text style={styles.metricValue}>
                            {Math.round(weather.todayHigh ?? 0)}°/
                            {Math.round(weather.todayLow ?? 0)}°
                          </Text>
                        </View>
                        <View style={styles.metric}>
                          <Text style={styles.metricLabel}>Wind</Text>
                          <Text style={styles.metricValue}>
                            {Math.round(weather.currentWindspeed)} km/h
                          </Text>
                        </View>
                        <View style={styles.metric}>
                          <Text style={styles.metricLabel}>Humidity</Text>
                          <Text style={styles.metricValue}>
                            {Math.round(weather.currentHumidity)}%
                          </Text>
                        </View>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.hourlyScroll}
                      >
                        {weather.hourlyForecast.map((hour, index) => (
                          <View key={`${hour.time}-${index}`} style={styles.hourlyItem}>
                            <Text style={styles.hourlyTime}>
                              {new Date(hour.time).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                hour12: true,
                              })}
                            </Text>
                            <MaterialCommunityIcons
                              name={hour.conditionIcon}
                              size={28}
                              color={palette.white}
                            />
                            <Text style={styles.hourlyTemp}>
                              {Math.round(hour.temperature)}°
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  ) : (
                    <View style={styles.weekly}>
                      <Text style={styles.rangeCaption}>
                        {range === 'week'
                          ? '7-day farm outlook'
                          : 'Extended 16-day outlook (best available free forecast)'}
                      </Text>
                      {forecastDays.map(renderDayRow)}
                    </View>
                  )}
                </>
              ) : null}
            </LinearGradient>

            {weather && !loading ? (
              <ResultAiActions
                onAskAi={() => askAgriSenseAi()}
                onShop={shopInputs}
                shopLabel="Shop farm inputs"
                suggestions={weatherSuggestions(range)}
                onSuggestion={(q) => askAgriSenseAi(q)}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.surface.screen },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontFamily: Fonts.bold,
    fontSize: 17,
    color: palette.text.primary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headline: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: palette.text.primary,
  },
  sub: {
    marginTop: 8,
    marginBottom: spacing.md,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: palette.text.muted,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  rangeChip: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border.card,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  rangeChipActive: {
    backgroundColor: palette.brandGreen,
    borderColor: palette.brandGreen,
  },
  rangeLabel: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: palette.text.primary,
  },
  rangeLabelActive: { color: palette.white },
  rangeHint: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: palette.text.muted,
    textAlign: 'center',
  },
  rangeHintActive: { color: 'rgba(255,255,255,0.85)' },
  weatherCard: {
    borderRadius: 24,
    padding: spacing.xl,
    minHeight: 320,
    ...elevation.high,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: Fonts.medium,
    color: palette.white,
    marginTop: spacing.sm,
  },
  errorTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: palette.white,
  },
  errorBody: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  retryGhost: {
    marginTop: spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  retryGhostText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.white,
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  locationText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.white,
    flex: 1,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  daily: { alignItems: 'center', gap: spacing.sm },
  temp: {
    fontFamily: Fonts.bold,
    fontSize: 64,
    color: palette.white,
    lineHeight: 72,
  },
  condition: {
    fontFamily: Fonts.medium,
    fontSize: 18,
    color: 'rgba(255,255,255,0.92)',
  },
  metrics: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  metric: { alignItems: 'center', flex: 1 },
  metricLabel: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  metricValue: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: palette.white,
    marginTop: 4,
  },
  hourlyScroll: { gap: 14, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  hourlyItem: { alignItems: 'center', gap: 6, width: 64 },
  hourlyTime: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  hourlyTemp: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.white,
  },
  weekly: { gap: 10 },
  rangeCaption: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  dayLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: palette.white,
    width: 72,
  },
  dayMid: { flex: 1, minWidth: 0 },
  dayCond: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  dayPrecip: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  dayHigh: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: palette.white,
  },
  dayLow: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    width: 36,
    textAlign: 'right',
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.brandGreen,
    borderRadius: radius.md,
    paddingVertical: 14,
    minHeight: 50,
  },
  primaryBtnText: { fontFamily: Fonts.bold, fontSize: 15, color: palette.white },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.tint[100],
    borderRadius: radius.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.border.green,
  },
  secondaryBtnText: { fontFamily: Fonts.bold, fontSize: 15, color: palette.brandGreenDark },
  stateCard: {
    backgroundColor: palette.white,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border.card,
  },
  stateTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: palette.charcoal,
  },
  stateBody: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: palette.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
});
