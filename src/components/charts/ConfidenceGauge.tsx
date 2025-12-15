import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { palette } from '@/theme/colors';
import { typography } from '@/theme/typography';

interface ConfidenceGaugeProps {
  confidence: number; // 0-1
  size?: number;
  showLabel?: boolean;
}

export const ConfidenceGauge: React.FC<ConfidenceGaugeProps> = ({
  confidence,
  size = 80,
  showLabel = true,
}) => {
  const percentage = Math.round(confidence * 100);
  const radius = size / 2 - 8;
  const center = size / 2;
  const circumference = Math.PI * radius; // Semi-circle
  const strokeDashoffset = circumference * (1 - confidence);

  // Color based on confidence
  const getColor = () => {
    if (confidence >= 0.8) return palette.success;
    if (confidence >= 0.6) return palette.brandGreen;
    if (confidence >= 0.4) return palette.warning;
    return palette.danger;
  };

  const color = getColor();

  return (
    <View style={styles.container}>
      <Svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
        {/* Background arc */}
        <Path
          d={`M ${8} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 8} ${size / 2}`}
          fill="none"
          stroke={palette.gray200}
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Confidence arc */}
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

