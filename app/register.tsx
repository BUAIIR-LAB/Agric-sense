import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import {
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
import { validatePassword } from '@/utils/password';
import apiService from '@/services/api';
import { Fonts } from '@/theme/fonts';

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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
    const passwordValidation = validatePassword(password);
    return (
      name.trim().length >= 2 &&
      phoneValidation.isValid &&
      area.trim().length >= 2 &&
      passwordValidation.isValid &&
      password === confirmPassword &&
      !nameError &&
      !phoneError &&
      !areaError &&
      !passwordError
    );
  }, [name, phoneNumber, area, password, confirmPassword, nameError, phoneError, areaError, passwordError]);

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

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error || 'Invalid password');
      showAlert('warning', 'Invalid Password', passwordValidation.error || 'Choose a stronger password.');
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      showAlert('warning', 'Password Mismatch', 'Password and confirmation must match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const loggedIn = await registerWithAPI({
        name: sanitizeText(name.trim()),
        phone_number: sanitizedPhone,
        password,
        area: sanitizeText(area.trim()),
        preferred_language: language,
        crops_grown: crops,
        gps_location: gpsLocation,
      });

      if (loggedIn) {
        router.replace('/(tabs)/home');
      } else {
        showAlert(
          'info',
          'Account Created',
          'Your account was created. Please sign in with your phone number and password.',
          { onConfirm: () => router.replace('/login') },
        );
      }
    } catch (error: any) {
      const errorDetail = apiService.extractErrorMessage(error);
      
      // Handle "already registered" gracefully
      if (error.response?.status === 400 && errorDetail.toLowerCase().includes('already registered')) {
        showAlert('warning', 'Already Registered', 'This phone number is already registered. Please log in instead.', {
          onConfirm: () => router.replace('/login')
        });
      } else {
        showAlert('error', 'Registration Error', errorDetail);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || contextLoading;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
          bounces
          automaticallyAdjustKeyboardInsets
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace('/')}
              accessibilityLabel="Go back to home"
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color={palette.text.primary} />
            </Pressable>
            <Text style={styles.headerTitle}>Create Account</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                value={name}
                onChangeText={handleNameChange}
                placeholder="Enter your name"
                placeholderTextColor={palette.gray400}
                style={[styles.input, nameError && styles.inputError]}
                accessibilityLabel="Full name input"
              />
              {nameError && <Text style={styles.errorText}>{nameError}</Text>}
            </View>

            {/* Phone */}
            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                placeholder="0701 234 567"
                placeholderTextColor={palette.gray400}
                keyboardType="phone-pad"
                style={[styles.input, phoneError && styles.inputError]}
                maxLength={13}
                accessibilityLabel="Phone number input"
              />
              {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    const v = validatePassword(text);
                    setPasswordError(v.isValid ? null : v.error || null);
                  }}
                  placeholder="At least 8 characters"
                  placeholderTextColor={palette.gray400}
                  secureTextEntry={!showPassword}
                  style={[styles.input, styles.passwordInput, passwordError && styles.inputError]}
                  accessibilityLabel="Password input"
                />
                <Pressable
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword((prev) => !prev)}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={palette.gray400}
                  />
                </Pressable>
              </View>
              {passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your password"
                placeholderTextColor={palette.gray400}
                secureTextEntry={!showPassword}
                style={[
                  styles.input,
                  confirmPassword.length > 0 && password !== confirmPassword && styles.inputError,
                ]}
                accessibilityLabel="Confirm password input"
              />
            </View>

            {/* Location */}
            <View style={styles.field}>
              <Text style={styles.label}>Location</Text>
              <TextInput
                value={area}
                onChangeText={handleAreaChange}
                placeholder="Enter your area/district"
                placeholderTextColor={palette.gray400}
                style={[styles.input, areaError && styles.inputError]}
                accessibilityLabel="Area or district input"
              />
              {areaError && <Text style={styles.errorText}>{areaError}</Text>}
            </View>

            {/* Language */}
            <View style={styles.field}>
              <Text style={styles.label}>Language</Text>
              <View style={styles.languageGrid}>
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

            {/* Crops */}
            <View style={styles.field}>
              <Text style={styles.label}>Crops You Grow</Text>
              <View style={styles.chipGrid}>
                {COMMON_CROPS.map((crop) => (
                  <CropChip key={crop} label={crop} selected={crops.includes(crop)} onToggle={() => toggleCrop(crop)} />
                ))}
              </View>
            </View>

            {/* GPS Location */}
            <View style={styles.field}>
              <Text style={styles.label}>Farm Location</Text>
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

            {/* Submit Button */}
            <Pressable
              style={[styles.submitButton, (!isValid || isLoading) && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={!isValid || isLoading}
              accessibilityLabel="Complete registration"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={palette.white} />
              ) : (
                <Text style={styles.submitLabel}>Complete Registration</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.white },
  safeArea: { flex: 1 },
  kav: { flex: 1 },
  scroll: { flex: 1 },
  container: { flexGrow: 1, paddingBottom: 140 },

  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surface.secondary,
    borderWidth: 1,
    borderColor: palette.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    fontWeight: '700',
    color: palette.text.primary,
  },

  form: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    fontWeight: '600',
    color: palette.text.secondary,
  },
  input: {
    backgroundColor: palette.input.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    fontSize: 16,
    color: palette.text.primary,
    fontFamily: Fonts.regular,
    borderWidth: 1,
    borderColor: palette.input.border,
  },
  inputError: {
    borderColor: palette.danger,
    backgroundColor: palette.input.backgroundError,
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 44,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: palette.danger,
  },

  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  languageOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border.medium,
    backgroundColor: palette.white,
  },
  languageSelected: {
    borderColor: palette.brandGreen,
    backgroundColor: palette.tint[100],
  },
  languageLabel: {
    fontFamily: Fonts.regular,
    color: palette.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  languageLabelSelected: {
    color: palette.brandGreenDark,
    fontWeight: '600',
  },

  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border.medium,
    backgroundColor: palette.white,
  },
  chipSelected: {
    backgroundColor: palette.tint[100],
    borderColor: palette.brandGreen,
  },
  chipLabel: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: palette.text.secondary,
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: palette.brandGreenDark,
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
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: palette.text.tertiary,
    flex: 1,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    backgroundColor: palette.brandGreen,
  },
  gpsButtonDisabled: {
    opacity: 0.6,
  },
  gpsButtonLabel: {
    fontFamily: Fonts.bold,
    color: palette.white,
    fontSize: 14,
    fontWeight: '600',
  },

  submitButton: {
    backgroundColor: palette.brandGreen,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitLabel: {
    fontFamily: Fonts.bold,
    color: palette.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
