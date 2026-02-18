import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import {
  FarmerProfile,
  SUPPORTED_LANGUAGES,
  useAppContext,
  type Coordinates,
} from '@/context/AppContext';
import { useSweetAlert } from '@/components/AlertProvider';
import { COMMON_CROPS } from '@/constants/crops';
import { palette } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { formatPhoneNumber, validatePhoneNumber, sanitizePhoneNumber } from '@/utils/phoneNumber';
import { sanitizeText, sanitizeString } from '@/utils/sanitize';

const appFont = Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }) ?? 'System';

const CropChip = ({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) => (
  <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onToggle}>
    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
  </Pressable>
);

export default function RegisterScreen() {
  const router = useRouter();
  const { state } = useAppContext();
  const { showAlert } = useSweetAlert();

  const [name, setName] = useState(state.profile?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(state.profile?.phoneNumber ?? '');
  const [area, setArea] = useState(state.profile?.area ?? '');
  const [language, setLanguage] = useState(state.profile?.preferredLanguage ?? SUPPORTED_LANGUAGES[0]);
  const [crops, setCrops] = useState<string[]>(state.profile?.cropsGrown ?? []);
  const [gpsLocation, setGpsLocation] = useState<Coordinates | undefined>(state.profile?.gpsLocation);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);

  useEffect(() => {
    if (state.profile) {
      setName(state.profile.name);
      setPhoneNumber(state.profile.phoneNumber);
      setArea(state.profile.area);
      setLanguage(state.profile.preferredLanguage);
      setCrops(state.profile.cropsGrown);
      setGpsLocation(state.profile.gpsLocation);
    }
  }, [state.profile]);

  const handleNameChange = (text: string) => {
    const sanitized = sanitizeString(text, 100);
    setName(sanitized);
    if (sanitized.trim().length > 0 && sanitized.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
    } else {
      setNameError(null);
    }
  };

  const handlePhoneChange = (text: string) => {
    const sanitized = sanitizePhoneNumber(text);
    const formatted = formatPhoneNumber(sanitized);
    setPhoneNumber(formatted);

    if (sanitized.length > 0) {
      const validation = validatePhoneNumber(sanitized);
      if (!validation.isValid) {
        setPhoneError(validation.error || 'Invalid phone number');
      } else {
        setPhoneError(null);
      }
    } else {
      setPhoneError(null);
    }
  };

  const handleAreaChange = (text: string) => {
    const sanitized = sanitizeString(text, 100);
    setArea(sanitized);
    if (sanitized.trim().length > 0 && sanitized.trim().length < 2) {
      setAreaError('Area must be at least 2 characters');
    } else {
      setAreaError(null);
    }
  };

  const toggleCrop = (crop: string) => {
    setCrops((current) =>
      current.includes(crop) ? current.filter((item) => item !== crop) : [...current, crop],
    );
  };

  const requestLocation = async () => {
    try {
      setLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        showAlert('warning', 'Permission Needed', 'Location access required.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setGpsLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
      showAlert('success', 'Location Captured', 'Location saved.');
    } catch (error) {
      console.warn('Failed to fetch location', error);
      showAlert('error', 'Location Error', 'Failed to get location. Try again.');
    } finally {
      setLoadingLocation(false);
    }
  };

  const isValid = useMemo(() => {
    const sanitizedPhone = sanitizePhoneNumber(phoneNumber);
    const phoneValidation = validatePhoneNumber(sanitizedPhone);
    return (
      name.trim().length >= 2 &&
      phoneValidation.isValid &&
      area.trim().length >= 2 &&
      !nameError &&
      !phoneError &&
      !areaError
    );
  }, [name, phoneNumber, area, nameError, phoneError, areaError]);

  const { registerWithAPI, isLoading: contextLoading } = useAppContext();

  const handleSubmit = async () => {
    if (!isValid) {
      showAlert('warning', 'Incomplete', 'Fill in name, phone, and location.');
      return;
    }

    const sanitizedPhone = sanitizePhoneNumber(phoneNumber);
    const phoneValidation = validatePhoneNumber(sanitizedPhone);

    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error || 'Invalid phone number');
      showAlert('warning', 'Invalid Phone', phoneValidation.error || 'Enter a valid phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      // For now, we'll use a default password. In production, add a password field
      const password = sanitizedPhone; // Using phone number as default password for testing

      const success = await registerWithAPI({
        name: sanitizeText(name.trim()),
        phone_number: sanitizedPhone,
        password: password,
        area: sanitizeText(area.trim()),
        preferred_language: language,
        crops_grown: crops,
        gps_location: gpsLocation,
      });

      if (success) {
        // Show success message and navigate to login
        showAlert('success', 'Registration Successful', 'Account created. Please log in.', {
          onConfirm: () => {
            router.replace('/login');
          },
        });
      } else {
        showAlert('error', 'Registration Failed', 'Unable to create account. Try again.');
      }
    } catch (error: any) {
      showAlert('error', 'Registration Error', error.message || 'Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || contextLoading;

  const STEPS = ['Personal', 'Preferences', 'Crops', 'Location'];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Background gradient */}
      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#388E3C']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Decorative circles */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.heroSection}>
          {/* Back Button */}
          <Pressable
            style={styles.backButton}
            onPress={() => router.replace('/')}
            accessibilityLabel="Go back to home"
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={palette.white} />
          </Pressable>

          <View style={styles.heroContent}>
            <View style={styles.logoRing}>
              <View style={styles.logoCircle}>
                <Image
                  source={require('../assets/images/splash-icon.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
            </View>
            <Text style={styles.appLabel}>AgriSense</Text>
            <Text style={styles.heroTitle}>Create Account</Text>
            <Text style={styles.heroSub}>Set up your farmer profile in a few steps</Text>
          </View>

          {/* Step progress strip */}
          <View style={styles.stepsRow}>
            {STEPS.map((step, i) => (
              <View key={step} style={styles.stepItem}>
                <View style={styles.stepDot}>
                  <Text style={styles.stepDotText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepLabel}>{step}</Text>
                {i < STEPS.length - 1 && <View style={styles.stepLine} />}
              </View>
            ))}
          </View>
        </View>

        {/* ── Content sheet (white) ── */}
        <View style={styles.contentSheet}>

        {/* Personal Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>1</Text></View>
            <Text style={styles.sectionTitle}>Personal Info</Text>
          </View>
          <View style={styles.card}>
            <FormRow icon="account-outline" label="Name">
              <TextInput
                value={name}
                onChangeText={handleNameChange}
                placeholder="Name"
                placeholderTextColor={palette.gray500}
                style={[styles.input, nameError && styles.inputError]}
                accessibilityLabel="Full name input"
              />
              {nameError && <Text style={styles.errorText}>{nameError}</Text>}
            </FormRow>

            <FormRow icon="phone-outline" label="Phone">
              <TextInput
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                placeholder="0701 234 567"
                placeholderTextColor={palette.gray500}
                keyboardType="phone-pad"
                style={[styles.input, phoneError && styles.inputError]}
                maxLength={13}
                accessibilityLabel="Phone number input"
              />
              {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
            </FormRow>

            <FormRow icon="map-marker-outline" label="Location">
              <TextInput
                value={area}
                onChangeText={handleAreaChange}
                placeholder="Location"
                placeholderTextColor={palette.gray500}
                style={[styles.input, areaError && styles.inputError]}
                accessibilityLabel="Area or district input"
              />
              {areaError && <Text style={styles.errorText}>{areaError}</Text>}
            </FormRow>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>2</Text></View>
            <Text style={styles.sectionTitle}>Preferences</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Language</Text>
            <View style={styles.languageGroup}>
              {SUPPORTED_LANGUAGES.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.languageOption, language === option && styles.languageSelected]}
                  onPress={() => setLanguage(option)}
                >
                  <Text style={[styles.languageLabel, language === option && styles.languageLabelSelected]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Crops */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>3</Text></View>
            <Text style={styles.sectionTitle}>Crops You Grow</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.chipGrid}>
              {COMMON_CROPS.map((crop) => (
                <CropChip key={crop} label={crop} selected={crops.includes(crop)} onToggle={() => toggleCrop(crop)} />
              ))}
            </View>
          </View>
        </View>

        {/* GPS Location */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>4</Text></View>
            <Text style={styles.sectionTitle}>Farm Location</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.locationRow}>
              <View style={styles.locationInfo}>
                <MaterialCommunityIcons name="map-marker" size={20} color={palette.brandGreen} />
                <Text style={styles.locationValue}>
                  {gpsLocation
                    ? `${gpsLocation.latitude.toFixed(4)}, ${gpsLocation.longitude.toFixed(4)}`
                    : 'Not captured yet'}
                </Text>
              </View>
              <Pressable
                style={[styles.gpsButton, loadingLocation && styles.gpsButtonDisabled]}
                onPress={requestLocation}
                disabled={loadingLocation}
              >
                <MaterialCommunityIcons
                  name={loadingLocation ? "loading" : "crosshairs-gps"}
                  size={18}
                  color={palette.white}
                />
                <Text style={styles.gpsButtonLabel}>{loadingLocation ? 'Capturing…' : 'Use GPS'}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <View style={styles.submitSection}>
          <Pressable
            style={[styles.submitButton, (!isValid || isLoading) && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || isLoading}
            accessibilityLabel="Complete registration"
          >
            <LinearGradient
              colors={(!isValid || isLoading) ? ['#A5D6A7', '#A5D6A7'] : ['#2E7D32', '#1B5E20']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={palette.white} />
              ) : (
                <>
                  <Text style={styles.submitLabel}>Complete Registration</Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="rgba(255,255,255,0.85)" />
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        </View>{/* end contentSheet */}
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const FormRow = ({ icon, label, children }: { icon: string; label: string; children: ReactNode }) => (
  <View style={styles.formRow}>
    <View style={styles.formRowHeader}>
      <View style={styles.formIcon}>
        <MaterialCommunityIcons name={icon as any} size={18} color={palette.white} />
      </View>
      <Text style={styles.formLabel}>{label}</Text>
    </View>
    {children}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1B5E20' },
  safeArea: { flex: 1 },
  screen: { flex: 1 },
  container: { paddingBottom: spacing.xxl * 2 },

  // Decorative
  decorCircle1: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -80,
    right: -80,
  },
  decorCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: 100,
    left: -50,
  },

  // ── Hero ────────────────────────────────────────────────────────────────────
  heroSection: {
    paddingTop: spacing.mega,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xxl,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.xl,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroContent: {
    alignItems: 'center',
    gap: 6,
  },
  logoRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    marginBottom: 4,
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  logoImage: { width: 62, height: 62 },
  appLabel: {
    fontFamily: appFont,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: appFont,
    fontSize: 28,
    fontWeight: '800',
    color: palette.white,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  heroSub: {
    fontFamily: appFont,
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    lineHeight: 19,
  },

  // Step progress strip
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
    flexDirection: 'column',
    position: 'relative',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotText: {
    fontFamily: appFont,
    fontSize: 12,
    fontWeight: '800',
    color: palette.brandGreen,
  },
  stepLabel: {
    fontFamily: appFont,
    fontSize: 9,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepLine: {
    position: 'absolute',
    top: 14,
    left: 28,
    width: 32,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // ── Content sheet ────────────────────────────────────────────────────────────
  contentSheet: {
    backgroundColor: '#F5FBF6',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: spacing.xxl,
    marginTop: 12,
    minHeight: 100,
    overflow: 'hidden',
  },

  // ── Sections ─────────────────────────────────────────────────────────────────
  section: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: {
    fontFamily: appFont,
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontFamily: appFont,
    fontSize: 17,
    fontWeight: '700',
    color: palette.charcoal,
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: 20,
    padding: spacing.xl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: '#E8F0EA',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  cardSectionTitle: {
    fontFamily: appFont,
    fontSize: 15,
    fontWeight: '600',
    color: palette.charcoal,
    marginBottom: spacing.xs,
  },
  formRow: {
    gap: spacing.sm,
  },
  formRowHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  formIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formLabel: {
    fontFamily: appFont,
    color: palette.charcoal,
    fontWeight: '600',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#F8FBF9',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: spacing.md,
    fontSize: 15,
    color: palette.charcoal,
    fontFamily: appFont,
    borderWidth: 1,
    borderColor: '#E1EDE4',
  },
  languageGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  languageOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: spacing.md,
    borderWidth: 1.5,
    borderColor: '#C8E6C9',
    backgroundColor: palette.white,
  },
  languageSelected: {
    borderColor: palette.brandGreen,
    backgroundColor: palette.brandGreen,
  },
  languageLabel: {
    fontFamily: appFont,
    color: palette.charcoal,
    fontSize: 14,
    fontWeight: '500',
  },
  languageLabelSelected: {
    color: palette.white,
    fontWeight: '600',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: '#C8E6C9',
    backgroundColor: palette.white,
  },
  chipSelected: {
    backgroundColor: palette.brandGreen,
    borderColor: palette.brandGreen,
  },
  chipLabel: {
    fontFamily: appFont,
    fontSize: 13,
    color: palette.charcoal,
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: palette.white,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  locationInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  locationValue: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.gray500,
    flex: 1,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.md,
    backgroundColor: palette.brandGreen,
  },
  gpsButtonDisabled: {
    opacity: 0.6,
  },
  gpsButtonLabel: {
    fontFamily: appFont,
    color: palette.white,
    fontSize: 14,
    fontWeight: '600',
  },
  submitSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg + 2,
  },
  submitDisabled: {
    opacity: 0.65,
  },
  submitLabel: {
    fontFamily: appFont,
    color: palette.white,
    fontSize: 17,
    fontWeight: '700',
  },
  inputError: {
    borderColor: palette.danger,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.danger,
    marginTop: spacing.xs,
  },
});
