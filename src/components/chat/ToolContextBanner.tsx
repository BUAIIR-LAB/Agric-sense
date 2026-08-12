import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppContext } from '@/context/AppContext';
import { AI_TOOL_ICONS, type AiToolSession } from '@/types/aiToolSession';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';

type Props = {
  session: AiToolSession;
  onClear?: () => void;
};

export function ToolContextBanner({ session, onClear }: Props) {
  const router = useRouter();
  const icon = AI_TOOL_ICONS[session.tool] as keyof typeof MaterialCommunityIcons.glyphMap;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name={icon} size={18} color={palette.brandGreen} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>
            {session.title}
          </Text>
          <Text style={styles.provenance} numberOfLines={2}>
            {session.provenance}
          </Text>
        </View>
        {onClear ? (
          <Pressable
            onPress={onClear}
            hitSlop={8}
            accessibilityLabel="Clear result context"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="close" size={18} color={palette.text.tertiary} />
          </Pressable>
        ) : null}
      </View>

      {session.metrics.length > 0 ? (
        <View style={styles.metrics}>
          {session.metrics.slice(0, 3).map((m) => (
            <View key={`${m.label}-${m.value}`} style={styles.metricChip}>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text style={styles.metricValue} numberOfLines={1}>
                {m.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {session.marketQuery ? (
        <Pressable
          style={styles.shopBtn}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/marketplace',
              params: { mode: 'buy', q: session.marketQuery },
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Shop farm inputs for this result"
        >
          <MaterialCommunityIcons name="storefront-outline" size={16} color={palette.brandGreenDark} />
          <Text style={styles.shopText}>
            {session.tool === 'diagnosis' ? 'Find treatments' : 'Shop farm inputs'}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={palette.brandGreenDark} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: palette.tint[100],
    borderWidth: 1,
    borderColor: palette.border.green,
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: palette.text.primary,
  },
  provenance: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: palette.text.muted,
  },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metricChip: {
    backgroundColor: palette.white,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: '48%',
  },
  metricLabel: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: palette.text.tertiary,
  },
  metricValue: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: palette.text.primary,
    marginTop: 1,
  },
  shopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: palette.white,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: palette.border.green,
  },
  shopText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: palette.brandGreenDark,
  },
});
