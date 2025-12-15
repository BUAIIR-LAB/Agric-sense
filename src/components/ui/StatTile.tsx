import { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Card } from '@/components/ui/Card';
import { palette } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { MiniLineChart } from '@/components/charts/MiniLineChart';

type StatTileProps = {
  icon: ReactNode;
  label: string;
  value: string | number;
  trendText?: string;
  trendData?: number[]; // Array of values for mini chart
  style?: ViewStyle | ViewStyle[];
};

export const StatTile = ({ icon, label, value, trendText, trendData, style }: StatTileProps) => (
  <Card variant="tinted" style={[styles.container, style]}>
    <View style={styles.icon}>{icon}</View>
    <Text style={styles.value}>{value}</Text>
    <Text style={styles.label}>{label}</Text>
    {trendData && trendData.length > 0 && (
      <View style={styles.chartContainer}>
        <MiniLineChart data={trendData} width={60} height={20} color={palette.brandGreen} />
      </View>
    )}
    {trendText && <Text style={styles.trend}>{trendText}</Text>}
  </Card>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    width: '100%',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E1EAE4',
  },
  value: {
    ...typography.heading.h3,
    color: palette.text.primary,
  },
  label: {
    ...typography.caption,
    color: palette.text.tertiary,
  },
  trend: {
    ...typography.caption,
    color: palette.brandGreen,
  },
  chartContainer: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
});
