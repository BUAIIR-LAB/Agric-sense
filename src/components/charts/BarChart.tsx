import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { palette } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  height?: number;
  showLabels?: boolean;
  showValues?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 150,
  showLabels = true,
  showValues = false,
}) => {
  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);
  const barWidth = useMemo(() => {
    const totalBars = data.length;
    const spacingBetween = 8;
    const totalSpacing = spacingBetween * (totalBars - 1);
    return Math.max(20, (300 - totalSpacing) / totalBars); // 300 is approximate chart width
  }, [data.length]);

  if (data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Svg width="100%" height={height} viewBox={`0 0 300 ${height}`}>
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * (height - 40); // Reserve space for labels
          const x = index * (barWidth + 8);
          const y = height - barHeight - 20; // 20px for labels
          const color = item.color || palette.brandGreen;

          return (
            <React.Fragment key={index}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={color}
                rx={4}
                ry={4}
              />
              {showValues && item.value > 0 && (
                <Text
                  style={[
                    styles.valueLabel,
                    {
                      left: x + barWidth / 2,
                      bottom: height - barHeight - 25,
                    },
                  ]}
                >
                  {item.value}
                </Text>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
      {showLabels && (
        <View style={styles.labelsContainer}>
          {data.map((item, index) => (
            <View key={index} style={[styles.labelItem, { width: barWidth }]}>
              <Text style={styles.label} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.body.medium,
    color: palette.text.tertiary,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingHorizontal: 4,
  },
  labelItem: {
    alignItems: 'center',
  },
  label: {
    ...typography.caption,
    color: palette.text.secondary,
    textAlign: 'center',
  },
  valueLabel: {
    ...typography.caption,
    color: palette.text.primary,
    fontWeight: '600',
    position: 'absolute',
    textAlign: 'center',
    width: 30,
    marginLeft: -15,
  },
});

