import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppContext } from '@/context/AppContext';
import { useSweetAlert } from '@/components/AlertProvider';
import { palette } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { generateMockSpectroscopy } from '@/utils/sampleData';

const appFont = Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }) ?? 'System';
export default function SpectroscopyScreen() {
  const { addSpectroscopyRecord } = useAppContext();
  const { showAlert } = useSweetAlert();
  const [sampleName, setSampleName] = useState('Field Sample');
  const [record, setRecord] = useState(() => generateMockSpectroscopy('Field Sample'));
  const [isInfoModalVisible, setInfoModalVisible] = useState(true);

  const refreshSpectrum = () => {
    const next = generateMockSpectroscopy(sampleName);
    setRecord(next);
    addSpectroscopyRecord(next);
  };

  const handleStartDiagnosis = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert('warning', 'Camera Access Needed', 'Grant camera permission.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      aspect: [4, 3],
    });

    if (result.canceled) {
      return;
    }

    setInfoModalVisible(false);
    refreshSpectrum();
  };

  const lastCaptureLabel = useMemo(() => new Date(record.timestamp).toLocaleString(), [record.timestamp]);
  const signalStrength = useMemo(() => {
    if (!record.spectrum.length) return 0;
    const averageIntensity =
      record.spectrum.reduce((total, point) => total + point.intensity, 0) / record.spectrum.length;
    return Math.min(100, Math.max(0, Math.round((averageIntensity / 120) * 100)));
  }, [record.spectrum]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <LinearGradient
          colors={[palette.brandGreen, palette.brandGreenDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <View style={styles.heroContent}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="chart-timeline-variant" size={40} color={palette.white} />
            </View>
            <Text style={styles.heroSubtitle}>
              Capture spectral data for crop analysis
            </Text>
          </View>
        </LinearGradient>

        {/* Main Content */}
        <View style={styles.contentSection}>
          <View style={styles.captureCard}>
            <View style={styles.captureIconContainer}>
              <View style={styles.captureIconBadge}>
                <MaterialCommunityIcons name="camera-iris" size={48} color={palette.white} />
              </View>
            </View>
            <Text style={styles.captureTitle}>Ready</Text>
            <Text style={styles.captureSubtitle}>
              Open camera to capture spectral data
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={handleStartDiagnosis}
              accessibilityLabel="Start spectral diagnosis"
            >
              <MaterialCommunityIcons name="camera" size={20} color={palette.white} />
              <Text style={styles.primaryLabel}>Capture</Text>
            </Pressable>
          </View>

          {/* Status Card */}
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Device Status</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <View style={styles.statusIcon}>
                  <MaterialCommunityIcons name="connection" size={18} color={palette.white} />
                </View>
                <Text style={styles.statusLabel}>Connected</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={styles.statusIcon}>
                  <MaterialCommunityIcons name="clock-outline" size={18} color={palette.white} />
                </View>
                <Text style={styles.statusLabel}>{lastCaptureLabel}</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={styles.statusIcon}>
                  <MaterialCommunityIcons name="signal" size={18} color={palette.white} />
                </View>
                <Text style={styles.statusLabel}>{signalStrength}% Quality</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Info Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isInfoModalVisible}
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <MaterialCommunityIcons name="information" size={24} color={palette.white} />
              </View>
              <View style={styles.modalHeading}>
                <Text style={styles.modalTitle}>Tips</Text>
                <Text style={styles.modalSubtitle}>Best practices for accurate analysis</Text>
              </View>
              <Pressable
                onPress={() => setInfoModalVisible(false)}
                style={styles.modalCloseButton}
                accessibilityLabel="Close tips"
              >
                <MaterialCommunityIcons name="close" size={20} color={palette.gray500} />
              </Pressable>
            </View>
            <View style={styles.modalContent}>
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Tips</Text>
                <View style={styles.modalTipRow}>
                  <MaterialCommunityIcons name="gesture-tap-hold" size={20} color={palette.brandGreen} />
                  <Text style={styles.modalTipText}>Hold the spectroscope 20 cm above the canopy</Text>
                </View>
                <View style={styles.modalTipRow}>
                  <MaterialCommunityIcons name="weather-sunny-off" size={20} color={palette.brandGreen} />
                  <Text style={styles.modalTipText}>Shade the sensor to minimize glare</Text>
                </View>
                <View style={styles.modalTipRow}>
                  <MaterialCommunityIcons name="chart-timeline-variant" size={20} color={palette.brandGreen} />
                  <Text style={styles.modalTipText}>Watch for sudden dips in the green band</Text>
                </View>
              </View>
            </View>
            <Pressable
              onPress={() => setInfoModalVisible(false)}
              style={styles.modalPrimary}
              accessibilityLabel="Start diagnosis"
            >
              <Text style={styles.modalPrimaryLabel}>Start</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5FBF6',
  },
  container: {
    paddingBottom: spacing.xxl * 2,
  },
  heroSection: {
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl * 1.5,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: spacing.xl * 2,
    borderBottomRightRadius: spacing.xl * 2,
  },
  heroContent: {
    alignItems: 'center',
    gap: spacing.md,
  },
  logoBadge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  heroTitle: {
    fontFamily: appFont,
    fontSize: 32,
    fontWeight: '800',
    color: palette.white,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: appFont,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  contentSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.xl,
  },
  captureCard: {
    backgroundColor: palette.white,
    borderRadius: spacing.xl,
    padding: spacing.xxl,
    gap: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E1EDE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  captureIconContainer: {
    marginBottom: spacing.sm,
  },
  captureIconBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  captureTitle: {
    fontFamily: appFont,
    fontSize: 24,
    fontWeight: '700',
    color: palette.charcoal,
    textAlign: 'center',
  },
  captureSubtitle: {
    fontFamily: appFont,
    fontSize: 15,
    color: palette.gray500,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.brandGreen,
    borderRadius: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  primaryLabel: {
    fontFamily: appFont,
    color: palette.white,
    fontSize: 17,
    fontWeight: '700',
  },
  statusCard: {
    backgroundColor: palette.white,
    borderRadius: spacing.xl,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#E1EDE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 12,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  statusTitle: {
    fontFamily: appFont,
    fontSize: 16,
    fontWeight: '700',
    color: palette.charcoal,
    marginBottom: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#F8FBF9',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.md,
    flex: 1,
    minWidth: '45%',
  },
  statusIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: {
    fontFamily: appFont,
    fontSize: 13,
    color: palette.charcoal,
    fontWeight: '500',
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: palette.white,
    borderRadius: spacing.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeading: {
    flex: 1,
    gap: spacing.xs,
  },
  modalTitle: {
    fontFamily: appFont,
    fontSize: 20,
    fontWeight: '700',
    color: palette.charcoal,
  },
  modalSubtitle: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.gray500,
    lineHeight: 20,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FBF9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    gap: spacing.lg,
  },
  modalSection: {
    gap: spacing.md,
  },
  modalSectionTitle: {
    fontFamily: appFont,
    fontSize: 16,
    fontWeight: '700',
    color: palette.charcoal,
    marginBottom: spacing.xs,
  },
  modalTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: '#F8FBF9',
    padding: spacing.md,
    borderRadius: spacing.md,
  },
  modalTipText: {
    flex: 1,
    fontFamily: appFont,
    fontSize: 14,
    color: palette.charcoal,
    lineHeight: 20,
  },
  modalPrimary: {
    borderRadius: spacing.lg,
    backgroundColor: palette.brandGreen,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  modalPrimaryLabel: {
    fontFamily: appFont,
    fontSize: 16,
    fontWeight: '700',
    color: palette.white,
  },
});

