import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

import { useAppContext } from '@/context/AppContext';
import { ResultAiActions } from '@/components/ResultAiActions';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { buildSoilSession, soilSuggestions } from '@/utils/aiAdvisor';
import { getLanguageCode, SUPPORTED_LANGUAGES } from '@/constants/languages';
import apiService from '@/services/api';
import { fetchSoilPhFromGps, type SoilPhEstimate } from '@/services/soilGrids';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';

type PhBand = {
  label: string;
  color: string;
};

function bandForPh(value: number): PhBand {
  if (value < 5.5) return { label: 'Acidic', color: '#E65100' };
  if (value <= 7.5) return { label: 'Healthy', color: palette.brandGreen };
  return { label: 'Alkaline', color: '#1565C0' };
}

function formatCoord(value: number, kind: 'lat' | 'lon'): string {
  const abs = Math.abs(value).toFixed(5);
  if (kind === 'lat') return `${abs}° ${value >= 0 ? 'N' : 'S'}`;
  return `${abs}° ${value >= 0 ? 'E' : 'W'}`;
}

function formatReportDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function languageLabel(preferred?: string | null): string {
  const lang = preferred?.trim() || 'English';
  return SUPPORTED_LANGUAGES.includes(lang as (typeof SUPPORTED_LANGUAGES)[number])
    ? lang
    : 'English';
}

function buildAiPrompt(
  ph: number,
  band: PhBand,
  estimate: SoilPhEstimate,
  location: string | null,
  language: string,
) {
  const crops = 'maize, beans, and vegetables';
  const depths = estimate.depths.map((d) => `${d.label}: ${d.mean.toFixed(1)}`).join(', ');
  const coords = `GPS ${formatCoord(estimate.latitude, 'lat')}, ${formatCoord(estimate.longitude, 'lon')}`;
  const place = location ? `Farm location: ${location} (${coords}). ` : `${coords}. `;
  return (
    `${place}Measured soil pH is ${ph.toFixed(1)} (${band.label}). Depth readings: ${depths}. ` +
    `Explain what this pH means, how to improve the soil, and which inputs or amendments fit ${crops}. ` +
    `Use clear short bullet points. Keep it under 180 words. ` +
    `IMPORTANT: Write the entire answer only in ${language}. Do not mix in English` +
    (language === 'English' ? '.' : ' words or headings.')
  );
}

export default function SoilPhScreen() {
  const router = useRouter();
  const { state } = useAppContext();
  const { openSeeded } = useAiAdvisor();
  const abortRef = useRef<AbortController | null>(null);

  const [loading, setLoading] = useState(false);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<SoilPhEstimate | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [contextPrompt, setContextPrompt] = useState<string | null>(null);

  const band = estimate ? bandForPh(estimate.topsoilPh) : null;

  const loadAdvice = useCallback(
    async (result: SoilPhEstimate, place: string | null) => {
      const nextBand = bandForPh(result.topsoilPh);
      const language = languageLabel(state.profile?.preferredLanguage);
      const prompt = buildAiPrompt(result.topsoilPh, nextBand, result, place, language);
      setAdviceLoading(true);
      setAdvice(null);
      setConversationId(null);
      setContextPrompt(prompt);

      const profile = state.profile;
      if (!profile?.id) {
        setAdvice(
          language === 'English'
            ? `Your soil pH is ${result.topsoilPh.toFixed(1)} (${nextBand.label}). Ask the farm advisor for detailed advice after signing in.`
            : `pH ${result.topsoilPh.toFixed(1)} (${nextBand.label}).`,
        );
        setAdviceLoading(false);
        return;
      }

      try {
        const response = await apiService.askQuestion({
          prompt,
          user_id: profile.id,
          target_lang: getLanguageCode(language),
          user_profile: {
            name: profile.name,
            area: profile.area,
            preferred_language: language,
            crops_grown: profile.cropsGrown,
          },
        });
        const text = (response.results || '').trim();
        setAdvice(
          text ||
            `Your soil pH is ${result.topsoilPh.toFixed(1)} (${nextBand.label}). Ask AgriSense AI for more guidance.`,
        );
        if (response.conversation_id) setConversationId(response.conversation_id);
      } catch {
        setAdvice(
          `Your soil pH is ${result.topsoilPh.toFixed(1)} (${nextBand.label}). Could not load AI advice right now — tap Ask AgriSense AI to try again.`,
        );
      } finally {
        setAdviceLoading(false);
      }
    },
    [state.profile],
  );

  const loadFromGps = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setEstimate(null);
    setAdvice(null);
    setConversationId(null);
    setContextPrompt(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        throw new Error('Location permission is required to check soil pH.');
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;

      let label: string | null = null;
      try {
        const places = await Location.reverseGeocodeAsync({ latitude, longitude });
        const place = places[0];
        if (place) {
          label =
            [place.city || place.subregion, place.region, place.country]
              .filter(Boolean)
              .join(', ') || null;
        }
      } catch {
        // coordinates still shown from GPS
      }
      setLocationLabel(label);

      const result = await fetchSoilPhFromGps(latitude, longitude, controller.signal);
      // Guard: never show a result without live numeric pH
      if (!Number.isFinite(result.topsoilPh)) {
        throw new Error('Soil service returned an invalid pH. Try again outdoors.');
      }
      setEstimate(result);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLoading(false);
      void loadAdvice(result, label);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setEstimate(null);
      setError(err?.message || 'Could not read soil for this place.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(false);
    }
  }, [loadAdvice]);

  const openSoilAdvisor = (followUp?: string) => {
    if (!advice || !estimate || !band) return;
    const userContent =
      contextPrompt ||
      `My soil pH is ${estimate.topsoilPh.toFixed(1)} (${band.label}) at ${
        locationLabel || 'my farm'
      } (GPS ${formatCoord(estimate.latitude, 'lat')}, ${formatCoord(estimate.longitude, 'lon')}). Please advise on improving the soil and suitable farm inputs.`;

    const session = buildSoilSession({
      ph: estimate.topsoilPh,
      bandLabel: band.label,
      locationLabel,
      conversationId,
    });

    openSeeded({
      session,
      messages: [
        { role: 'user', modality: 'text', content: userContent },
        { role: 'assistant', modality: 'text', content: advice },
      ],
      followUp,
    });
  };

  const shopSoilInputs = () => {
    router.push({
      pathname: '/(tabs)/marketplace',
      params: {
        mode: 'buy',
        q:
          band?.label === 'Acidic'
            ? 'lime'
            : band?.label === 'Alkaline'
              ? 'sulfur'
              : 'fertilizer',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <MaterialCommunityIcons name="arrow-left" size={22} color={palette.text.primary} />
        </Pressable>
        <Text style={styles.topTitle}>Soil pH</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {!estimate ? (
          <>
            <Text style={styles.headline}>Check soil pH</Text>
            <Text style={styles.sub}>
              Uses your GPS and live SoilGrids data for this spot — no kit needed.
            </Text>

            <View style={styles.card}>
              <Pressable
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={loadFromGps}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Check soil pH with GPS"
              >
                {loading ? (
                  <ActivityIndicator color={palette.white} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="crosshairs-gps" size={20} color={palette.white} />
                    <Text style={styles.primaryBtnText}>Use my location</Text>
                  </>
                )}
              </Pressable>

              {loading ? (
                <Text style={styles.hint}>Reading live soil map for your coordinates…</Text>
              ) : (
                <Text style={styles.hint}>
                  Results come from ISRIC SoilGrids for your exact GPS point.
                </Text>
              )}

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <View style={styles.resultHead}>
              <Text style={styles.headline}>Soil pH report</Text>
              <Pressable onPress={loadFromGps} disabled={loading} hitSlop={8}>
                {loading ? (
                  <ActivityIndicator color={palette.brandGreen} />
                ) : (
                  <MaterialCommunityIcons name="refresh" size={22} color={palette.brandGreen} />
                )}
              </Pressable>
            </View>

            <View style={styles.card}>
              <View style={styles.statRow}>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: band?.color }]}>
                    {estimate.topsoilPh.toFixed(1)}
                  </Text>
                  <Text style={styles.statLabel}>Topsoil pH</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: band?.color, fontSize: 18 }]}>
                    {band?.label}
                  </Text>
                  <Text style={styles.statLabel}>Class</Text>
                </View>
              </View>

              <View style={styles.metaBlock}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Location</Text>
                  <Text style={styles.metaValue}>{locationLabel || 'GPS point'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Latitude</Text>
                  <Text style={styles.metaValue}>{formatCoord(estimate.latitude, 'lat')}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Longitude</Text>
                  <Text style={styles.metaValue}>{formatCoord(estimate.longitude, 'lon')}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Sampled</Text>
                  <Text style={styles.metaValue}>{formatReportDate(estimate.fetchedAt)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Source</Text>
                  <Text style={styles.metaValue}>SoilGrids (live) · pH in H₂O</Text>
                </View>
                {estimate.sampledNearby ? (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Note</Text>
                    <Text style={styles.metaValue}>
                      Nearby map cell used
                      {` · ${formatCoord(estimate.sampleLatitude, 'lat')}, ${formatCoord(estimate.sampleLongitude, 'lon')}`}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.sectionLabel}>By depth</Text>
              {estimate.depths.map((d) => (
                <View key={d.label} style={styles.depthRow}>
                  <Text style={styles.depthLabel}>{d.label}</Text>
                  <Text style={styles.depthPh}>{d.mean.toFixed(1)}</Text>
                  <Text style={styles.depthRange}>
                    {d.q05 != null && d.q95 != null
                      ? `${d.q05.toFixed(1)}–${d.q95.toFixed(1)}`
                      : '—'}
                  </Text>
                </View>
              ))}

              <Text style={styles.footerNote}>
                Live estimate for field guidance. Ideal crop range is about 5.5–7.5.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Recommendations</Text>
              {adviceLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={palette.brandGreen} />
                  <Text style={styles.hint}>Preparing advice…</Text>
                </View>
              ) : (
                <Text style={styles.adviceBody}>{advice}</Text>
              )}
            </View>

            {advice && !adviceLoading ? (
              <ResultAiActions
                onAskAi={() => openSoilAdvisor()}
                onShop={shopSoilInputs}
                shopLabel="Shop farm inputs"
                suggestions={soilSuggestions(band?.label || 'Healthy')}
                onSuggestion={(q) => openSoilAdvisor(q)}
              />
            ) : (
              <Pressable style={styles.secondaryBtn} onPress={shopSoilInputs}>
                <MaterialCommunityIcons
                  name="storefront-outline"
                  size={20}
                  color={palette.brandGreenDark}
                />
                <Text style={styles.secondaryBtnText}>Shop farm inputs</Text>
              </Pressable>
            )}

            <Pressable style={styles.textBtn} onPress={loadFromGps} disabled={loading}>
              <Text style={styles.textBtnLabel}>Check again</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.surface.screen },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: Fonts.bold, fontSize: 17, color: palette.text.primary },
  body: { paddingHorizontal: spacing.lg, paddingBottom: 40, paddingTop: spacing.sm },
  headline: { fontFamily: Fonts.bold, fontSize: 22, color: palette.text.primary },
  sub: {
    marginTop: 8,
    marginBottom: spacing.lg,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: palette.text.muted,
  },
  resultHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border.card,
    padding: spacing.lg,
    gap: 12,
    marginBottom: spacing.md,
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
  btnDisabled: { opacity: 0.6 },
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
  textBtn: { alignItems: 'center', paddingVertical: 12 },
  textBtnLabel: { fontFamily: Fonts.semiBold, fontSize: 14, color: palette.text.secondary },
  hint: { fontFamily: Fonts.regular, fontSize: 13, color: palette.text.muted, lineHeight: 18 },
  errorBox: {
    backgroundColor: palette.ui.errorBg,
    borderColor: palette.ui.errorBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  errorText: { fontFamily: Fonts.medium, fontSize: 13, color: palette.ui.errorText },
  statRow: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1,
    backgroundColor: palette.tint[50],
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: { fontFamily: Fonts.bold, fontSize: 28, color: palette.brandGreenDark },
  statLabel: { fontFamily: Fonts.regular, fontSize: 11, color: palette.text.muted, marginTop: 2 },
  metaBlock: { gap: 8, marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 10 },
  metaLabel: {
    width: 88,
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: palette.text.muted,
  },
  metaValue: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: palette.text.primary,
    lineHeight: 18,
  },
  sectionLabel: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: palette.text.primary,
    marginTop: 4,
  },
  depthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.light,
  },
  depthLabel: { flex: 1.1, fontFamily: Fonts.regular, fontSize: 13, color: palette.text.muted },
  depthPh: {
    flex: 0.7,
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: palette.text.primary,
    textAlign: 'center',
  },
  depthRange: {
    flex: 1.1,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: palette.text.secondary,
    textAlign: 'right',
  },
  footerNote: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: palette.text.tertiary,
    lineHeight: 16,
    marginTop: 4,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  adviceBody: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: palette.text.secondary,
  },
});
