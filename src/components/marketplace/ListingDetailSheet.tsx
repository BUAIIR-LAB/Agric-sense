import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';
import {
  DELIVERY_PERIOD_LABELS,
  getListingImages,
  getListingPriceDisplay,
  type MarketListing,
} from '@/types/marketplace';

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

const CATEGORY_COLORS: Record<string, string> = {
  Grains: '#FFF8E1',
  Roots: '#FBE9E7',
  Legumes: '#E8F5E9',
  Crops: '#E8F5E9',
  Livestock: '#FFF3E0',
  Fertilizer: '#E3F2FD',
  Seeds: '#F1F8E9',
  Tools: '#ECEFF1',
};

const WIDTH = Dimensions.get('window').width;

type Props = {
  listing: MarketListing | null;
  cartQty: number;
  phoneHint?: string;
  inquirySent: boolean;
  onClose: () => void;
  onAddToCart: (qty: number) => void;
  onViewCart: () => void;
  onInquiry: () => void;
};

export function ListingDetailSheet({
  listing,
  cartQty,
  phoneHint,
  inquirySent,
  onClose,
  onAddToCart,
  onViewCart,
  onInquiry,
}: Props) {
  const images = useMemo(() => (listing ? getListingImages(listing) : []), [listing]);
  const [page, setPage] = useState(0);
  const [qty, setQty] = useState(1);
  const [addedFlash, setAddedFlash] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!listing) return;
    const min = listing.minOrderQty && listing.minOrderQty > 1 ? listing.minOrderQty : 1;
    setQty(min);
    setPage(0);
    setAddedFlash(false);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [listing?.id]);

  if (!listing) return null;

  const deal = getListingPriceDisplay(listing);
  const stock = listing.stock ?? 99;
  const minQty = listing.minOrderQty && listing.minOrderQty > 1 ? listing.minOrderQty : 1;
  const maxQty = Math.max(minQty, Math.min(30, stock));
  const outOfStock = stock <= 0;
  const icon =
    CATEGORY_ICONS[listing.category] ?? (listing.kind === 'produce' ? 'barn' : 'seed');
  const bg = CATEGORY_COLORS[listing.category] ?? palette.tint[100];

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setPage(Math.round(x / Math.max(1, WIDTH - 48)));
  };

  return (
    <Modal visible={!!listing} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            <View style={[styles.gallery, { backgroundColor: bg }]}>
              {images.length > 0 ? (
                <>
                  <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                  >
                    {images.map((uri, i) => (
                      <Image
                        key={`${uri}-${i}`}
                        source={{ uri }}
                        style={styles.galleryImage}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                  {images.length > 1 ? (
                    <Text style={styles.counter}>
                      {page + 1} / {images.length}
                    </Text>
                  ) : null}
                </>
              ) : (
                <MaterialCommunityIcons name={icon} size={64} color={palette.brandGreenDark} />
              )}
            </View>

            <Text style={styles.title}>{listing.title}</Text>
            <Text style={styles.meta}>
              {listing.kind === 'produce' ? `Sold by ${listing.seller} · ` : ''}
              Ships from {listing.location || 'Uganda'}
              {listing.quality ? ` · ${listing.quality}` : ''}
            </Text>

            <View style={styles.deliveryRow}>
              <Text
                style={[
                  styles.deliveryPill,
                  (listing.deliveryMode || 'paid') === 'free'
                    ? styles.deliveryPillFree
                    : styles.deliveryPillPaid,
                ]}
              >
                {(listing.deliveryMode || 'paid') === 'free'
                  ? 'Free delivery'
                  : 'Delivery fee applies'}
              </Text>
              <Text style={styles.deliveryPeriod}>
                Arrives in{' '}
                {listing.deliveryPeriod && DELIVERY_PERIOD_LABELS[listing.deliveryPeriod]
                  ? DELIVERY_PERIOD_LABELS[listing.deliveryPeriod]
                  : DELIVERY_PERIOD_LABELS['3_days']}
              </Text>
            </View>

            {deal.hasDiscount ? (
              <View style={styles.limitedDeal}>
                <Text style={styles.limitedDealText}>Limited time deal</Text>
              </View>
            ) : null}

            <Text style={[styles.price, deal.hasDiscount && styles.priceSale]}>
              UGX {listing.price}
              <Text style={styles.unit}>  {listing.unit.replace(/^UGX\s*/i, '')}</Text>
            </Text>
            {deal.hasDiscount && deal.listPriceUgx != null ? (
              <>
                <Text style={styles.compare}>
                  List:{' '}
                  <Text style={styles.strike}>UGX {deal.listPriceUgx.toLocaleString()}</Text>
                </Text>
                <Text style={styles.save}>
                  Save UGX {deal.saveUgx.toLocaleString()} ({deal.percentOff}%)
                </Text>
              </>
            ) : null}

            <Text style={styles.stock}>
              {outOfStock
                ? 'Out of stock'
                : `In stock (${stock.toLocaleString()} available)`}
              {minQty > 1 ? ` · Min order ${minQty}` : ''}
            </Text>

            <Text style={styles.desc}>{listing.description}</Text>

            {!outOfStock ? (
              <View style={styles.qtyRow}>
                <Text style={styles.qtyLabel}>Qty</Text>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={() => setQty((q) => Math.max(minQty, q - 1))}
                >
                  <MaterialCommunityIcons name="minus" size={18} color={palette.text.primary} />
                </Pressable>
                <Text style={styles.qtyValue}>{qty}</Text>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={() => setQty((q) => Math.min(maxQty, q + 1))}
                >
                  <MaterialCommunityIcons name="plus" size={18} color={palette.text.primary} />
                </Pressable>
              </View>
            ) : null}

            {inquirySent ? (
              <View style={styles.successBox}>
                <MaterialCommunityIcons name="check-circle" size={28} color={palette.brandGreen} />
                <Text style={styles.successText}>
                  Request sent. {listing.seller} will contact you
                  {phoneHint ? ` at ${phoneHint}` : ''}.
                </Text>
              </View>
            ) : (
              <>
                <Pressable
                  style={[styles.primaryBtn, outOfStock && styles.disabled]}
                  disabled={outOfStock}
                  onPress={() => {
                    onAddToCart(qty);
                    setAddedFlash(true);
                  }}
                >
                  <MaterialCommunityIcons name="cart-plus" size={20} color={palette.text.primary} />
                  <Text style={styles.primaryBtnText}>
                    {addedFlash || cartQty > 0
                      ? `Added · ${cartQty || qty} in cart`
                      : 'Add to cart'}
                  </Text>
                </Pressable>
                {addedFlash ? (
                  <Pressable style={styles.viewCartBtn} onPress={onViewCart}>
                    <Text style={styles.viewCartBtnText}>View cart</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.inquiryBtn} onPress={onInquiry}>
                  <Text style={styles.inquiryBtnText}>
                    {listing.kind === 'produce' ? 'Request to buy' : 'Request quote'}
                  </Text>
                </Pressable>
              </>
            )}

            <Pressable style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryBtnText}>Close</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: 36,
    maxHeight: '92%',
  },
  gallery: {
    height: 200,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  galleryImage: {
    width: WIDTH - 48,
    height: 200,
  },
  counter: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    overflow: 'hidden',
  },
  title: { fontFamily: Fonts.bold, fontSize: 20, color: palette.text.primary },
  meta: { fontFamily: Fonts.regular, fontSize: 13, color: palette.text.tertiary },
  deliveryRow: { gap: 4, marginTop: 2 },
  deliveryPill: {
    alignSelf: 'flex-start',
    fontFamily: Fonts.bold,
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  deliveryPillFree: { backgroundColor: '#E7F6EC', color: '#067D3A' },
  deliveryPillPaid: { backgroundColor: '#FFF4E5', color: '#9A5B00' },
  deliveryPeriod: { fontFamily: Fonts.regular, fontSize: 12, color: palette.text.tertiary },
  limitedDeal: {
    alignSelf: 'flex-start',
    backgroundColor: '#CC0C39',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
  },
  limitedDealText: { fontFamily: Fonts.bold, fontSize: 12, color: palette.white },
  price: { fontFamily: Fonts.bold, fontSize: 22, color: palette.text.primary },
  priceSale: { color: '#B12704' },
  unit: { fontFamily: Fonts.regular, fontSize: 14, color: palette.text.muted },
  compare: { fontFamily: Fonts.regular, fontSize: 13, color: palette.text.tertiary },
  strike: { textDecorationLine: 'line-through' },
  save: { fontFamily: Fonts.semiBold, fontSize: 13, color: '#CC0C39' },
  stock: { fontFamily: Fonts.medium, fontSize: 13, color: '#007600' },
  desc: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: palette.text.secondary,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  qtyLabel: { fontFamily: Fonts.semiBold, fontSize: 14, color: palette.text.primary },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D5D9D9',
    backgroundColor: '#F0F2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    minWidth: 24,
    textAlign: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FFD814',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FCD200',
  },
  disabled: { opacity: 0.5 },
  primaryBtnText: { fontFamily: Fonts.bold, fontSize: 15, color: palette.text.primary },
  viewCartBtn: {
    backgroundColor: '#FFA41C',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF8F00',
  },
  viewCartBtnText: { fontFamily: Fonts.bold, fontSize: 15, color: palette.text.primary },
  inquiryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border.card,
  },
  inquiryBtnText: { fontFamily: Fonts.semiBold, fontSize: 14, color: palette.text.secondary },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontFamily: Fonts.semiBold, fontSize: 14, color: palette.text.secondary },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: '#E8F5E9',
  },
  successText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: palette.brandGreenDark,
  },
});
