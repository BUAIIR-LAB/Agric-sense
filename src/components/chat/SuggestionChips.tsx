import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';

type Props = {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
  label?: string;
};

export function SuggestionChips({
  suggestions,
  onSelect,
  disabled,
  label = 'Suggested next questions',
}: Props) {
  if (!suggestions.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {suggestions.map((text) => (
          <Pressable
            key={text}
            style={({ pressed }) => [
              styles.chip,
              pressed && styles.chipPressed,
              disabled && styles.chipDisabled,
            ]}
            disabled={disabled}
            onPress={() => {
              void Haptics.selectionAsync();
              onSelect(text);
            }}
            accessibilityRole="button"
            accessibilityLabel={text}
          >
            <MaterialCommunityIcons name="lightning-bolt-outline" size={14} color={palette.brandGreen} />
            <Text style={styles.chipText}>{text}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: 8,
  },
  label: {
    paddingHorizontal: spacing.md,
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: palette.text.muted,
  },
  row: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 280,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border.green,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipPressed: { opacity: 0.85 },
  chipDisabled: { opacity: 0.5 },
  chipText: {
    flexShrink: 1,
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: palette.text.primary,
  },
});
