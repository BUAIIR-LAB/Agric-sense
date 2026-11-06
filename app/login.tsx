import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useAppContext } from '@/context/AppContext';
import { useSweetAlert } from '@/components/AlertProvider';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { formatPhoneNumber, validatePhoneNumber, sanitizePhoneNumber } from '@/utils/phoneNumber';
import { validatePassword } from '@/utils/password';
import apiService from '@/services/api';

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithAPI, isLoading: contextLoading } = useAppContext();
  const { showAlert } = useSweetAlert();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handlePhoneChange = (text: string) => {
    const sanitized = sanitizePhoneNumber(text);
    setPhoneNumber(formatPhoneNumber(sanitized));
    if (sanitized.length > 0) {
      const v = validatePhoneNumber(sanitized);
      setPhoneError(v.isValid ? null : (v.error || 'Invalid phone number'));
    } else {
      setPhoneError(null);
    }
  };

  const submit = async () => {
    const sanitized = sanitizePhoneNumber(phoneNumber);
    if (!sanitized) {
      showAlert('warning', 'Phone Required', 'Please enter your phone number to continue.');
      return;
    }
    const validation = validatePhoneNumber(sanitized);
    if (!validation.isValid) {
      setPhoneError(validation.error || 'Invalid phone number');
      showAlert('warning', 'Invalid Number', validation.error || 'Please enter a valid phone number.');
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error || 'Invalid password');
      showAlert('warning', 'Password Required', passwordValidation.error || 'Enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithAPI(sanitized, password);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      const msg = apiService.extractErrorMessage(error);
      showAlert('error', 'Sign In Failed', msg);
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
            <View style={styles.header}>
              <Pressable
                style={styles.backButton}
                onPress={() => router.replace('/')}
                accessibilityLabel="Go back"
              >
                <MaterialCommunityIcons name="arrow-left" size={22} color={palette.text.primary} />
              </Pressable>
              <Text style={styles.headerTitle}>Sign In</Text>
            </View>

            <View style={styles.logoSection}>
              <Image
                source={require('../assets/images/splash-icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.appName}>AgriSense</Text>
              <Text style={styles.appTagline}>Welcome back</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={[styles.input, isPhoneFocused && styles.inputFocused, !!phoneError && styles.inputError]}
                  placeholder="0701 234 567"
                  placeholderTextColor={palette.gray400}
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={handlePhoneChange}
                  onFocus={() => setIsPhoneFocused(true)}
                  onBlur={() => setIsPhoneFocused(false)}
                  returnKeyType="next"
                  maxLength={13}
                  accessibilityLabel="Phone number"
                />
                {phoneError && (
                  <View style={styles.errorRow}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={13} color={palette.danger} />
                    <Text style={styles.errorText}>{phoneError}</Text>
                  </View>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      isPasswordFocused && styles.inputFocused,
                      !!passwordError && styles.inputError,
                    ]}
                    placeholder="Enter your password"
                    placeholderTextColor={palette.gray400}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (text.length > 0) {
                        const v = validatePassword(text);
                        setPasswordError(v.isValid ? null : v.error || null);
                      } else {
                        setPasswordError(null);
                      }
                    }}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                    returnKeyType="go"
                    onSubmitEditing={submit}
                    accessibilityLabel="Password"
                  />
                  <Pressable
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword((prev) => !prev)}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={palette.gray400}
                    />
                  </Pressable>
                </View>
                {passwordError && (
                  <View style={styles.errorRow}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={13} color={palette.danger} />
                    <Text style={styles.errorText}>{passwordError}</Text>
                  </View>
                )}
              </View>

              <Pressable
                style={[styles.submitButton, isLoading && styles.submitDisabled]}
                onPress={submit}
                disabled={isLoading}
                accessibilityLabel="Sign in"
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={palette.white} />
                ) : (
                  <Text style={styles.submitLabel}>Sign In</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.secondaryButton}
                onPress={() => router.push('/register')}
                accessibilityLabel="Create a new account"
              >
                <Text style={styles.secondaryLabel}>Create Account</Text>
              </Pressable>

              <Text style={styles.footerNote}>
                Your data is protected and never shared without consent.
              </Text>
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
  container: { flexGrow: 1, paddingBottom: 120 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  logoImage: {
    width: 88,
    height: 88,
  },
  appName: {
    fontFamily: Fonts.bold,
    fontSize: 26,
    fontWeight: '700',
    color: palette.text.primary,
  },
  appTagline: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: palette.text.tertiary,
  },
  form: {
    paddingHorizontal: 24,
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    fontWeight: '600',
    color: palette.text.secondary,
  },
  input: {
    backgroundColor: palette.input.background,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    color: palette.text.primary,
    fontFamily: Fonts.regular,
    borderWidth: 1,
    borderColor: palette.input.border,
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  inputFocused: {
    borderColor: palette.brandGreen,
    backgroundColor: palette.input.backgroundFocused,
  },
  inputError: {
    borderColor: palette.danger,
    backgroundColor: palette.input.backgroundError,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  errorText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: palette.danger,
  },
  submitButton: {
    backgroundColor: palette.brandGreen,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
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
  secondaryButton: {
    backgroundColor: palette.white,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: palette.brandGreen,
  },
  secondaryLabel: {
    fontFamily: Fonts.bold,
    color: palette.brandGreen,
    fontSize: 16,
    fontWeight: '600',
  },
  footerNote: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: palette.text.tertiary,
    textAlign: 'center',
    marginTop: 8,
  },
});
