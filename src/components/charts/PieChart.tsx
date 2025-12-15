import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { palette } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

interface PieChartData {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieChartData[];
  size?: number;
  showLegend?: boolean;
  showLabels?: boolean;
}

export const PieChart: React.FC<PieChartProps> = ({
  data,
  size = 200,
  showLegend = true,
  showLabels = false,
}) => {
  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  const segments = useMemo(() => {
    if (total === 0) return [];
    
    let currentAngle = -90; // Start from top
    const radius = size / 2 - 20;
    const center = size / 2;

    return data.map((item, index) => {
      const percentage = item.value / total;
      const angle = percentage * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      // Calculate arc path
      const startAngleRad = (startAngle * Math.PI) / 180;
      const endAngleRad = (endAngle * Math.PI) / 180;
      
      const x1 = center + radius * Math.cos(startAngleRad);
      const y1 = center + radius * Math.sin(startAngleRad);
      const x2 = center + radius * Math.cos(endAngleRad);
      const y2 = center + radius * Math.sin(endAngleRad);

      const largeArcFlag = angle > 180 ? 1 : 0;

      const path = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

      // Label position (middle of arc)
      const labelAngle = (startAngle + angle / 2) * (Math.PI / 180);
      const labelRadius = radius * 0.7;
      const labelX = center + labelRadius * Math.cos(labelAngle);
      const labelY = center + labelRadius * Math.sin(labelAngle);

      return {
        path,
        color: item.color,
        label: item.label,
        percentage,
        labelX,
        labelY,
      };
    });
  }, [data, total, size]);

  if (total === 0) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((segment, index) => (
          <Path
            key={index}
            d={segment.path}
            fill={segment.color}
            stroke={palette.white}
            strokeWidth="2"
          />
        ))}
        {showLabels &&
          segments.map((segment, index) => {
            if (segment.percentage < 0.05) return null; // Don't show labels for very small segments
            return (
              <SvgText
                key={`label-${index}`}
                x={segment.labelX}
                y={segment.labelY}
                fontSize="12"
                fill={palette.white}
                textAnchor="middle"
                fontWeight="600"
              >
                {Math.round(segment.percentage * 100)}%
              </SvgText>
            );
          })}
      </Svg>
      {showLegend && (
        <View style={styles.legend}>
          {data.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
              <Text style={styles.legendValue}>
                {item.value} ({Math.round((item.value / total) * 100)}%)
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
    alignItems: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.body.medium,
    color: palette.text.tertiary,
  },
  legend: {
    marginTop: spacing.lg,
    width: '100%',
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    ...typography.body.medium,
    color: palette.text.primary,
    flex: 1,
  },
  legendValue: {
    ...typography.body.small,
    color: palette.text.secondary,
  },
});

