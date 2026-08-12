import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';
import {
  confidencePercent,
  getConfidencePresentation,
  normalizeConfidence,
} from '@/utils/confidence';

type ConfidenceResultProps = {
  confidence: number | null | undefined;
  label?: string;
};

export function ConfidenceResult({
  confidence,
  label = 'Confidence Level',
}: ConfidenceResultProps) {
  const normalized = normalizeConfidence(confidence);
  const percent = confidencePercent(confidence);
  const presentation = getConfidencePresentation(confidence);

  return (
    <View style={styles.container} accessibilityRole="summary">
      <Text style={styles.label}>{label}</Text>

      <View style={styles.percentRow}>
        <Text style={[styles.percentValue, { color: presentation.color }]}>{percent}</Text>
        <Text style={[styles.percentSymbol, { color: presentation.color }]}>%</Text>
      </View>

      <View style={styles.track} accessibilityLabel={`${percent} percent confidence`}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.max(normalized * 100, 4)}%`,
              backgroundColor: presentation.color,
            },
          ]}
        />
      </View>

      <View style={[styles.badge, { backgroundColor: `${presentation.color}18` }]}>
        <MaterialCommunityIcons name={presentation.icon} size={16} color={presentation.color} />
        <Text style={[styles.badgeText, { color: presentation.color }]}>{presentation.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: palette.surface.secondary,
    borderWidth: 1,
    borderColor: palette.border.light,
    gap: spacing.sm,
  },
  label: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  percentValue: {
    fontFamily: Fonts.bold,
    fontSize: 48,
    lineHeight: 52,
  },
  percentSymbol: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    lineHeight: 40,
    marginBottom: 4,
  },
  track: {
    width: '100%',
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.gray200,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    flexShrink: 1,
    textAlign: 'center',
  },
});
