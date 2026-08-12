import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { buildYieldSession, mixedYieldSuggestions, yieldSuggestions } from '@/utils/aiAdvisor';
import { getLanguageCode, SUPPORTED_LANGUAGES } from '@/constants/languages';
import apiService from '@/services/api';
import { fetchFieldNdvi, type SatelliteNdviResult } from '@/services/satelliteNdvi';
import {
  buildYieldEstimateAiPrompt,
  computeYieldEstimate,
  CROPPING_PATTERN_LABELS,
  earliestPlantingDate,
  isMixedYieldResult,
  MIXED_CROP_PRESETS,
  YIELD_CROPS,
  type CropRole,
  type CroppingPattern,
  type FarmerYieldInputs,
  type FertilizerLevel,
  type FieldMode,
  type WaterRegime,
  type YieldCropId,
  type YieldRunResult,
} from '@/services/yieldEstimate';
import {
  distanceMeters,
  polygonAreaSquareMeters,
  squareMetersToAcres,
  type LatLng,
} from '@/utils/geo';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';

type Step = 'map' | 'details' | 'estimating' | 'result';

const MIN_POINTS = 4;
const MIN_POINT_SPACING_M = 6;

const MAX_MIXED_CROPS = 5;

type MixedCropRow = {
  id: string;
  cropId: YieldCropId;
  sharePercent: string;
  plantingDate: string;
  previousYield: string;
  role: CropRole;
};

let mixedRowSeq = 0;
function newMixedRow(partial?: Partial<MixedCropRow>): MixedCropRow {
  mixedRowSeq += 1;
  return {
    id: `mc-${mixedRowSeq}`,
    cropId: 'maize',
    sharePercent: '50',
    plantingDate: '',
    previousYield: '',
    role: 'companion',
    ...partial,
  };
}

function languageLabel(preferred?: string | null): string {
  const lang = preferred?.trim() || 'English';
  return SUPPORTED_LANGUAGES.includes(lang as (typeof SUPPORTED_LANGUAGES)[number])
    ? lang
    : 'English';
}

function parseShareSum(rows: MixedCropRow[]): number {
  return rows.reduce((s, r) => s + (Number.parseFloat(r.sharePercent) || 0), 0);
}

export default function YieldScreen() {
  const router = useRouter();
  const { state } = useAppContext();
  const { openSeeded } = useAiAdvisor();
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [step, setStep] = useState<Step>('map');
  const [points, setPoints] = useState<LatLng[]>([]);
  const [mapping, setMapping] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);

  const [fieldMode, setFieldMode] = useState<FieldMode>('single');
  const [croppingPattern, setCroppingPattern] = useState<CroppingPattern>('intercrop');
  const [mixedRows, setMixedRows] = useState<MixedCropRow[]>(() => [
    newMixedRow({ cropId: 'maize', sharePercent: '60', role: 'main' }),
    newMixedRow({ cropId: 'beans', sharePercent: '40', role: 'companion' }),
  ]);
  const [fieldNotes, setFieldNotes] = useState('');

  const [cropId, setCropId] = useState<YieldCropId>('maize');
  const [plantingDate, setPlantingDate] = useState('');
  const [fertilizer, setFertilizer] = useState<FertilizerLevel>('some');
  const [water, setWater] = useState<WaterRegime>('rainfed');
  const [previousYield, setPreviousYield] = useState('');
  const [manualAcres, setManualAcres] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [estimate, setEstimate] = useState<YieldRunResult | null>(null);
  const [lastInputs, setLastInputs] = useState<FarmerYieldInputs | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [yieldConversationId, setYieldConversationId] = useState<string | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateStatus, setEstimateStatus] = useState('Preparing…');

  const shareSum = useMemo(() => parseShareSum(mixedRows), [mixedRows]);

  const mappedAcres = useMemo(() => {
    if (points.length < 3) return 0;
    return squareMetersToAcres(polygonAreaSquareMeters(points));
  }, [points]);

  const stopWatching = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
    setMapping(false);
  }, []);

  useEffect(() => () => {
    stopWatching();
    abortRef.current?.abort();
  }, [stopWatching]);

  const addPointIfUseful = useCallback((next: LatLng, accuracy?: number | null) => {
    setAccuracyM(typeof accuracy === 'number' ? accuracy : null);
    setPoints((prev) => {
      if (prev.length === 0) return [next];
      const last = prev[prev.length - 1];
      if (distanceMeters(last, next) < MIN_POINT_SPACING_M) return prev;
      return [...prev, next];
    });
  }, []);

  const startMapping = async () => {
    setMapError(null);
    setPoints([]);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        setMapError('Location permission is required to map your field.');
        return;
      }

      setMapping(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      addPointIfUseful(
        { latitude: current.coords.latitude, longitude: current.coords.longitude },
        current.coords.accuracy,
      );

      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1500,
          distanceInterval: MIN_POINT_SPACING_M,
        },
        (pos) => {
          addPointIfUseful(
            { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
            pos.coords.accuracy,
          );
        },
      );
    } catch (err: any) {
      setMapping(false);
      setMapError(err?.message || 'Could not start GPS mapping.');
    }
  };

  const finishMapping = () => {
    stopWatching();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (points.length < MIN_POINTS) {
      setMapError(`Walk more of the boundary — need at least ${MIN_POINTS} GPS points.`);
      return;
    }
    setStep('details');
  };

  const skipMapping = () => {
    stopWatching();
    setPoints([]);
    setStep('details');
  };

  const buildInputsFromForm = (): FarmerYieldInputs => {
    const acresNum = Number.parseFloat(manualAcres.replace(',', '.'));
    const base: FarmerYieldInputs = {
      fieldMode,
      cropId,
      fertilizer,
      water,
      manualAcres: Number.isFinite(acresNum) && acresNum > 0 ? acresNum : undefined,
      croppingPattern: fieldMode === 'mixed' ? croppingPattern : undefined,
      fieldNotes: fieldNotes.trim() || undefined,
    };

    if (fieldMode === 'single') {
      return {
        ...base,
        plantingDate: plantingDate.trim() || undefined,
        previousYieldKg: previousYield.trim()
          ? Number.parseFloat(previousYield.replace(/,/g, ''))
          : undefined,
      };
    }

    return {
      ...base,
      mixedCrops: mixedRows.map((row) => ({
        cropId: row.cropId,
        areaSharePercent: Number.parseFloat(row.sharePercent) || 0,
        role: row.role,
        plantingDate: row.plantingDate.trim() || undefined,
        previousYieldKg: row.previousYield.trim()
          ? Number.parseFloat(row.previousYield.replace(/,/g, ''))
          : undefined,
      })),
    };
  };

  const fetchAiAdvice = async (result: YieldRunResult, inputs: FarmerYieldInputs) => {
    const profile = state.profile;
    if (!profile?.id) return;
    const language = languageLabel(profile.preferredLanguage);
    const prompt = buildYieldEstimateAiPrompt({
      result,
      inputs,
      language,
      gpsPointsCount: points.length,
    });
    try {
      const response = await apiService.askQuestion({
        prompt,
        user_id: profile.id,
        target_lang: getLanguageCode(language),
        user_profile: {
          name: profile.name,
          area: profile.area,
          crops_grown: profile.cropsGrown,
          preferred_language: profile.preferredLanguage,
        },
      });
      setAiAdvice((response.results || '').trim() || null);
      if (response.conversation_id) setYieldConversationId(response.conversation_id);
    } catch {
      setAiAdvice(null);
    }
  };

  const runEstimate = async () => {
    setFormError(null);
    const hasGps = points.length >= 3;
    const acresNum = Number.parseFloat(manualAcres.replace(',', '.'));
    if (!hasGps && !(Number.isFinite(acresNum) && acresNum > 0)) {
      setFormError('Map the field or enter area in acres.');
      return;
    }

    if (fieldMode === 'mixed') {
      if (mixedRows.length < 2) {
        setFormError('Add at least 2 crops for mixed cropping.');
        return;
      }
      if (mixedRows.length > MAX_MIXED_CROPS) {
        setFormError(`Maximum ${MAX_MIXED_CROPS} crops in one mix.`);
        return;
      }
      if (Math.abs(shareSum - 100) > 0.5) {
        setFormError(`Crop shares must total 100% (currently ${Math.round(shareSum)}%).`);
        return;
      }
    }

    const inputs = buildInputsFromForm();
    setLastInputs(inputs);
    setStep('estimating');
    setEstimateError(null);
    setEstimate(null);
    setAiAdvice(null);
    setYieldConversationId(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let sat: SatelliteNdviResult | null = null;
    try {
      if (hasGps) {
        setEstimateStatus('Searching Sentinel-2 scenes…');
        sat = await fetchFieldNdvi(
          points,
          earliestPlantingDate(inputs),
          controller.signal,
        );
        setEstimateStatus('Computing baseline from NDVI + farm data…');
      } else {
        setEstimateStatus('Computing baseline from farm data…');
      }

      const result = computeYieldEstimate({
        points: hasGps ? points : undefined,
        inputs,
        satellite: sat,
      });
      setEstimate(result);

      setEstimateStatus('AgriSense AI is refining your harvest estimate…');
      await fetchAiAdvice(result, inputs);

      setStep('result');
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      try {
        setEstimateStatus('Satellite unavailable — using area + farm data…');
        const result = computeYieldEstimate({
          points: hasGps ? points : undefined,
          inputs,
          satellite: null,
        });
        setEstimate(result);
        setEstimateError(err?.message || 'Satellite NDVI unavailable.');
        setEstimateStatus('AgriSense AI is refining your harvest estimate…');
        await fetchAiAdvice(result, inputs);
        setStep('result');
      } catch (inner: any) {
        setEstimateError(inner?.message || err?.message || 'Estimate failed.');
        setStep('details');
      }
    }
  };

  const cropLabelForSession = (result: YieldRunResult): string => {
    if (isMixedYieldResult(result)) {
      return result.lines.map((l) => l.crop.label).join(' + ');
    }
    return result.crop.label;
  };

  const ndviSummaryForSession = (result: YieldRunResult): string | undefined => {
    if (!result.satellite) return undefined;
    return `NDVI ${result.satellite.peakNdvi.toFixed(2)}`;
  };

  const askAiAboutYield = (followUp?: string) => {
    if (!estimate || !lastInputs) return;
    const language = languageLabel(state.profile?.preferredLanguage);
    const basePrompt = buildYieldEstimateAiPrompt({
      result: estimate,
      inputs: lastInputs,
      language,
      gpsPointsCount: points.length,
    });

    const session = buildYieldSession({
      cropLabel: cropLabelForSession(estimate),
      acres: estimate.acres,
      expectedYield: `${estimate.lowKg.toLocaleString()}–${estimate.highKg.toLocaleString()} kg`,
      conversationId: yieldConversationId,
      isMixed: isMixedYieldResult(estimate),
      ndviSummary: ndviSummaryForSession(estimate),
    });

    const userContent = basePrompt;
    const assistantContent =
      aiAdvice ||
      `Baseline estimate: ${estimate.lowKg.toLocaleString()}–${estimate.highKg.toLocaleString()} kg for ${estimate.acres} acres.`;

    openSeeded({
      session,
      messages: [
        { role: 'user', modality: 'text', content: userContent },
        { role: 'assistant', modality: 'text', content: assistantContent },
      ],
      followUp,
    });
  };

  const applyPreset = (index: number) => {
    const preset = MIXED_CROP_PRESETS[index];
    if (!preset) return;
    setCroppingPattern(preset.pattern);
    setMixedRows(
      preset.crops.map((c) =>
        newMixedRow({
          cropId: c.cropId,
          sharePercent: String(c.sharePercent),
          role: c.role,
        }),
      ),
    );
    setFieldMode('mixed');
  };

  const updateMixedRow = (id: string, patch: Partial<MixedCropRow>) => {
    setMixedRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addMixedRow = () => {
    if (mixedRows.length >= MAX_MIXED_CROPS) return;
    setMixedRows((rows) => [...rows, newMixedRow({ sharePercent: '0', role: 'companion' })]);
  };

  const removeMixedRow = (id: string) => {
    if (mixedRows.length <= 2) return;
    setMixedRows((rows) => rows.filter((r) => r.id !== id));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (step === 'details') setStep('map');
            else if (step === 'result') setStep('details');
            else router.back();
          }}
          style={styles.backBtn}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={palette.text.primary} />
        </Pressable>
        <Text style={styles.topTitle}>Yield estimate</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.stepsRow}>
        {(['map', 'details', 'result'] as const).map((s, i) => {
          const active = step === s || (step === 'estimating' && s === 'result');
          const done =
            (s === 'map' && (step === 'details' || step === 'estimating' || step === 'result')) ||
            (s === 'details' && (step === 'estimating' || step === 'result'));
          return (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, (active || done) && styles.stepDotOn]}>
                <Text style={[styles.stepNum, (active || done) && styles.stepNumOn]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepLabel, active && styles.stepLabelOn]}>
                {s === 'map' ? 'Map' : s === 'details' ? 'Details' : 'Result'}
              </Text>
            </View>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 'map' && (
          <>
            <Text style={styles.headline}>Map your field</Text>
            <Text style={styles.sub}>
              Walk the boundary once. We record GPS points, compute area, then pull Sentinel-2 NDVI for that polygon.
            </Text>

            <View style={styles.mapCard}>
              <View style={styles.statRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{points.length}</Text>
                  <Text style={styles.statLabel}>GPS points</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{mappedAcres.toFixed(2)}</Text>
                  <Text style={styles.statLabel}>acres</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {accuracyM != null ? `±${Math.round(accuracyM)}` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>m accuracy</Text>
                </View>
              </View>

              {mapping ? (
                <View style={styles.liveRow}>
                  <ActivityIndicator color={palette.brandGreen} />
                  <Text style={styles.liveText}>Recording — walk the edge slowly</Text>
                </View>
              ) : (
                <Text style={styles.hint}>
                  Start outside a corner, walk the full perimeter, then finish.
                </Text>
              )}

              {mapError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{mapError}</Text>
                </View>
              ) : null}

              {!mapping ? (
                <Pressable style={styles.primaryBtn} onPress={startMapping}>
                  <MaterialCommunityIcons name="walk" size={20} color={palette.white} />
                  <Text style={styles.primaryBtnText}>
                    {points.length ? 'Remap field' : 'Start walking'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.primaryBtn, points.length < MIN_POINTS && styles.btnDisabled]}
                  onPress={finishMapping}
                  disabled={points.length < MIN_POINTS}
                >
                  <MaterialCommunityIcons name="check-circle" size={20} color={palette.white} />
                  <Text style={styles.primaryBtnText}>Finish boundary</Text>
                </Pressable>
              )}

              {mapping ? (
                <Pressable style={styles.textBtn} onPress={stopWatching}>
                  <Text style={styles.textBtnLabel}>Pause mapping</Text>
                </Pressable>
              ) : null}

              <Pressable style={styles.textBtn} onPress={skipMapping}>
                <Text style={styles.textBtnLabel}>Skip — enter area manually</Text>
              </Pressable>
            </View>
          </>
        )}

        {step === 'details' && (
          <>
            <Text style={styles.headline}>Farm details</Text>
            <Text style={styles.sub}>
              Map your field, then tell us what you grow. AgriSense AI uses satellite NDVI plus your
              inputs for the estimate.
            </Text>

            {points.length >= 3 ? (
              <Text style={styles.banner}>
                Mapped {mappedAcres.toFixed(2)} acres · {points.length} points
              </Text>
            ) : (
              <>
                <Text style={styles.label}>Field area (acres) *</Text>
                <TextInput
                  style={styles.input}
                  value={manualAcres}
                  onChangeText={setManualAcres}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 1.5"
                  placeholderTextColor={palette.text.tertiary}
                />
              </>
            )}

            <Text style={styles.label}>Field type *</Text>
            <View style={styles.chipWrap}>
              {([
                { v: 'single' as const, t: 'Single crop' },
                { v: 'mixed' as const, t: 'Mixed cropping' },
              ]).map((o) => (
                <Pressable
                  key={o.v}
                  onPress={() => setFieldMode(o.v)}
                  style={[styles.chip, fieldMode === o.v && styles.chipOn]}
                >
                  <Text style={[styles.chipText, fieldMode === o.v && styles.chipTextOn]}>{o.t}</Text>
                </Pressable>
              ))}
            </View>

            {fieldMode === 'single' ? (
              <>
                <Text style={styles.label}>Crop *</Text>
                <View style={styles.chipWrap}>
                  {YIELD_CROPS.map((c) => {
                    const active = cropId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setCropId(c.id)}
                        style={[styles.chip, active && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextOn]}>{c.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.label}>Planting date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={plantingDate}
                  onChangeText={setPlantingDate}
                  placeholder="e.g. 2026-03-15"
                  placeholderTextColor={palette.text.tertiary}
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Previous harvest on this field (kg, optional)</Text>
                <TextInput
                  style={styles.input}
                  value={previousYield}
                  onChangeText={setPreviousYield}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 1500"
                  placeholderTextColor={palette.text.tertiary}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Cropping pattern *</Text>
                <View style={styles.chipWrap}>
                  {(Object.keys(CROPPING_PATTERN_LABELS) as CroppingPattern[]).map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setCroppingPattern(p)}
                      style={[styles.chip, croppingPattern === p && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, croppingPattern === p && styles.chipTextOn]}>
                        {CROPPING_PATTERN_LABELS[p]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Quick presets</Text>
                <View style={styles.chipWrap}>
                  {MIXED_CROP_PRESETS.map((preset, i) => (
                    <Pressable key={preset.label} style={styles.chip} onPress={() => applyPreset(i)}>
                      <Text style={styles.chipText}>{preset.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.shareRow}>
                  <Text style={styles.label}>Crops in the mix *</Text>
                  <Text
                    style={[
                      styles.shareBadge,
                      Math.abs(shareSum - 100) > 0.5 && styles.shareBadgeWarn,
                    ]}
                  >
                    {Math.round(shareSum)}% / 100%
                  </Text>
                </View>

                {mixedRows.map((row, index) => (
                  <View key={row.id} style={styles.mixedCard}>
                    <View style={styles.mixedCardHead}>
                      <Text style={styles.mixedCardTitle}>Crop {index + 1}</Text>
                      {mixedRows.length > 2 ? (
                        <Pressable onPress={() => removeMixedRow(row.id)} hitSlop={8}>
                          <MaterialCommunityIcons name="close" size={18} color={palette.text.muted} />
                        </Pressable>
                      ) : null}
                    </View>

                    <View style={styles.chipWrap}>
                      {YIELD_CROPS.map((c) => (
                        <Pressable
                          key={c.id}
                          onPress={() => updateMixedRow(row.id, { cropId: c.id })}
                          style={[styles.chip, row.cropId === c.id && styles.chipOn]}
                        >
                          <Text style={[styles.chipText, row.cropId === c.id && styles.chipTextOn]}>
                            {c.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={styles.miniLabel}>Share of field (%)</Text>
                    <TextInput
                      style={styles.input}
                      value={row.sharePercent}
                      onChangeText={(v) => updateMixedRow(row.id, { sharePercent: v })}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 40"
                      placeholderTextColor={palette.text.tertiary}
                    />

                    <Text style={styles.miniLabel}>Role</Text>
                    <View style={styles.chipWrap}>
                      {([
                        { v: 'main' as const, t: 'Main' },
                        { v: 'companion' as const, t: 'Companion' },
                        { v: 'relay' as const, t: 'Relay' },
                      ]).map((o) => (
                        <Pressable
                          key={o.v}
                          onPress={() => updateMixedRow(row.id, { role: o.v })}
                          style={[styles.chip, row.role === o.v && styles.chipOn]}
                        >
                          <Text style={[styles.chipText, row.role === o.v && styles.chipTextOn]}>
                            {o.t}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={styles.miniLabel}>Planted (YYYY-MM-DD, optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={row.plantingDate}
                      onChangeText={(v) => updateMixedRow(row.id, { plantingDate: v })}
                      placeholder="e.g. 2026-03-15"
                      placeholderTextColor={palette.text.tertiary}
                      autoCapitalize="none"
                    />

                    <Text style={styles.miniLabel}>Last harvest this crop (kg, optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={row.previousYield}
                      onChangeText={(v) => updateMixedRow(row.id, { previousYield: v })}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 200"
                      placeholderTextColor={palette.text.tertiary}
                    />
                  </View>
                ))}

                {mixedRows.length < MAX_MIXED_CROPS ? (
                  <Pressable style={styles.addCropBtn} onPress={addMixedRow}>
                    <MaterialCommunityIcons name="plus" size={18} color={palette.brandGreen} />
                    <Text style={styles.addCropText}>Add crop</Text>
                  </Pressable>
                ) : null}
              </>
            )}

            <Text style={styles.label}>Fertilizer use</Text>
            <View style={styles.chipWrap}>
              {([
                { v: 'none' as const, t: 'None' },
                { v: 'some' as const, t: 'Some' },
                { v: 'good' as const, t: 'Good' },
              ]).map((o) => (
                <Pressable
                  key={o.v}
                  onPress={() => setFertilizer(o.v)}
                  style={[styles.chip, fertilizer === o.v && styles.chipOn]}
                >
                  <Text style={[styles.chipText, fertilizer === o.v && styles.chipTextOn]}>{o.t}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Water</Text>
            <View style={styles.chipWrap}>
              {([
                { v: 'rainfed' as const, t: 'Rainfed' },
                { v: 'irrigated' as const, t: 'Irrigated' },
              ]).map((o) => (
                <Pressable
                  key={o.v}
                  onPress={() => setWater(o.v)}
                  style={[styles.chip, water === o.v && styles.chipOn]}
                >
                  <Text style={[styles.chipText, water === o.v && styles.chipTextOn]}>{o.t}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Field notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={fieldNotes}
              onChangeText={setFieldNotes}
              placeholder="e.g. beans planted between maize rows"
              placeholderTextColor={palette.text.tertiary}
              multiline
            />

            {formError || estimateError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{formError || estimateError}</Text>
              </View>
            ) : null}

            <Pressable style={styles.primaryBtn} onPress={runEstimate}>
              <MaterialCommunityIcons name="satellite-variant" size={20} color={palette.white} />
              <Text style={styles.primaryBtnText}>
                {points.length >= 3 ? 'Estimate with satellite + AI' : 'Estimate yield with AI'}
              </Text>
            </Pressable>
          </>
        )}

        {step === 'estimating' && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={palette.brandGreen} />
            <Text style={styles.loadingTitle}>Analyzing field</Text>
            <Text style={styles.loadingSub}>{estimateStatus}</Text>
          </View>
        )}

        {step === 'result' && estimate && (
          <>
            <Text style={styles.headline}>
              {isMixedYieldResult(estimate) ? 'Mixed field estimate' : 'Estimated yield'}
            </Text>
            <Text style={styles.sub}>
              {isMixedYieldResult(estimate)
                ? `${estimate.lines.map((l) => l.crop.label).join(' + ')} · ${estimate.acres} acres`
                : `${estimate.crop.label} · ${estimate.acres} acres`}
              {estimate.areaSource === 'gps' ? ' (mapped)' : ' (manual)'}
            </Text>

            <View style={styles.resultCard}>
              {aiAdvice ? (
                <View style={styles.aiBox}>
                  <View style={styles.aiHead}>
                    <MaterialCommunityIcons name="robot-outline" size={18} color={palette.brandGreen} />
                    <Text style={styles.aiTitle}>AgriSense AI estimate</Text>
                  </View>
                  <Text style={styles.aiBody}>{aiAdvice}</Text>
                </View>
              ) : (
                <Text style={styles.hint}>AI advice could not load — baseline numbers below.</Text>
              )}

              <Text style={styles.baselineLabel}>Baseline model</Text>
              <Text style={styles.resultRange}>
                {estimate.lowKg.toLocaleString()} – {estimate.highKg.toLocaleString()} kg
              </Text>
              <Text style={styles.resultMid}>Mid ≈ {estimate.estimatedKg.toLocaleString()} kg total</Text>

              {isMixedYieldResult(estimate) ? (
                <View style={styles.perCropList}>
                  {estimate.lines.map((line) => (
                    <View key={line.crop.id + line.areaSharePercent} style={styles.perCropRow}>
                      <Text style={styles.perCropName}>
                        {line.crop.label} ({line.areaSharePercent}% · {line.acresAllocated} ac)
                      </Text>
                      <Text style={styles.perCropKg}>
                        {line.lowKg.toLocaleString()}–{line.highKg.toLocaleString()} kg
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.resultMeta}>
                  ≈ {estimate.kgPerAcre.toLocaleString()} kg/acre · vigor ×{estimate.vigorFactor} ·
                  management ×{estimate.managementFactor}
                </Text>
              )}

              {estimate.satellite ? (
                <View style={styles.satBox}>
                  <Text style={styles.satTitle}>{estimate.satellite.source}</Text>
                  <Text style={styles.satLine}>
                    Peak NDVI {estimate.satellite.peakNdvi.toFixed(2)} · mean{' '}
                    {estimate.satellite.meanNdvi.toFixed(2)}
                  </Text>
                  <Text style={styles.satLine}>
                    Window {estimate.satellite.dateRange.start} → {estimate.satellite.dateRange.end}
                  </Text>
                  <Text style={styles.satLine}>
                    {estimate.satellite.scenes.length} scene(s), best cloud{' '}
                    {Math.min(...estimate.satellite.scenes.map((s) => s.cloudCover)).toFixed(0)}%
                  </Text>
                </View>
              ) : (
                <Text style={styles.satLine}>Satellite NDVI not used for this run.</Text>
              )}

              {estimateError ? (
                <Text style={styles.warnText}>Note: {estimateError}</Text>
              ) : null}

              {estimate.notes.map((n) => (
                <Text key={n} style={styles.note}>
                  · {n}
                </Text>
              ))}
            </View>

            <ResultAiActions
              onAskAi={() => askAiAboutYield()}
              onShop={() =>
                router.push({
                  pathname: '/(tabs)/marketplace',
                  params: { mode: 'buy', q: 'fertilizer' },
                })
              }
              shopLabel="Shop farm inputs"
              suggestions={
                isMixedYieldResult(estimate)
                  ? mixedYieldSuggestions(estimate.lines.map((l) => l.crop.label))
                  : yieldSuggestions(estimate.crop.label)
              }
              onSuggestion={(q) => askAiAboutYield(q)}
            />

            <Pressable
              style={styles.textBtn}
              onPress={() => {
                setStep('map');
                setEstimate(null);
                setAiAdvice(null);
                setEstimateError(null);
                setLastInputs(null);
              }}
            >
              <Text style={styles.textBtnLabel}>Start over</Text>
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
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotOn: { backgroundColor: palette.brandGreen, borderColor: palette.brandGreen },
  stepNum: { fontFamily: Fonts.bold, fontSize: 12, color: palette.text.tertiary },
  stepNumOn: { color: palette.white },
  stepLabel: { fontFamily: Fonts.medium, fontSize: 11, color: palette.text.tertiary },
  stepLabelOn: { color: palette.brandGreenDark },
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
  mapCard: {
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border.card,
    padding: spacing.lg,
    gap: 12,
  },
  statRow: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1,
    backgroundColor: palette.tint[50],
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { fontFamily: Fonts.bold, fontSize: 18, color: palette.brandGreenDark },
  statLabel: { fontFamily: Fonts.regular, fontSize: 11, color: palette.text.muted, marginTop: 2 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveText: { fontFamily: Fonts.semiBold, fontSize: 14, color: palette.brandGreen },
  hint: { fontFamily: Fonts.regular, fontSize: 13, color: palette.text.muted, lineHeight: 18 },
  banner: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: palette.brandGreenDark,
    backgroundColor: palette.tint[100],
    padding: 12,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: palette.text.secondary,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border.light,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: palette.text.primary,
    marginBottom: 4,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border.light,
  },
  chipOn: { backgroundColor: palette.brandGreen, borderColor: palette.brandGreen },
  chipText: { fontFamily: Fonts.semiBold, fontSize: 13, color: palette.text.secondary },
  chipTextOn: { color: palette.white },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.brandGreen,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontFamily: Fonts.bold, fontSize: 15, color: palette.white },
  textBtn: { alignItems: 'center', paddingVertical: 12 },
  textBtnLabel: { fontFamily: Fonts.semiBold, fontSize: 14, color: palette.text.secondary },
  errorBox: {
    backgroundColor: palette.ui.errorBg,
    borderColor: palette.ui.errorBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  errorText: { fontFamily: Fonts.medium, fontSize: 13, color: palette.ui.errorText },
  loadingBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingTitle: { fontFamily: Fonts.bold, fontSize: 18, color: palette.text.primary },
  loadingSub: { fontFamily: Fonts.regular, fontSize: 14, color: palette.text.muted, textAlign: 'center' },
  resultCard: {
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border.card,
    padding: spacing.lg,
    gap: 8,
  },
  resultRange: { fontFamily: Fonts.bold, fontSize: 24, color: palette.brandGreen },
  resultMid: { fontFamily: Fonts.semiBold, fontSize: 16, color: palette.text.primary },
  resultMeta: { fontFamily: Fonts.regular, fontSize: 13, color: palette.text.muted },
  satBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.tint[50],
    gap: 4,
  },
  satTitle: { fontFamily: Fonts.bold, fontSize: 13, color: palette.brandGreenDark },
  satLine: { fontFamily: Fonts.regular, fontSize: 12, color: palette.text.muted },
  warnText: { fontFamily: Fonts.medium, fontSize: 12, color: '#E65100', marginTop: 4 },
  note: { fontFamily: Fonts.regular, fontSize: 12, color: palette.text.tertiary, lineHeight: 17 },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  shareBadge: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: palette.brandGreen,
    backgroundColor: palette.tint[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  shareBadgeWarn: { color: '#E65100', backgroundColor: '#FFF3E0' },
  mixedCard: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 6,
  },
  mixedCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mixedCardTitle: { fontFamily: Fonts.bold, fontSize: 14, color: palette.text.primary },
  miniLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: palette.text.secondary,
    marginTop: 4,
  },
  addCropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 8,
  },
  addCropText: { fontFamily: Fonts.semiBold, fontSize: 14, color: palette.brandGreen },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  aiBox: {
    backgroundColor: palette.tint[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 8,
  },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiTitle: { fontFamily: Fonts.bold, fontSize: 14, color: palette.brandGreenDark },
  aiBody: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21, color: palette.text.primary },
  baselineLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: palette.text.muted,
    marginTop: 4,
  },
  perCropList: { gap: 8, marginTop: 8 },
  perCropRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: palette.border.light,
  },
  perCropName: { flex: 1, fontFamily: Fonts.medium, fontSize: 13, color: palette.text.secondary },
  perCropKg: { fontFamily: Fonts.bold, fontSize: 13, color: palette.brandGreenDark },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
  primaryBtnFlex: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: palette.brandGreen,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnFlex: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.brandGreen,
  },
  secondaryBtnText: { fontFamily: Fonts.bold, fontSize: 14, color: palette.brandGreen },
});
