export type MarketListing = {
  id: string;
  title: string;
  category: string;
  price: string;
  unit: string;
  location: string;
  seller: string;
  kind: 'produce' | 'input';
  description: string;
  rating: number;
  reviews: number;
  badge?: string;
  /** Primary image (back-compat) */
  imageUri?: string;
  /** Gallery images for detail carousel */
  images?: string[];
  /** Available stock units; caps cart qty */
  stock?: number;
  minOrderQty?: number;
  /** List / reference price string (e.g. "95,000") for Amazon-style strikethrough */
  compareAtPrice?: string;
  discountPercent?: number;
  deliveryMode?: DeliveryMode;
  deliveryPeriod?: DeliveryPeriod;
  quality?: string;
  saleChannel?: string;
};

export type DeliveryMode = 'free' | 'paid';
export type DeliveryPeriod = '24_hours' | '3_days' | '1_week';

export const DELIVERY_PERIOD_LABELS: Record<DeliveryPeriod, string> = {
  '24_hours': '24 hours',
  '3_days': '3 days',
  '1_week': '1 week',
};

/** Selling price + discount % → list (compare-at) price — same as web market. */
export function listPriceFromDiscount(priceUgx: number, discountPercent: number): number {
  const pct = Math.min(99, Math.max(0, Math.round(discountPercent)));
  if (pct <= 0) return Math.round(priceUgx);
  const list = Math.round(priceUgx / (1 - pct / 100));
  return list > priceUgx ? list : Math.round(priceUgx) + 1;
}

export type PesapalMethodLike = 'mtn' | 'airtel' | 'card' | 'cash';

export type CartLine = {
  listing: MarketListing;
  quantity: number;
};

/** Parse display prices like "95,000" → 95000 */
export function parseUgxPrice(price: string): number {
  const n = Number.parseFloat(String(price).replace(/,/g, '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function formatUgx(amount: number): string {
  return `UGX ${Math.round(amount).toLocaleString('en-UG')}`;
}

export function getListingImages(listing: Pick<MarketListing, 'images' | 'imageUri'>): string[] {
  if (listing.images?.length) return listing.images.filter(Boolean);
  if (listing.imageUri) return [listing.imageUri];
  return [];
}

export type ListingPriceDisplay = {
  hasDiscount: boolean;
  priceUgx: number;
  listPriceUgx: number | null;
  saveUgx: number;
  percentOff: number;
};

/** Amazon-style sale vs list price for marketplace cards */
export function getListingPriceDisplay(listing: {
  price: string;
  compareAtPrice?: string;
}): ListingPriceDisplay {
  const priceUgx = parseUgxPrice(listing.price);
  const listRaw = listing.compareAtPrice ? parseUgxPrice(listing.compareAtPrice) : 0;
  const listPriceUgx = listRaw > priceUgx ? listRaw : null;
  const saveUgx = listPriceUgx != null ? listPriceUgx - priceUgx : 0;
  const percentOff =
    listPriceUgx != null && listPriceUgx > 0
      ? Math.round((saveUgx / listPriceUgx) * 100)
      : 0;
  return {
    hasDiscount: listPriceUgx != null && saveUgx > 0 && percentOff > 0,
    priceUgx,
    listPriceUgx,
    saveUgx,
    percentOff,
  };
}
