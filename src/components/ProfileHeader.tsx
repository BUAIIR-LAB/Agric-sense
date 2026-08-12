import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppContext } from '@/context/AppContext';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { spacing } from '@/theme/spacing';

const getInitials = (name?: string) =>
  name
    ?.split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || '';

export default function ProfileHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useAppContext();
  const initials = getInitials(state.profile?.name);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Pressable
        style={({ pressed }) => [styles.profileButton, pressed && { opacity: 0.85 }]}
        onPress={() => router.push('/(tabs)/profile')}
        accessibilityLabel="Open profile"
        accessibilityRole="button"
        accessibilityHint="View and edit your farmer profile"
      >
        {initials ? (
          <Text style={styles.initials}>{initials}</Text>
        ) : (
          <MaterialCommunityIcons name="account-circle" size={28} color={palette.brandGreen} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: palette.border.light,
  },
  initials: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: palette.brandGreen,
  },
});
