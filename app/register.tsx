import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.screen} 
        contentContainerStyle={styles.container} 
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={[palette.brandGreen, palette.brandGreenDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          {/* Back Button */}
          <Pressable 
            style={styles.backButton}
            onPress={() => router.replace('/')}
            accessibilityLabel="Go back to home"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={palette.white} />
          </Pressable>

          <View style={styles.heroContent}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="account-plus" size={40} color={palette.white} />
            </View>
            <Text style={styles.heroTitle}>Create Account</Text>
            <Text style={styles.heroSubtitle}>
              Join smart agriculture
            </Text>
          </View>
        </LinearGradient>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Info</Text>
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
          <Text style={styles.sectionTitle}>Preferences</Text>
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
          <Text style={styles.sectionTitle}>Crops</Text>
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
          <Text style={styles.sectionTitle}>Farm Location</Text>
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
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={palette.white} />
            ) : (
              <>
                <Text style={styles.submitLabel}>Complete Registration</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color={palette.white} />
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#F5FBF6',
  },
  screen: {
    flex: 1,
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
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: spacing.xl,
    left: spacing.xl,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
  section: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  sectionTitle: {
    fontFamily: appFont,
    fontSize: 18,
    fontWeight: '700',
    color: palette.charcoal,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: spacing.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: '#E1EDE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.brandGreen,
    paddingVertical: spacing.xl,
    borderRadius: spacing.lg,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  submitDisabled: {
    backgroundColor: '#A5D6A7',
    opacity: 0.7,
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
