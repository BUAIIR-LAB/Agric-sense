import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { SUPPORTED_LANGUAGES, useAppContext } from '@/context/AppContext';
import { useSweetAlert } from '@/components/AlertProvider';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { spacing, radius } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const getInitials = (name: string | undefined) =>
  name
    ?.split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('') ?? 'U';

export default function ProfileScreen() {
  const router = useRouter();
  const { state, updateProfile, updateProfileWithAPI, logout, isOffline } = useAppContext();
  const { showAlert } = useSweetAlert();
  const profile = state.profile;
  const initials = getInitials(profile?.name);

  const [form, setForm] = useState({
    name: profile?.name ?? '',
    phoneNumber: profile?.phoneNumber ?? '',
    area: profile?.area ?? '',
    cropsGrown: (profile?.cropsGrown ?? []).join(', '),
    preferredLanguage: profile?.preferredLanguage ?? '',
  });
  const [originalForm, setOriginalForm] = useState({ ...form });
  const [isEditing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLangPickerVisible, setLangPickerVisible] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const handleLogout = async () => {
    showAlert('warning', 'Log Out', 'Are you sure you want to log out?', {
      showCancel: true,
      confirmText: 'Log Out',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setIsLoggingOut(true);
        try {
          await logout();
          showAlert('success', 'Logged Out', 'You have been logged out successfully.', {
            onConfirm: () => router.replace('/'),
          });
        } catch (error: any) {
          showAlert('error', 'Logout Error', error.message || 'Failed to log out. Please try again.');
        } finally {
          setIsLoggingOut(false);
        }
      },
    });
  };

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const startEditing = () => {
    setOriginalForm({ ...form });
    setEditing(true);
  };

  const cancelEditing = () => {
    setForm({ ...originalForm });
    setEditing(false);
  };

  const persistChanges = async () => {
    setIsSaving(true);
    try {
      const normalizedLanguage =
        SUPPORTED_LANGUAGES.find(
          (lang) => lang.toLowerCase() === form.preferredLanguage.trim().toLowerCase(),
        ) ?? profile?.preferredLanguage ?? SUPPORTED_LANGUAGES[0];

      const updates = {
        name: form.name,
        phoneNumber: form.phoneNumber,
        area: form.area,
        cropsGrown: form.cropsGrown
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        preferredLanguage: normalizedLanguage,
      };

      if (isOffline) {
        updateProfile(updates);
      } else {
        const success = await updateProfileWithAPI(updates);
        if (!success) {
          updateProfile(updates);
          showAlert('warning', 'Saved Locally', 'Profile saved on this device. Server sync will retry when online.');
          setEditing(false);
          return;
        }
      }

      setEditing(false);
      showAlert('success', 'Profile Updated', 'Your profile has been saved.');
    } catch (error: any) {
      showAlert('error', 'Update Failed', error.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarPress = async () => {
    if (!isEditing) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('warning', 'Permission Needed', 'Allow access to your photo library to update your avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="account-off" size={64} color={palette.gray500} />
          <Text style={styles.emptyTitle}>No Profile</Text>
          <Text style={styles.emptyText}>Register to continue</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/register')}
            accessibilityLabel="Register" accessibilityRole="button">
            <MaterialCommunityIcons name="account-plus" size={20} color={palette.white} />
            <Text style={styles.primaryButtonText}>Register</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Pressable
            style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.7 }]}
            onPress={() => setEditing(!isEditing)}
          >
            <Text style={styles.editButtonText}>{isEditing ? 'Cancel' : 'Edit'}</Text>
          </Pressable>
        </View>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <Pressable
            style={styles.avatarContainer}
            onPress={handleAvatarPress}
            disabled={!isEditing}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            {isEditing && (
              <View style={styles.avatarCameraOverlay}>
                <MaterialCommunityIcons name="camera" size={18} color={palette.white} />
              </View>
            )}
          </Pressable>
          <Text style={styles.nameText}>{profile.name}</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>

          {/* Profile card */}
          <View style={styles.contentCard}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="account-details" size={20} color={palette.brandGreen} />
              <Text style={styles.sectionTitle}>Profile Information</Text>
            </View>

            <View style={styles.formFields}>
              {/* Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <View style={[styles.inputWrapper, isEditing && styles.inputWrapperActive]}>
                  <MaterialCommunityIcons name="account" size={18} color={palette.gray500} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={form.name}
                    onChangeText={(t) => handleChange('name', t)}
                    editable={isEditing}
                    placeholder="Full name"
                    placeholderTextColor={palette.gray500}
                    accessibilityLabel="Full name"
                  />
                </View>
              </View>

              {/* Phone */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Phone Number</Text>
                <View style={[styles.inputWrapper, isEditing && styles.inputWrapperActive]}>
                  <MaterialCommunityIcons name="phone" size={18} color={palette.gray500} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={form.phoneNumber}
                    onChangeText={(t) => handleChange('phoneNumber', t)}
                    editable={isEditing}
                    placeholder="Phone number"
                    placeholderTextColor={palette.gray500}
                    keyboardType="phone-pad"
                    accessibilityLabel="Phone number"
                  />
                </View>
              </View>

              {/* Location */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Location / District</Text>
                <View style={[styles.inputWrapper, isEditing && styles.inputWrapperActive]}>
                  <MaterialCommunityIcons name="map-marker" size={18} color={palette.gray500} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={form.area}
                    onChangeText={(t) => handleChange('area', t)}
                    editable={isEditing}
                    placeholder="e.g. Kampala, Gulu"
                    placeholderTextColor={palette.gray500}
                    accessibilityLabel="Location"
                  />
                </View>
              </View>

              {/* Crops */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Crops Grown</Text>
                <View style={[styles.inputWrapper, isEditing && styles.inputWrapperActive]}>
                  <MaterialCommunityIcons name="sprout" size={18} color={palette.gray500} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={form.cropsGrown}
                    onChangeText={(t) => handleChange('cropsGrown', t)}
                    editable={isEditing}
                    placeholder="e.g. Maize, Beans, Cassava"
                    placeholderTextColor={palette.gray500}
                    multiline
                    accessibilityLabel="Crops grown"
                    accessibilityHint="Separate multiple crops with commas"
                  />
                </View>
              </View>

              {/* Language — picker, not free text */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Preferred Language</Text>
                <Pressable
                  style={[styles.inputWrapper, styles.pickerRow, isEditing && styles.inputWrapperActive]}
                  onPress={() => isEditing && setLangPickerVisible(true)}
                  accessibilityLabel={`Language: ${form.preferredLanguage || 'Select language'}`}
                  accessibilityRole={isEditing ? 'button' : undefined}
                  accessibilityHint={isEditing ? 'Tap to choose your preferred language' : undefined}
                >
                  <MaterialCommunityIcons name="translate" size={18} color={palette.gray500} style={styles.inputIcon} />
                  <Text style={[styles.input, styles.pickerText, !form.preferredLanguage && styles.pickerPlaceholder]}>
                    {form.preferredLanguage || 'Select language'}
                  </Text>
                  {isEditing && (
                    <MaterialCommunityIcons name="chevron-down" size={18} color={palette.brandGreen} />
                  )}
                </Pressable>
              </View>
            </View>
          </View>

          {/* Logout */}
          <View style={styles.logoutSection}>
            <Pressable
              style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
              onPress={handleLogout}
              disabled={isLoggingOut}
              accessibilityLabel="Log out"
              accessibilityRole="button"
            >
              {isLoggingOut ? (
                <ActivityIndicator size="small" color={palette.danger} />
              ) : (
                <MaterialCommunityIcons name="logout" size={20} color={palette.danger} />
              )}
              <Text style={styles.logoutButtonText}>Log Out</Text>
            </Pressable>
          </View>
        </View>

        {/* Save Button */}
        {isEditing && (
          <View style={styles.saveButtonContainer}>
            <Pressable
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={persistChanges}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={palette.white} />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        visible={isLangPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLangPickerVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setLangPickerVisible(false)}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Choose Language</Text>
            <FlatList
              data={SUPPORTED_LANGUAGES as unknown as string[]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const selected = form.preferredLanguage === item;
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.langOption,
                      selected && styles.langOptionSelected,
                      pressed && styles.langOptionPressed,
                    ]}
                    onPress={() => {
                      handleChange('preferredLanguage', item);
                      setLangPickerVisible(false);
                    }}
                    accessibilityLabel={item}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                  >
                    <Text style={[styles.langOptionText, selected && styles.langOptionTextSelected]}>
                      {item}
                    </Text>
                    {selected && (
                      <MaterialCommunityIcons name="check-circle" size={20} color={palette.brandGreen} />
                    )}
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.langDivider} />}
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.surface.screen,
  },
  container: {
    paddingBottom: spacing.xxl * 2,
  },
  contentSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.xl,
  },

  // ── Empty state ──────────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  emptyTitle: {
    ...typography.heading.h2,
    color: palette.charcoal,
    marginTop: spacing.md,
  },
  emptyText: {
    ...typography.body.large,
    color: palette.gray500,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.brandGreen,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  primaryButtonText: {
    ...typography.label.large,
    color: palette.white,
  },

  // ── Header ───────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 28,
    color: palette.charcoal,
  },
  editButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  editButtonText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: palette.brandGreen,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  nameText: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: palette.charcoal,
    marginTop: spacing.md,
  },
  formSection: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // ── Hero ────────────────────────────────────────────────────────────────────
  heroSection: {
    paddingTop: spacing.mega * 1.5,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xxl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroContent: {
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.xs,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarText: {
    fontFamily: Fonts.extraBold,
    fontSize: 40,
    color: palette.white,
  },
  avatarCameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.brandGreenMid,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.white,
  },
  heroName: {
    fontFamily: Fonts.extraBold,
    fontSize: 26,
    color: palette.white,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroMetaDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroMetaText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },

  // Edit controls
  heroActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
  },
  heroActionEdit: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroActionEditText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.white,
  },
  heroActionSave: {
    backgroundColor: palette.brandGreenMid,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minWidth: 80,
    justifyContent: 'center',
  },
  heroActionSaveText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: palette.white,
  },
  heroActionCancel: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border.green,
  },
  heroActionCancelText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.brandGreen,
  },

  // ── Content card ────────────────────────────────────────────────────────────
  contentCard: {
    backgroundColor: palette.white,
    borderRadius: 20,
    padding: spacing.xl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border.card,
    shadowColor: palette.brandGreenDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.heading.h3,
    color: palette.charcoal,
  },
  formFields: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: palette.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border.green,
    borderRadius: radius.md,
    backgroundColor: palette.surface.secondary,
  },
  inputWrapperActive: {
    borderColor: palette.brandGreen,
    backgroundColor: palette.input.backgroundFocused,
  },
  inputIcon: {
    paddingLeft: spacing.md,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: palette.charcoal,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.md,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  pickerRow: {
    justifyContent: 'space-between',
    paddingRight: spacing.md,
  },
  pickerText: {
    paddingVertical: spacing.md,
  },
  pickerPlaceholder: {
    color: palette.gray500,
  },

  // ── Logout ──────────────────────────────────────────────────────────────────
  logoutSection: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.white,
    borderRadius: 16,
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.xl,
    borderWidth: 1.5,
    borderColor: '#FFE0E0',
    shadowColor: '#D84315',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: palette.danger,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  saveButton: {
    backgroundColor: palette.brandGreen,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: palette.white,
  },

  // ── Language picker modal ────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: palette.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 36,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  pickerHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.ui.sheetHandle,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  pickerTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: palette.charcoal,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  langOptionSelected: {
    backgroundColor: palette.tint[100],
  },
  langOptionPressed: {
    backgroundColor: palette.tint[400],
  },
  langOptionText: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: palette.text.primary,
  },
  langOptionTextSelected: {
    fontFamily: Fonts.semiBold,
    color: palette.brandGreen,
  },
  langDivider: {
    height: 1,
    backgroundColor: palette.ui.divider,
    marginHorizontal: spacing.md,
  },
});
