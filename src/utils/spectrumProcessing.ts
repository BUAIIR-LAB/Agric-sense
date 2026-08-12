import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import React from 'react';
import Svg, { Polyline, Rect, Line, Text as SvgText, G } from 'react-native-svg';

// Processing parameters (adapted from reference OpenCV pipeline)
const BAND_HEIGHT = 10;
const PROCESSING_WIDTH = 400;

export type SpectrumData = {
  /** Normalized intensity values */
  intensity: number[];
  /** Wavelength values in nm (400–700), same length as intensity. Absent for photo-extracted spectra. */
  wavelength?: number[];
  /** Normalized energy per spectral band. Absent for photo-extracted spectra. */
  bandEnergy?: Record<string, number>;
};

/**
 * Decode a base64 string into a Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Extracts a 1D spectral intensity profile from a captured image.
 *
 * Processing pipeline (adapted from the OpenCV reference code):
 * 1. Resize image to a fixed width for efficient processing
 * 2. Decode JPEG to raw RGBA pixel data
 * 3. Convert each pixel to grayscale (0.299R + 0.587G + 0.114B)
 * 4. Extract a horizontal band from the vertical center of the image
 * 5. Average the band vertically to produce a 1D spectrum
 * 6. Normalize intensity values to [0, 1]
 */
export async function extractSpectrum(imageUri: string): Promise<SpectrumData> {
  // Resize for efficient processing and get base64 output
  const resized = await manipulateAsync(
    imageUri,
    [{ resize: { width: PROCESSING_WIDTH } }],
    { format: SaveFormat.JPEG, base64: true },
  );

  if (!resized.base64) {
    throw new Error('Failed to get base64 image data');
  }

  // Decode JPEG to raw RGBA pixels
  const jpegBytes = base64ToUint8Array(resized.base64);
  const {
    data: pixels,
    width: w,
    height: h,
  } = jpeg.decode(jpegBytes, {
    useTArray: true,
  });

  // Extract center band
  const yCenter = Math.floor(h / 2);
  const yStart = Math.max(0, yCenter - BAND_HEIGHT);
  const yEnd = Math.min(h, yCenter + BAND_HEIGHT);

  // Compute 1D spectrum: grayscale conversion + vertical average per column
  const spectrum: number[] = new Array(w);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    let count = 0;
    for (let y = yStart; y < yEnd; y++) {
      const idx = (y * w + x) * 4;
      const gray =
        0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
      sum += gray;
      count++;
    }
    spectrum[x] = count > 0 ? sum / count : 0;
  }

  // Normalize to [0, 1]
  let maxVal = 0;
  for (const v of spectrum) {
    if (v > maxVal) maxVal = v;
  }
  if (maxVal > 0) {
    for (let i = 0; i < spectrum.length; i++) {
      spectrum[i] /= maxVal;
    }
  }

  return { intensity: spectrum };
}

/**
 * Renders a 1D spectrum as an SVG line chart.
 */
/** Convert a wavelength (nm) to a visible-spectrum RGB hex color. */
function wavelengthToHex(wl: number): string {
  let r = 0, g = 0, b = 0;
  if (wl >= 380 && wl < 440) { r = -(wl - 440) / 60; b = 1; }
  else if (wl >= 440 && wl < 490) { g = (wl - 440) / 50; b = 1; }
  else if (wl >= 490 && wl < 510) { g = 1; b = -(wl - 510) / 20; }
  else if (wl >= 510 && wl < 580) { r = (wl - 510) / 70; g = 1; }
  else if (wl >= 580 && wl < 645) { r = 1; g = -(wl - 645) / 65; }
  else if (wl >= 645 && wl <= 780) { r = 1; }
  let factor = 1.0;
  if (wl >= 380 && wl < 420) factor = 0.3 + 0.7 * (wl - 380) / 40;
  else if (wl >= 645 && wl <= 780) factor = 0.3 + 0.7 * (780 - wl) / 135;
  const toHex = (v: number) => Math.round(255 * v * factor).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const BAND_COLORS: Record<string, string> = {
  Violet: "#8B00FF", Blue: "#0066FF", Green: "#00CC44",
  Yellow: "#FFD700", Orange: "#FF8C00", Red: "#FF2200",
};

/**
 * Renders a detailed spectrum chart with wavelength-calibrated X axis
 * and line colored by wavelength, matching the live WebView display.
 * Falls back to pixel-index X axis for photo-extracted spectra.
 */
export function DetailedSpectrumChart({
  data,
  width = 300,
  height = 220,
}: {
  data: SpectrumData;
  width?: number;
  height?: number;
}) {
  const intensity = data.intensity;
  const wavelength = data.wavelength;
  const hasWavelength = wavelength && wavelength.length === intensity.length;

  const marginLeft = 36;
  const marginBottom = 26;
  const marginTop = 18;
  const marginRight = 16;

  const plotW = width - marginLeft - marginRight;
  const plotH = height - marginTop - marginBottom;
  const yMax = 1.1;

  const MIN_WL = 400;
  const MAX_WL = 700;

  // Y axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  // X axis ticks
  const xTicks = hasWavelength
    ? [400, 450, 500, 550, 600, 650, 700].map((wl) => ({
        label: `${wl}`,
        x: marginLeft + ((wl - MIN_WL) / (MAX_WL - MIN_WL)) * plotW,
      }))
    : Array.from({ length: 5 }, (_, i) => ({
        label: `${Math.round((i / 4) * (intensity.length - 1))}`,
        x: marginLeft + (i / 4) * plotW,
      }));

  // Build line segments
  const segments: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
  const len = intensity.length;
  for (let i = 1; i < len; i++) {
    let x1: number, x2: number;
    if (hasWavelength) {
      x1 = marginLeft + ((wavelength[i - 1] - MIN_WL) / (MAX_WL - MIN_WL)) * plotW;
      x2 = marginLeft + ((wavelength[i] - MIN_WL) / (MAX_WL - MIN_WL)) * plotW;
    } else {
      x1 = marginLeft + ((i - 1) / (len - 1)) * plotW;
      x2 = marginLeft + (i / (len - 1)) * plotW;
    }
    const y1 = marginTop + plotH - (Math.min(intensity[i - 1], yMax) / yMax) * plotH;
    const y2 = marginTop + plotH - (Math.min(intensity[i], yMax) / yMax) * plotH;
    const color = hasWavelength ? wavelengthToHex(wavelength[i]) : "#166534";
    segments.push({ x1, y1, x2, y2, color });
  }

  // Downsample segments if too many for SVG perf (keep at most ~plotW segments)
  let drawSegments = segments;
  if (segments.length > plotW) {
    const step = segments.length / plotW;
    drawSegments = [];
    for (let i = 0; i < plotW; i++) {
      drawSegments.push(segments[Math.floor(i * step)]);
    }
  }

  return (
    <Svg width={width} height={height}>
      {/* Plot background */}
      <Rect x={marginLeft} y={marginTop} width={plotW} height={plotH} fill="#fafffe" rx={4} />

      {/* Title */}
      <SvgText x={marginLeft + 4} y={marginTop - 5} fontSize={10} fill="#6b7280" fontWeight="600">
        {hasWavelength ? "Intensity vs Wavelength (nm)" : "Spectral Intensity"}
      </SvgText>

      {/* Horizontal gridlines + Y labels */}
      {yTicks.map((tick) => {
        const y = marginTop + plotH - (tick / yMax) * plotH;
        return (
          <G key={`y-${tick}`}>
            <Line x1={marginLeft} y1={y} x2={marginLeft + plotW} y2={y} stroke="#e5e7eb" strokeWidth={0.5} />
            <SvgText x={marginLeft - 6} y={y + 3} fontSize={9} fill="#6b7280" textAnchor="end">
              {tick.toFixed(1)}
            </SvgText>
          </G>
        );
      })}

      {/* Vertical gridlines for wavelength ticks */}
      {hasWavelength && xTicks.map((tick) => (
        <Line key={`vg-${tick.label}`} x1={tick.x} y1={marginTop} x2={tick.x} y2={marginTop + plotH} stroke="#f0f0f0" strokeWidth={0.5} />
      ))}

      {/* X axis labels */}
      {xTicks.map((tick) => (
        <SvgText key={`x-${tick.label}`} x={tick.x} y={marginTop + plotH + 16} fontSize={9} fill="#6b7280" textAnchor="middle">
          {tick.label}
        </SvgText>
      ))}

      {/* Axes */}
      <Line x1={marginLeft} y1={marginTop} x2={marginLeft} y2={marginTop + plotH} stroke="#9ca3af" strokeWidth={1} />
      <Line x1={marginLeft} y1={marginTop + plotH} x2={marginLeft + plotW} y2={marginTop + plotH} stroke="#9ca3af" strokeWidth={1} />

      {/* Spectrum line segments colored by wavelength */}
      {drawSegments.map((seg, i) => (
        <Line key={i} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} stroke={seg.color} strokeWidth={1.5} />
      ))}
    </Svg>
  );
}

/**
 * Renders a bar chart showing normalized energy per spectral band,
 * matching the live WebView band energy display.
 */
export function BandEnergyChart({
  bandEnergy,
  width = 300,
  height = 80,
}: {
  bandEnergy: Record<string, number>;
  width?: number;
  height?: number;
}) {
  const bandNames = Object.keys(bandEnergy);
  const numBands = bandNames.length;
  if (numBands === 0) return null;

  const padL = 8, padR = 8, padT = 20, padB = 18;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const barGap = 4;
  const barW = (plotW - barGap * (numBands - 1)) / numBands;

  let maxE = 0;
  for (const name of bandNames) {
    if (bandEnergy[name] > maxE) maxE = bandEnergy[name];
  }
  if (maxE === 0) maxE = 1;

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill="#fafffe" rx={6} />
      <SvgText x={padL + 2} y={padT - 6} fontSize={10} fill="#6b7280" fontWeight="600">
        Band Energy
      </SvgText>
      {bandNames.map((name, i) => {
        const val = bandEnergy[name];
        const barH = (val / maxE) * plotH;
        const x = padL + i * (barW + barGap);
        const y = padT + plotH - barH;
        const color = BAND_COLORS[name] || "#888";
        return (
          <G key={name}>
            <Rect x={x} y={y} width={barW} height={barH} fill={color} opacity={0.85} rx={2} />
            <SvgText x={x + barW / 2} y={padT + plotH + 13} fontSize={8} fill="#6b7280" textAnchor="middle">
              {name.substring(0, 3)}
            </SvgText>
            <SvgText x={x + barW / 2} y={y - 3} fontSize={7} fill="#9ca3af" textAnchor="middle">
              {(val * 100).toFixed(0)}%
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/**
 * Computes summary statistics from spectrum data.
 */
export function getSpectrumStats(data: SpectrumData) {
  const arr = data.intensity;
  let sum = 0;
  let min = arr[0];
  let max = arr[0];
  for (const v of arr) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return {
    mean: sum / arr.length,
    min,
    max,
    points: arr.length,
  };
}

export function SpectrumChart({
  data,
  width = 150,
  height = 48,
}: {
  data: SpectrumData;
  width?: number;
  height?: number;
}) {
  const arr = data.intensity;
  const maxPoints = Math.min(arr.length, width);
  const step = arr.length / maxPoints;
  const padding = 2;

  const points = Array.from({ length: maxPoints }, (_, i) => {
    const dataIdx = Math.floor(i * step);
    const x = (i / (maxPoints - 1)) * width;
    const y = height - padding - arr[dataIdx] * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill="#f0fdf4" rx={6} />
      <Polyline
        points={points}
        fill="none"
        stroke="#166534"
        strokeWidth={1.5}
      />
    </Svg>
  );
}
