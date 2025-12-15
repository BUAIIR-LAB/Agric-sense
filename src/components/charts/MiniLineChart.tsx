import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { palette } from '@/theme/colors';

interface MiniLineChartProps {
  data: number[]; // Array of values (e.g., daily activity counts)
  width?: number;
  height?: number;
  color?: string;
  showGrid?: boolean;
}

export const MiniLineChart: React.FC<MiniLineChartProps> = ({
  data,
  width = 60,
  height = 20,
  color = palette.brandGreen,
  showGrid = false,
}) => {
  const points = useMemo(() => {
    if (data.length === 0) return '';

    const maxValue = Math.max(...data, 1); // Avoid division by zero
    const minValue = Math.min(...data, 0);
    const range = maxValue - minValue || 1; // Avoid division by zero

    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    return data
      .map((value, index) => {
        const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
        const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
        return `${x},${y}`;
      })
      .join(' ');
  }, [data, width, height]);

  if (data.length === 0) {
    return <View style={[styles.container, { width, height }]} />;
  }

  return (
    <View style={styles.container}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {showGrid && (
          <>
            {/* Horizontal grid lines */}
            <Line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={palette.gray200} strokeWidth="0.5" />
          </>
        )}
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

