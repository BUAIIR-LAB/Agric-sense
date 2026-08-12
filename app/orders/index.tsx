import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useOrders } from '@/context/OrdersContext';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';
import { formatUgx } from '@/types/marketplace';

export default function OrdersScreen() {
  const router = useRouter();
  const { orders } = useOrders();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={palette.text.primary} />
        </Pressable>
        <Text style={styles.topTitle}>Your orders</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="package-variant" size={56} color={palette.border.card} />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyBody}>When you checkout with Pesapal, orders appear here.</Text>
            <Pressable style={styles.shopBtn} onPress={() => router.replace('/(tabs)/marketplace')}>
              <Text style={styles.shopBtnText}>Browse marketplace</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/orders/${item.id}`)}
          >
            <View style={styles.cardHead}>
              <Text style={styles.cardId}>{item.id}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.cardMeta}>
              {new Date(item.createdAt).toLocaleString()} · {item.paymentMethodLabel}
            </Text>
            <Text style={styles.cardItems} numberOfLines={2}>
              {item.items.map((i) => `${i.title} ×${i.quantity}`).join(' · ')}
            </Text>
            <View style={styles.cardFoot}>
              <Text style={styles.cardTotal}>{formatUgx(item.totalUgx)}</Text>
              <Text style={styles.trackLink}>Track →</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
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
  list: { padding: spacing.lg, gap: 12, flexGrow: 1 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyTitle: { fontFamily: Fonts.bold, fontSize: 18, color: palette.text.primary },
  emptyBody: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: palette.text.muted,
    textAlign: 'center',
  },
  shopBtn: {
    marginTop: 8,
    backgroundColor: '#FFD814',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#FCD200',
  },
  shopBtnText: { fontFamily: Fonts.bold, fontSize: 14, color: palette.text.primary },
  card: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E3E6E6',
    padding: 14,
    gap: 6,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardId: { fontFamily: Fonts.bold, fontSize: 15, color: palette.text.primary },
  statusPill: {
    backgroundColor: '#E8F5E9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontFamily: Fonts.semiBold, fontSize: 11, color: palette.brandGreenDark },
  cardMeta: { fontFamily: Fonts.regular, fontSize: 12, color: palette.text.tertiary },
  cardItems: { fontFamily: Fonts.regular, fontSize: 13, color: palette.text.secondary },
  cardFoot: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTotal: { fontFamily: Fonts.bold, fontSize: 16, color: palette.text.primary },
  trackLink: { fontFamily: Fonts.semiBold, fontSize: 13, color: '#007185' },
});
