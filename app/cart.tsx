import { useRouter } from 'expo-router';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useCart } from '@/context/CartContext';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';
import { formatUgx, parseUgxPrice } from '@/types/marketplace';

const CATEGORY_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Grains: 'corn',
  Roots: 'carrot',
  Legumes: 'food-apple',
  Crops: 'sprout',
  Livestock: 'cow',
  Fertilizer: 'bottle-tonic',
  Seeds: 'seed',
  Tools: 'tools',
};

const FREE_DELIVERY_MIN = 200_000;
const DELIVERY_FEE = 15_000;

export default function CartScreen() {
  const router = useRouter();
  const { items, itemCount, subtotalUgx, subtotalLabel, setQuantity, removeFromCart, clearCart } =
    useCart();

  const delivery =
    itemCount === 0 ? 0 : subtotalUgx >= FREE_DELIVERY_MIN ? 0 : DELIVERY_FEE;
  const totalLabel = formatUgx(subtotalUgx + delivery);

  const confirmClear = () => {
    Alert.alert('Clear cart?', 'Remove all items from your cart.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearCart },
    ]);
  };

  const checkout = () => {
    router.push('/checkout');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={palette.text.primary} />
        </Pressable>
        <Text style={styles.topTitle}>Cart</Text>
        {items.length > 0 ? (
          <Pressable onPress={confirmClear} hitSlop={8}>
            <Text style={styles.clearLink}>Clear</Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="cart-outline" size={64} color={palette.border.card} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyBody}>
            Browse the Marketplace and tap Add to cart on produce or farm inputs.
          </Text>
          <Pressable
            style={styles.shopBtn}
            onPress={() => router.replace('/(tabs)/marketplace')}
          >
            <Text style={styles.shopBtnText}>Continue shopping</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.subhead}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
            {items.map(({ listing, quantity }) => {
              const lineTotal = parseUgxPrice(listing.price) * quantity;
              const icon =
                CATEGORY_ICONS[listing.category] ??
                (listing.kind === 'produce' ? 'barn' : 'seed');
              return (
                <View key={listing.id} style={styles.line}>
                  <View style={styles.thumb}>
                    {listing.imageUri ? (
                      <Image
                        source={{ uri: listing.imageUri }}
                        style={styles.thumbImg}
                        resizeMode="cover"
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name={icon}
                        size={28}
                        color={palette.brandGreenDark}
                      />
                    )}
                  </View>
                  <View style={styles.lineBody}>
                    <Text style={styles.lineTitle} numberOfLines={2}>
                      {listing.title}
                    </Text>
                    <Text style={styles.lineMeta}>
                      {listing.seller} · {listing.unit.replace(/^UGX\s*/i, '')}
                    </Text>
                    <Text style={styles.linePrice}>{formatUgx(lineTotal)}</Text>
                    <View style={styles.qtyRow}>
                      <Pressable
                        style={styles.qtyBtn}
                        onPress={() => setQuantity(listing.id, quantity - 1)}
                        accessibilityLabel="Decrease quantity"
                      >
                        <MaterialCommunityIcons
                          name={quantity <= 1 ? 'trash-can-outline' : 'minus'}
                          size={18}
                          color={palette.text.primary}
                        />
                      </Pressable>
                      <Text style={styles.qtyValue}>{quantity}</Text>
                      <Pressable
                        style={styles.qtyBtn}
                        onPress={() => setQuantity(listing.id, quantity + 1)}
                        accessibilityLabel="Increase quantity"
                      >
                        <MaterialCommunityIcons name="plus" size={18} color={palette.text.primary} />
                      </Pressable>
                      <Pressable
                        onPress={() => removeFromCart(listing.id)}
                        hitSlop={8}
                        style={styles.deleteLink}
                      >
                        <Text style={styles.deleteText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{subtotalLabel}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Est. delivery</Text>
              <Text style={styles.totalsValue}>
                {delivery === 0 ? 'FREE' : formatUgx(delivery)}
              </Text>
            </View>
            {subtotalUgx < FREE_DELIVERY_MIN ? (
              <Text style={styles.deliveryHint}>
                Free delivery from {formatUgx(FREE_DELIVERY_MIN)}
              </Text>
            ) : null}
            <View style={[styles.totalsRow, styles.totalStrong]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{totalLabel}</Text>
            </View>
            <Pressable style={styles.checkoutBtn} onPress={checkout}>
              <Text style={styles.checkoutText}>Proceed to checkout</Text>
            </Pressable>
            <Pressable
              style={styles.continueLink}
              onPress={() => router.replace('/(tabs)/marketplace')}
            >
              <Text style={styles.continueText}>Continue shopping</Text>
            </Pressable>
          </View>
        </>
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: palette.border.light,
    backgroundColor: palette.white,
  },
  topTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: palette.text.primary,
  },
  clearLink: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: '#007185',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: palette.text.primary,
    marginTop: 8,
  },
  emptyBody: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: palette.text.muted,
    textAlign: 'center',
  },
  shopBtn: {
    marginTop: 12,
    backgroundColor: '#FFD814',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#FCD200',
  },
  shopBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: palette.text.primary,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 24,
    gap: 12,
  },
  subhead: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.text.muted,
    marginBottom: 4,
  },
  line: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E3E6E6',
    padding: 12,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: palette.tint[100],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  lineBody: { flex: 1, gap: 2 },
  lineTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: palette.text.primary,
  },
  lineMeta: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: palette.text.tertiary,
  },
  linePrice: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: palette.text.primary,
    marginTop: 4,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D5D9D9',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F2F2',
  },
  qtyValue: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    minWidth: 24,
    textAlign: 'center',
    color: palette.text.primary,
  },
  deleteLink: { marginLeft: 4 },
  deleteText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: '#007185',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: palette.border.light,
    backgroundColor: palette.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: 6,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalsLabel: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: palette.text.secondary,
  },
  totalsValue: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.text.primary,
  },
  deliveryHint: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: palette.text.tertiary,
  },
  totalStrong: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border.light,
  },
  totalLabel: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: palette.text.primary,
  },
  totalValue: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: palette.text.primary,
  },
  checkoutBtn: {
    marginTop: 10,
    backgroundColor: '#FFD814',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCD200',
  },
  checkoutText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: palette.text.primary,
  },
  continueLink: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  continueText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: '#007185',
  },
});
