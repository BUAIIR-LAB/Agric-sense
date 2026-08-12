import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';

import ProfileHeader from '@/components/ProfileHeader';
import {
  PostListingForm,
  type SubmittedProduceListing,
} from '@/components/marketplace/PostListingForm';
import { ListingDetailSheet } from '@/components/marketplace/ListingDetailSheet';
import { useAppContext } from '@/context/AppContext';
import { useCart } from '@/context/CartContext';
import apiService from '@/services/api';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';
import { TAB_BAR_HEIGHT } from '@/constants/layout';
import type { MarketListing } from '@/types/marketplace';
import {
  DELIVERY_PERIOD_LABELS,
  getListingPriceDisplay,
  listPriceFromDiscount,
} from '@/types/marketplace';

type MarketMode = 'sell' | 'buy';
type Listing = MarketListing;
type SortKey = 'featured' | 'price-asc' | 'price-desc';

const GRID_GAP = 10;
const SCREEN_PAD = spacing.lg;
const CARD_WIDTH = (Dimensions.get('window').width - SCREEN_PAD * 2 - GRID_GAP) / 2;

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

const PRODUCE: Listing[] = [
  {
    id: 'p1',
    title: 'Fresh maize (dry)',
    category: 'Grains',
    price: '1,200',
    unit: 'UGX / kg',
    location: 'Tororo',
    seller: 'Okello Farms',
    kind: 'produce',
    description: 'Sun-dried maize, clean and ready for mill. Minimum 50 kg.',
    rating: 4.6,
    reviews: 28,
    badge: 'Best seller',
    compareAtPrice: '1,500',
    stock: 4200,
  },
  {
    id: 'p2',
    title: 'Cassava roots',
    category: 'Roots',
    price: '800',
    unit: 'UGX / kg',
    location: 'Busia',
    seller: 'Auma Produce',
    kind: 'produce',
    description: 'Freshly harvested cassava. Available for pickup or delivery nearby.',
    rating: 4.3,
    reviews: 14,
    stock: 1800,
  },
  {
    id: 'p3',
    title: 'Beans (NABE 15)',
    category: 'Legumes',
    price: '3,500',
    unit: 'UGX / kg',
    location: 'Mbale',
    seller: 'Green Valley Co-op',
    kind: 'produce',
    description: 'Sorted beans, suitable for seed or market.',
    rating: 4.8,
    reviews: 41,
    badge: 'Top rated',
    compareAtPrice: '4,200',
    stock: 920,
  },
  {
    id: 'p4',
    title: 'Groundnuts (red)',
    category: 'Legumes',
    price: '4,200',
    unit: 'UGX / kg',
    location: 'Soroti',
    seller: 'Teso Growers',
    kind: 'produce',
    description: 'Clean red groundnuts, sundried. Ideal for paste or roasting.',
    rating: 4.5,
    reviews: 19,
    stock: 640,
  },
];

const INPUTS: Listing[] = [
  {
    id: 'i1',
    title: 'NPK 17:17:17 fertilizer',
    category: 'Fertilizer',
    price: '95,000',
    unit: 'UGX / 50kg',
    location: 'Tororo Agro Shop',
    seller: 'FarmCare Supplies',
    kind: 'input',
    description: 'Balanced fertilizer for maize and beans. Delivery available in Tororo district.',
    rating: 4.7,
    reviews: 63,
    badge: 'Best seller',
    compareAtPrice: '120,000',
    stock: 180,
  },
  {
    id: 'i2',
    title: 'Bean seed (K132)',
    category: 'Seeds',
    price: '8,500',
    unit: 'UGX / kg',
    location: 'Busitema',
    seller: 'SeedLink Uganda',
    kind: 'input',
    description: 'Certified bean seed. Germination tested.',
    rating: 4.4,
    reviews: 22,
    stock: 350,
  },
  {
    id: 'i3',
    title: 'Knapsack sprayer 16L',
    category: 'Tools',
    price: '75,000',
    unit: 'UGX / piece',
    location: 'Mbale',
    seller: 'AgriTools Hub',
    kind: 'input',
    description: 'Manual sprayer for pesticides and foliar feed.',
    rating: 4.2,
    reviews: 37,
    compareAtPrice: '95,000',
    stock: 64,
  },
  {
    id: 'i4',
    title: 'Soil pH test kit',
    category: 'Tools',
    price: '28,000',
    unit: 'UGX / kit',
    location: 'Tororo',
    seller: 'FarmCare Supplies',
    kind: 'input',
    description: 'Simple kit for field pH checks. Includes color chart.',
    rating: 4.6,
    reviews: 18,
    badge: 'New',
    stock: 120,
  },
  {
    id: 'i5',
    title: 'Urea 46% fertilizer',
    category: 'Fertilizer',
    price: '88,000',
    unit: 'UGX / 50kg',
    location: 'Jinja',
    seller: 'EastAgro Depot',
    kind: 'input',
    description: 'High-nitrogen fertilizer for vegetative growth stages.',
    rating: 4.5,
    reviews: 51,
    compareAtPrice: '105,000',
    stock: 95,
  },
  {
    id: 'i6',
    title: 'Maize hybrid seed',
    category: 'Seeds',
    price: '12,000',
    unit: 'UGX / kg',
    location: 'Kampala',
    seller: 'SeedLink Uganda',
    kind: 'input',
    description: 'Drought-tolerant hybrid maize. Pack of certified seed.',
    rating: 4.9,
    reviews: 89,
    badge: 'Top rated',
    compareAtPrice: '15,000',
    stock: 400,
  },
];

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.3;
  return (
    <View style={styles.starsRow}>
      {Array.from({ length: 5 }).map((_, i) => {
        let name: keyof typeof MaterialCommunityIcons.glyphMap = 'star-outline';
        if (i < full) name = 'star';
        else if (i === full && half) name = 'star-half-full';
        return (
          <MaterialCommunityIcons
            key={i}
            name={name}
            size={12}
            color="#DE7921"
          />
        );
      })}
    </View>
  );
}

function ProductCard({
  item,
  onPress,
}: {
  item: Listing;
  onPress: () => void;
}) {
  const icon = CATEGORY_ICONS[item.category] ?? (item.kind === 'produce' ? 'barn' : 'seed');
  const bg = CATEGORY_COLORS[item.category] ?? palette.tint[100];
  const deal = getListingPriceDisplay(item);
  const cornerBadge = deal.hasDiscount
    ? `-${deal.percentOff}%`
    : item.badge;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={[styles.imageArea, { backgroundColor: bg }]}>
        {cornerBadge ? (
          <View style={[styles.badge, deal.hasDiscount && styles.dealBadge]}>
            <Text style={styles.badgeText}>{cornerBadge}</Text>
          </View>
        ) : null}
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <MaterialCommunityIcons name={icon} size={48} color={palette.brandGreenDark} />
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.ratingRow}>
          <Stars rating={item.rating} />
          <Text style={styles.reviewsText}>{item.reviews}</Text>
        </View>
        <Text style={[styles.cardPrice, deal.hasDiscount && styles.cardPriceSale]}>
          UGX {item.price}
        </Text>
        {deal.hasDiscount && deal.listPriceUgx != null ? (
          <>
            <Text style={styles.comparePrice}>
              List: <Text style={styles.strike}>UGX {deal.listPriceUgx.toLocaleString()}</Text>
            </Text>
            <Text style={styles.saveLine}>
              Save UGX {deal.saveUgx.toLocaleString()} ({deal.percentOff}%)
            </Text>
          </>
        ) : null}
        <Text style={styles.cardUnit}>{item.unit.replace(/^UGX\s*\/\s*/i, '')}</Text>
        {item.quality ? (
          <Text style={styles.cardQuality}>{item.quality}</Text>
        ) : null}
        <View style={styles.deliveryMeta}>
          <Text
            style={[
              styles.deliveryPill,
              (item.deliveryMode || 'paid') === 'free'
                ? styles.deliveryPillFree
                : styles.deliveryPillPaid,
            ]}
          >
            {(item.deliveryMode || 'paid') === 'free' ? 'Free delivery' : 'Delivery fee applies'}
          </Text>
          <Text style={styles.deliveryPeriod}>
            Arrives in{' '}
            {item.deliveryPeriod && DELIVERY_PERIOD_LABELS[item.deliveryPeriod]
              ? DELIVERY_PERIOD_LABELS[item.deliveryPeriod]
              : DELIVERY_PERIOD_LABELS['3_days']}
          </Text>
        </View>
        {item.stock != null ? (
          <Text style={styles.cardStock}>
            {item.stock > 0 ? `${item.stock.toLocaleString()} in stock` : 'Out of stock'}
          </Text>
        ) : null}
        {item.kind === 'produce' ? (
          <Text style={styles.cardSeller} numberOfLines={1}>
            {item.seller}
          </Text>
        ) : null}
        <View style={styles.locationRow}>
          <MaterialCommunityIcons name="truck-delivery-outline" size={12} color={palette.text.tertiary} />
          <Text style={styles.cardLocation} numberOfLines={1}>
            Ships from {item.location || 'Uganda'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function qualityLabel(q: string) {
  switch (q) {
    case 'premium':
      return 'Premium';
    case 'grade_a':
      return 'Grade A';
    case 'grade_b':
      return 'Grade B';
    default:
      return 'Standard';
  }
}

function draftToListing(
  draft: SubmittedProduceListing,
  sellerName: string,
): Listing {
  const priceNum = Number.parseFloat(draft.price.replace(/,/g, '')) || 0;
  const discount = draft.applyDiscount ? Number.parseFloat(draft.discountPercent) || 0 : 0;
  const pct = discount > 0 ? Math.min(99, Math.round(discount)) : 0;
  const compare = pct > 0 ? listPriceFromDiscount(priceNum, pct) : undefined;
  return {
    id: draft.id,
    title: draft.title,
    category: draft.produceKind === 'crop' ? 'Crops' : 'Livestock',
    price: priceNum.toLocaleString(),
    unit: `UGX / ${draft.stockUnit}`,
    location: draft.location,
    seller: draft.brand || sellerName || 'Your farm',
    kind: 'produce',
    description: draft.description,
    rating: 5,
    reviews: 0,
    badge: pct > 0 ? `${pct}% off` : 'Yours',
    imageUri: draft.photos[0],
    images: draft.photos,
    stock: Number.parseFloat(draft.stockQty.replace(/,/g, '')) || 0,
    minOrderQty: Number.parseFloat(draft.minOrderQty.replace(/,/g, '')) || undefined,
    compareAtPrice: compare ? compare.toLocaleString() : undefined,
    discountPercent: pct || undefined,
    deliveryMode: draft.deliveryMode || 'paid',
    deliveryPeriod: draft.deliveryPeriod || '3_days',
    quality: qualityLabel(draft.quality),
    saleChannel: draft.saleChannel,
  };
}

function mapApiProduct(p: Record<string, unknown>): Listing {
  const price = Number(p.price_ugx ?? 0);
  const compare = p.compare_at_price_ugx != null ? Number(p.compare_at_price_ugx) : undefined;
  const images = Array.isArray(p.images) ? (p.images as string[]) : [];
  const discountRaw = p.discount_percent != null ? Number(p.discount_percent) : 0;
  const deliveryMode =
    p.delivery_mode === 'free' || p.delivery_mode === 'paid' ? p.delivery_mode : 'paid';
  const deliveryPeriod =
    p.delivery_period === '24_hours' ||
    p.delivery_period === '3_days' ||
    p.delivery_period === '1_week'
      ? p.delivery_period
      : '3_days';
  return {
    id: String(p.id),
    title: String(p.title ?? ''),
    category: String(p.category ?? ''),
    price: price.toLocaleString(),
    unit: String(p.unit ?? 'kg'),
    location: String(p.location ?? ''),
    seller: String(p.seller_name ?? ''),
    kind: p.kind === 'input' ? 'input' : 'produce',
    description: String(p.description ?? ''),
    rating: typeof p.rating === 'number' ? p.rating : 4.5,
    reviews: typeof p.reviews_count === 'number' ? p.reviews_count : 0,
    badge: typeof p.badge === 'string' ? p.badge : undefined,
    imageUri: images[0],
    images,
    stock: typeof p.stock === 'number' ? p.stock : 0,
    minOrderQty: typeof p.min_order_qty === 'number' ? p.min_order_qty : undefined,
    compareAtPrice: compare && compare > price ? compare.toLocaleString() : undefined,
    discountPercent: discountRaw > 0 ? discountRaw : undefined,
    deliveryMode,
    deliveryPeriod,
    quality: typeof p.quality === 'string' ? p.quality : undefined,
    saleChannel: typeof p.sale_channel === 'string' ? p.sale_channel : undefined,
  };
}

async function uriToBase64DataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });
  const lower = uri.toLowerCase();
  const mime = lower.endsWith('.png')
    ? 'image/png'
    : lower.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';
  return `data:${mime};base64,${base64}`;
}

export default function MarketplaceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; q?: string }>();
  const { state } = useAppContext();
  const { addToCart, itemCount, getQuantity } = useCart();
  const [mode, setMode] = useState<MarketMode>(
    params.mode === 'sell' ? 'sell' : 'buy',
  );
  const [query, setQuery] = useState(
    typeof params.q === 'string' ? params.q : Array.isArray(params.q) ? params.q[0] ?? '' : '',
  );
  const [selected, setSelected] = useState<Listing | null>(null);
  const [showSellForm, setShowSellForm] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [apiProduce, setApiProduce] = useState<Listing[]>([]);
  const [apiInputs, setApiInputs] = useState<Listing[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [submittingListing, setSubmittingListing] = useState(false);
  const [sort, setSort] = useState<SortKey>('featured');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    if (params.mode === 'sell' || params.mode === 'buy') {
      setMode(params.mode);
    }
  }, [params.mode]);

  useEffect(() => {
    const q = Array.isArray(params.q) ? params.q[0] : params.q;
    if (typeof q === 'string') setQuery(q);
  }, [params.q]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [produceRes, inputRes] = await Promise.all([
        apiService.getMarketplaceListings('produce'),
        apiService.getMarketplaceListings('input'),
      ]);
      const produce = (produceRes.items as Record<string, unknown>[]).map(mapApiProduct);
      const inputs = (inputRes.items as Record<string, unknown>[]).map(mapApiProduct);
      setApiProduce(produce.length ? produce : PRODUCE);
      setApiInputs(inputs.length ? inputs : INPUTS);
    } catch (e) {
      console.warn('Marketplace catalog load failed, using local fixtures', e);
      setApiProduce(PRODUCE);
      setApiInputs(INPUTS);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const catalog = mode === 'sell' ? apiProduce : apiInputs;
  const categories = useMemo(
    () => Array.from(new Set(catalog.map((c) => c.category))),
    [catalog],
  );
  const data = useMemo(
    () => (mode === 'sell' ? [...myListings, ...catalog] : catalog),
    [mode, myListings, catalog],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = data.filter((item) => {
      if (inStockOnly && (item.stock ?? 1) <= 0) return false;
      if (category && item.category !== category) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.seller.toLowerCase().includes(q)
      );
    });
    rows = [...rows];
    if (sort === 'price-asc') {
      rows.sort(
        (a, b) =>
          Number.parseFloat(a.price.replace(/,/g, '')) -
          Number.parseFloat(b.price.replace(/,/g, '')),
      );
    } else if (sort === 'price-desc') {
      rows.sort(
        (a, b) =>
          Number.parseFloat(b.price.replace(/,/g, '')) -
          Number.parseFloat(a.price.replace(/,/g, '')),
      );
    }
    return rows;
  }, [data, query, sort, inStockOnly, category]);

  const openInquiry = (item: Listing) => {
    setSelected(item);
    setInquirySent(false);
  };

  const submitInquiry = async () => {
    if (!selected) return;
    try {
      if (state.isAuthenticated) {
        await apiService.submitMarketplaceInquiry({
          product_id: selected.id,
          type: 'buy',
          message: `Interested in ${selected.title}`,
        });
      }
    } catch (e) {
      console.warn('Inquiry API failed', e);
    }
    setInquirySent(true);
  };

  const handleListingSubmit = async (draft: SubmittedProduceListing) => {
    if (submittingListing) return;
    if (!state.isAuthenticated) {
      Alert.alert('Sign in required', 'Please sign in to post a produce listing.');
      return;
    }
    setSubmittingListing(true);
    try {
      const images_base64 = await Promise.all(draft.photos.map(uriToBase64DataUri));
      const priceNum = Number.parseFloat(draft.price.replace(/,/g, '')) || 0;
      const discount = draft.applyDiscount
        ? Number.parseFloat(draft.discountPercent.replace(/,/g, '')) || 0
        : 0;
      const pct = discount > 0 ? Math.min(99, Math.round(discount)) : 0;
      const compare = pct > 0 ? listPriceFromDiscount(priceNum, pct) : undefined;
      const created = await apiService.createMarketplaceListing({
        kind: 'produce',
        title: draft.title || draft.productName || 'Produce',
        category: draft.produceKind === 'livestock' ? 'Livestock' : 'Crops',
        description: draft.description || '',
        price_ugx: Math.round(priceNum),
        compare_at_price_ugx: compare,
        discount_percent: pct,
        unit: draft.stockUnit || 'kg',
        stock: Number.parseFloat(draft.stockQty.replace(/,/g, '')) || 0,
        min_order_qty: Number.parseFloat(String(draft.minOrderQty || '').replace(/,/g, '')) || undefined,
        images_base64,
        location: draft.location || state.profile?.area || '',
        quality: draft.quality,
        sale_channel: draft.saleChannel,
        vat_mode: draft.vatMode,
        organic: draft.organic,
        delivery_available: true,
        delivery_mode: draft.deliveryMode || 'paid',
        delivery_period: draft.deliveryPeriod || '3_days',
        harvest_date: draft.harvestDate,
        brand: draft.brand,
        contact_phone: draft.contactPhone || state.profile?.phoneNumber,
        produce_kind: draft.produceKind,
        product_name: draft.productName || draft.title,
        badge: pct > 0 ? `${pct}% off` : undefined,
      });
      const listing = mapApiProduct(created.product as Record<string, unknown>);
      setMyListings((prev) => [listing, ...prev]);
      setShowSellForm(false);
      setMode('sell');
      await loadCatalog();
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e && 'response' in e
            ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Could not publish listing.')
            : 'Could not publish listing.';
      Alert.alert('Listing failed', msg);
      // Offline fallback: keep local listing
      const listing = draftToListing(draft, state.profile?.name ?? 'Your farm');
      setMyListings((prev) => [listing, ...prev]);
      setShowSellForm(false);
      setMode('sell');
    } finally {
      setSubmittingListing(false);
    }
  };

  const cartQty = selected ? getQuantity(selected.id) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileHeader />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Marketplace</Text>
          <Text style={styles.subtitle}>Sell produce · Buy farm inputs</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push('/orders')}
            accessibilityLabel="Your orders"
          >
            <MaterialCommunityIcons name="package-variant-closed" size={22} color={palette.text.primary} />
          </Pressable>
          <Pressable
            style={styles.cartBtn}
            onPress={() => router.push('/cart')}
            accessibilityRole="button"
            accessibilityLabel={`Cart, ${itemCount} items`}
          >
            <MaterialCommunityIcons name="cart-outline" size={24} color={palette.text.primary} />
            {itemCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{itemCount > 99 ? '99+' : itemCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <View style={styles.modeRow}>
        {(['sell', 'buy'] as MarketMode[]).map((key) => {
          const active = mode === key;
          return (
            <Pressable
              key={key}
              onPress={() => {
                setMode(key);
                setCategory(null);
              }}
              style={[styles.modeChip, active && styles.modeChipActive]}
            >
              <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
                {key === 'sell' ? 'Sell produce' : 'Buy inputs'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={20} color={palette.text.tertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder={mode === 'sell' ? 'Search produce…' : 'Search farm inputs…'}
          placeholderTextColor={palette.text.tertiary}
          value={query}
          onChangeText={setQuery}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={palette.text.tertiary} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChips}
      >
        <Pressable
          style={[styles.filterChip, inStockOnly && styles.filterChipActive]}
          onPress={() => setInStockOnly((v) => !v)}
        >
          <Text style={[styles.filterChipText, inStockOnly && styles.filterChipTextActive]}>
            In stock
          </Text>
        </Pressable>
        {(
          [
            { id: 'featured', label: 'Featured' },
            { id: 'price-asc', label: 'Price ↑' },
            { id: 'price-desc', label: 'Price ↓' },
          ] as const
        ).map((s) => (
          <Pressable
            key={s.id}
            style={[styles.filterChip, sort === s.id && styles.filterChipActive]}
            onPress={() => setSort(s.id)}
          >
            <Text style={[styles.filterChipText, sort === s.id && styles.filterChipTextActive]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
        {categories.map((c) => (
          <Pressable
            key={c}
            style={[styles.filterChip, category === c && styles.filterChipActive]}
            onPress={() => setCategory((prev) => (prev === c ? null : c))}
          >
            <Text style={[styles.filterChipText, category === c && styles.filterChipTextActive]}>
              {c}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {mode === 'sell' && (
        <Pressable style={styles.postBtn} onPress={() => setShowSellForm(true)}>
          <MaterialCommunityIcons name="plus-circle" size={20} color={palette.white} />
          <Text style={styles.postBtnText}>Post a listing</Text>
        </Pressable>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No items match your search.</Text>
        }
        renderItem={({ item }) => (
          <ProductCard item={item} onPress={() => openInquiry(item)} />
        )}
      />

      <ListingDetailSheet
        listing={selected}
        cartQty={cartQty}
        phoneHint={state.profile?.phoneNumber}
        inquirySent={inquirySent}
        onClose={() => setSelected(null)}
        onAddToCart={(qty) => {
          if (selected) addToCart(selected, qty);
        }}
        onViewCart={() => {
          setSelected(null);
          router.push('/cart');
        }}
        onInquiry={submitInquiry}
      />

      <Modal
        visible={showSellForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSellForm(false)}
      >
        <View style={styles.modalOverlay}>
          <PostListingForm
            initialPhone={state.profile?.phoneNumber ?? ''}
            initialLocation={state.profile?.area ?? ''}
            onCancel={() => setShowSellForm(false)}
            onSubmit={handleListingSubmit}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.surface.screen },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 12,
  },
  headerText: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: palette.text.primary,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: palette.text.muted,
  },
  cartBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#CC0C39',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: palette.white,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border.light,
  },
  modeChipActive: {
    backgroundColor: palette.brandGreen,
    borderColor: palette.brandGreen,
  },
  modeChipText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: palette.text.secondary,
  },
  modeChipTextActive: { color: palette.white },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border.card,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: palette.text.primary,
    padding: 0,
  },
  filterChips: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border.light,
    backgroundColor: palette.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: palette.brandGreen,
    borderColor: palette.brandGreen,
  },
  filterChipText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: palette.text.secondary,
  },
  filterChipTextActive: { color: palette.white },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: palette.brandGreen,
  },
  postBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: palette.white,
  },
  list: {
    paddingHorizontal: SCREEN_PAD,
    paddingBottom: TAB_BAR_HEIGHT + 32,
    paddingTop: 4,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    fontFamily: Fonts.medium,
    color: palette.text.tertiary,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: palette.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E3E6E6',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.92,
  },
  imageArea: {
    height: CARD_WIDTH * 0.85,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#CC0C39',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    zIndex: 1,
  },
  dealBadge: {
    backgroundColor: '#CC0C39',
  },
  badgeText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: palette.white,
  },
  cardBody: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 12,
  },
  cardTitle: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 17,
    color: palette.text.primary,
    minHeight: 34,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewsText: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: '#007185',
  },
  comparePrice: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: palette.text.tertiary,
  },
  strike: {
    textDecorationLine: 'line-through',
  },
  saveLine: {
    marginTop: 2,
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: '#CC0C39',
  },
  cardPrice: {
    marginTop: 4,
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: palette.text.primary,
  },
  cardPriceSale: {
    color: '#B12704',
  },
  cardUnit: {
    marginTop: 1,
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: palette.text.tertiary,
  },
  limitedDeal: {
    alignSelf: 'flex-start',
    backgroundColor: '#CC0C39',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    marginBottom: 2,
  },
  limitedDealText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: palette.white,
  },
  cardQuality: {
    marginTop: 4,
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: palette.brandGreen,
  },
  cardStock: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: '#007600',
  },
  deliveryMeta: {
    marginTop: 6,
    gap: 2,
  },
  deliveryPill: {
    alignSelf: 'flex-start',
    fontFamily: Fonts.bold,
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  deliveryPillFree: {
    backgroundColor: '#E7F6EC',
    color: '#067D3A',
  },
  deliveryPillPaid: {
    backgroundColor: '#FFF4E5',
    color: '#9A5B00',
  },
  deliveryPeriod: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: palette.text.tertiary,
  },
  cardSeller: {
    marginTop: 6,
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: '#007185',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  cardLocation: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: palette.text.tertiary,
  },
  modalOverlay: {
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
    gap: 10,
  },
  sheetImage: {
    height: 140,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  sheetImageFill: {
    width: '100%',
    height: '100%',
  },
  sheetTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: palette.text.primary,
  },
  sheetMeta: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: palette.text.tertiary,
  },
  sheetPrice: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: palette.text.primary,
  },
  sheetUnit: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: palette.text.muted,
  },
  sheetDesc: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: palette.text.secondary,
    marginBottom: 8,
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
  primaryBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: palette.text.primary,
  },
  viewCartBtn: {
    backgroundColor: '#FFA41C',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF8F00',
  },
  viewCartBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: palette.text.primary,
  },
  inquiryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border.card,
    backgroundColor: palette.white,
  },
  inquiryBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.text.secondary,
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.text.secondary,
  },
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
