import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useOrders, type MobileOrderStatus } from '@/context/OrdersContext';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';
import { formatUgx } from '@/types/marketplace';

const STEPS: MobileOrderStatus[] = ['pending', 'paid', 'processing', 'shipped', 'delivered'];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getOrder } = useOrders();
  const order = id ? getOrder(id) : undefined;

  if (!order) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={palette.text.primary} />
          </Pressable>
          <Text style={styles.topTitle}>Order</Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={styles.missing}>Order not found.</Text>
      </SafeAreaView>
    );
  }

  const trackSteps =
    order.paymentMethod === 'cash'
      ? STEPS
      : (['paid', 'processing', 'shipped', 'delivered'] as MobileOrderStatus[]);
  const active = Math.max(0, trackSteps.indexOf(order.status));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={palette.text.primary} />
        </Pressable>
        <Text style={styles.topTitle}>Track order</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.orderId}>{order.id}</Text>
        <Text style={styles.meta}>
          {new Date(order.createdAt).toLocaleString()} · {order.paymentMethodLabel}
        </Text>
        <Text style={styles.ref}>Ref {order.paymentRef}</Text>
        {order.paymentMethod === 'cash' ? (
          <View style={styles.cashNote}>
            <Text style={styles.cashNoteText}>
              Pay {formatUgx(order.totalUgx)} in cash when the order is delivered.
            </Text>
          </View>
        ) : null}

        <Text style={styles.section}>Status</Text>
        {trackSteps.map((s, i) => (
          <View key={s} style={styles.stepRow}>
            <View style={[styles.dot, i <= active && styles.dotDone]} />
            <Text style={[styles.stepLabel, i <= active && styles.stepDone]}>
              {s === 'pending' ? 'Awaiting cash' : s.charAt(0).toUpperCase() + s.slice(1)}
              {i === active ? ' · current' : ''}
            </Text>
          </View>
        ))}

        <Text style={styles.section}>Items</Text>
        {order.items.map((item) => (
          <View key={`${item.listingId}-${item.title}`} style={styles.line}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineTitle}>{item.title}</Text>
              <Text style={styles.lineMeta}>
                Qty {item.quantity} · {item.unit}
              </Text>
            </View>
            <Text style={styles.linePrice}>
              {formatUgx(item.unitPriceUgx * item.quantity)}
            </Text>
          </View>
        ))}

        <Text style={styles.section}>Delivery</Text>
        <Text style={styles.body}>{order.deliveryAddress}</Text>
        <Text style={styles.meta}>{order.district}</Text>

        <View style={styles.totals}>
          <Row label="Subtotal" value={formatUgx(order.subtotalUgx)} />
          <Row
            label="Delivery"
            value={order.deliveryUgx === 0 ? 'FREE' : formatUgx(order.deliveryUgx)}
          />
          <Row label="Total" value={formatUgx(order.totalUgx)} strong />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.totalValue, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.surface.screen },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.light,
  },
  topTitle: { fontFamily: Fonts.bold, fontSize: 18, color: palette.text.primary },
  missing: {
    marginTop: 40,
    textAlign: 'center',
    fontFamily: Fonts.medium,
    color: palette.text.muted,
  },
  content: { padding: spacing.lg, gap: 8, paddingBottom: 40 },
  orderId: { fontFamily: Fonts.bold, fontSize: 20, color: palette.text.primary },
  meta: { fontFamily: Fonts.regular, fontSize: 13, color: palette.text.tertiary },
  ref: { fontFamily: Fonts.semiBold, fontSize: 13, color: palette.text.secondary },
  cashNote: {
    marginTop: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: radius.md,
    padding: 12,
  },
  cashNoteText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: palette.brandGreenDark,
    lineHeight: 18,
  },
  section: {
    marginTop: 16,
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: palette.text.muted,
    textTransform: 'uppercase',
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#879596',
  },
  dotDone: { borderColor: palette.brandGreen, backgroundColor: palette.brandGreen },
  stepLabel: { fontFamily: Fonts.regular, fontSize: 14, color: palette.text.tertiary },
  stepDone: { color: palette.text.primary, fontFamily: Fonts.semiBold },
  line: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border.light,
  },
  lineTitle: { fontFamily: Fonts.semiBold, fontSize: 14, color: palette.text.primary },
  lineMeta: { fontFamily: Fonts.regular, fontSize: 12, color: palette.text.tertiary },
  linePrice: { fontFamily: Fonts.bold, fontSize: 14, color: palette.text.primary },
  body: { fontFamily: Fonts.regular, fontSize: 14, color: palette.text.primary },
  totals: {
    marginTop: 16,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E3E6E6',
    padding: 14,
    gap: 8,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontFamily: Fonts.regular, fontSize: 14, color: palette.text.secondary },
  totalValue: { fontFamily: Fonts.semiBold, fontSize: 14, color: palette.text.primary },
  strong: { fontFamily: Fonts.bold, fontSize: 16 },
});
