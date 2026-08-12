import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { View, Pressable, StyleSheet, Alert } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { generateSpectrumHtml } from '@/utils/spectrumWebViewHtml';
import { palette } from '@/theme/colors';
import type { SpectrumData } from '@/utils/spectrumProcessing';

interface LiveSpectrumCaptureProps {
  /** Called when the user captures a stable spectrum */
  onCapture: (spectrum: SpectrumData) => void;
  /** Called when the user cancels/closes the live view */
  onCancel: () => void;
  /** Label for the current capture step */
  stepLabel: string;
  /** Height of the capture area */
  height?: number;
}

export default function LiveSpectrumCapture({
  onCapture,
  onCancel,
  stepLabel,
  height = 500,
}: LiveSpectrumCaptureProps) {
  const webViewRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const isFirstStep = useRef(true);

  // Generate HTML only once — step label updates happen via injectJavaScript
  const htmlContent = useMemo(
    () =>
      generateSpectrumHtml({
        primaryGreen: palette.brandGreen,
        darkGreen: palette.brandGreenDark,
        rose: palette.semantic.error,
        orange: palette.semantic.warning,
        white: palette.white,
        stepLabel,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // intentionally empty — HTML generated once on mount
  );

  // When stepLabel changes after the first step, reset the WebView for the next capture
  useEffect(() => {
    if (isFirstStep.current) {
      isFirstStep.current = false;
      return;
    }
    if (isReady) {
      const escaped = stepLabel.replace(/'/g, "\\'");
      webViewRef.current?.injectJavaScript(
        `window.resetForNextStep('${escaped}');true;`
      );
    }
  }, [stepLabel, isReady]);

  // Cleanup: stop camera on unmount
  useEffect(() => {
    return () => {
      webViewRef.current?.injectJavaScript("window.stopCamera();true;");
    };
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        switch (msg.type) {
          case 'opencv_ready':
            break;
          case 'camera_ready':
            setIsReady(true);
            break;
          case 'spectrum_captured':
            if (Array.isArray(msg.data) && msg.data.length > 0) {
              onCapture({
                intensity: msg.data,
                wavelength: Array.isArray(msg.wavelength) ? msg.wavelength : undefined,
                bandEnergy: msg.bandEnergy && typeof msg.bandEnergy === 'object' ? msg.bandEnergy : undefined,
              });
            }
            break;
          case 'error':
            Alert.alert('Capture Error', msg.message || 'An error occurred.');
            onCancel();
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    },
    [onCapture, onCancel],
  );

  const handleCancel = useCallback(() => {
    webViewRef.current?.injectJavaScript("window.stopCamera();true;");
    onCancel();
  }, [onCancel]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent, baseUrl: "https://localhost" }}
        style={styles.webview}
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        mediaCapturePermissionGrantType="grant"
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        originWhitelist={["*"]}
        onMessage={handleMessage}
        onError={() => {
          Alert.alert('WebView Error', 'The live capture view encountered an error.');
          onCancel();
        }}
        androidLayerType="hardware"
        webviewDebuggingEnabled={__DEV__}
      />

      {/* Close button */}
      <Pressable onPress={handleCancel} style={styles.closeBtn}>
        <Ionicons name="close" size={20} color={palette.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  closeBtn: {
    position: 'absolute',
    top: 8,
    right: 50,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
});
