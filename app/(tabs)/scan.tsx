import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProfileHeader from '@/components/ProfileHeader';
import { DiagnosisScreen } from './diagnosis';
import { SpectroscopyScreen } from './spectroscopy';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { spacing } from '@/theme/spacing';

type ScanMode = 'symptom' | 'early';

function parseMode(raw: string | string[] | undefined): ScanMode {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'early' ? 'early' : 'symptom';
}

export default function ScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<ScanMode>(() => parseMode(params.mode));

  useFocusEffect(
    useCallback(() => {
      setMode(parseMode(params.mode));
    }, [params.mode]),
  );

  const selectMode = useCallback(
    (next: ScanMode) => {
      setMode(next);
      router.setParams({ mode: next });
    },
    [router],
  );

  const modes = useMemo(
    () =>
      [
        { key: 'symptom' as const, label: 'Symptom Scan' },
        { key: 'early' as const, label: 'Early Scan' },
      ] as const,
    [],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ProfileHeader />
      <View style={styles.modeBar}>
        {modes.map((item) => {
          const active = mode === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => selectMode(item.key)}
              style={[styles.modeChip, active && styles.modeChipActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.body}>
        {mode === 'symptom' ? (
          <DiagnosisScreen embedded />
        ) : (
          <SpectroscopyScreen embedded />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.surface.screen,
  },
  modeBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: palette.surface.screen,
    zIndex: 20,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border.light,
  },
  modeChipActive: {
    backgroundColor: palette.brandGreen,
    borderColor: palette.brandGreen,
  },
  modeChipText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: palette.text.secondary,
  },
  modeChipTextActive: {
    color: palette.white,
  },
  body: {
    flex: 1,
  },
});
