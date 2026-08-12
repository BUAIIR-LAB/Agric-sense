import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SuggestionChips } from '@/components/chat/SuggestionChips';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';

type Props = {
  onAskAi: () => void;
  onShop?: () => void;
  shopLabel?: string;
  suggestions?: string[];
  onSuggestion?: (text: string) => void;
  askDisabled?: boolean;
};

/**
 * Shared result-screen CTA block: Ask AI (primary), shop (secondary), suggestion chips.
 */
export function ResultAiActions({
  onAskAi,
  onShop,
  shopLabel = 'Shop farm inputs',
  suggestions = [],
  onSuggestion,
  askDisabled,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.primaryBtn, askDisabled && styles.disabled]}
        onPress={onAskAi}
        disabled={askDisabled}
        accessibilityRole="button"
        accessibilityLabel="Ask AgriSense AI"
      >
        <MaterialCommunityIcons name="robot-outline" size={20} color={palette.white} />
        <Text style={styles.primaryText}>Ask AgriSense AI</Text>
      </Pressable>

      {onShop ? (
        <Pressable
          style={styles.secondaryBtn}
          onPress={onShop}
          accessibilityRole="button"
          accessibilityLabel={shopLabel}
        >
          <MaterialCommunityIcons name="storefront-outline" size={20} color={palette.brandGreenDark} />
          <Text style={styles.secondaryText}>{shopLabel}</Text>
        </Pressable>
      ) : null}

      {suggestions.length > 0 && onSuggestion ? (
        <SuggestionChips
          suggestions={suggestions}
          onSelect={onSuggestion}
          disabled={askDisabled}
          label="Or ask about this result"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.md },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.brandGreen,
    borderRadius: radius.md,
    paddingVertical: 14,
    minHeight: 50,
  },
  primaryText: { fontFamily: Fonts.bold, fontSize: 15, color: palette.white },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.tint[100],
    borderRadius: radius.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.border.green,
  },
  secondaryText: { fontFamily: Fonts.bold, fontSize: 15, color: palette.brandGreenDark },
  disabled: { opacity: 0.55 },
});
