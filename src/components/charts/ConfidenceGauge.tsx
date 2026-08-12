import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { palette } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { confidencePercent, getConfidencePresentation, normalizeConfidence } from '@/utils/confidence';

interface ConfidenceGaugeProps {
  confidence: number;
  size?: number;
  showLabel?: boolean;
}

export const ConfidenceGauge: React.FC<ConfidenceGaugeProps> = ({
  confidence,
  size = 80,
  showLabel = true,
}) => {
  const normalized = normalizeConfidence(confidence);
  const percentage = confidencePercent(confidence);
  const radius = size / 2 - 8;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference * (1 - normalized);
  const color = getConfidencePresentation(confidence).color;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
        <Path
          d={`M ${8} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 8} ${size / 2}`}
          fill="none"
          stroke={palette.gray200}
          strokeWidth="8"
          strokeLinecap="round"
        />
        <Path
          d={`M ${8} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 8} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </Svg>
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={[styles.percentage, { color }]}>{percentage}%</Text>
          <Text style={styles.label}>Confidence</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  percentage: {
    ...typography.heading.h4,
    fontWeight: '700',
  },
  label: {
    ...typography.caption,
    color: palette.text.secondary,
    marginTop: 2,
  },
});
