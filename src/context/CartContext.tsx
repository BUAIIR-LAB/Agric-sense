import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  formatUgx,
  parseUgxPrice,
  type CartLine,
  type MarketListing,
} from '@/types/marketplace';

const STORAGE_KEY = 'agrisense-cart-v1';

type CartContextValue = {
  items: CartLine[];
  itemCount: number;
  subtotalUgx: number;
  subtotalLabel: string;
  ready: boolean;
  addToCart: (listing: MarketListing, qty?: number) => void;
  setQuantity: (listingId: string, quantity: number) => void;
  removeFromCart: (listingId: string) => void;
  clearCart: () => void;
  getQuantity: (listingId: string) => number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

type Props = { children: ReactNode };

export function CartProvider({ children }: Props) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && mounted) {
          const parsed = JSON.parse(raw) as CartLine[];
          if (Array.isArray(parsed)) {
            setItems(
              parsed.filter(
                (line) =>
                  line?.listing?.id &&
                  typeof line.quantity === 'number' &&
                  line.quantity > 0,
              ),
            );
          }
        }
      } catch (e) {
        console.warn('Failed to load cart', e);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch((e) =>
      console.warn('Failed to persist cart', e),
    );
  }, [items, ready]);

  const addToCart = useCallback((listing: MarketListing, qty = 1) => {
    const add = Math.max(1, Math.floor(qty));
    const stockCap = listing.stock != null && listing.stock > 0 ? listing.stock : 99;
    const minQty = listing.minOrderQty && listing.minOrderQty > 1 ? listing.minOrderQty : 1;
    setItems((prev) => {
      const idx = prev.findIndex((l) => l.listing.id === listing.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          listing,
          quantity: Math.min(stockCap, next[idx].quantity + add),
        };
        return next;
      }
      return [...prev, { listing, quantity: Math.min(stockCap, Math.max(minQty, add)) }];
    });
  }, []);

  const setQuantity = useCallback((listingId: string, quantity: number) => {
    const q = Math.floor(quantity);
    setItems((prev) => {
      if (q <= 0) return prev.filter((l) => l.listing.id !== listingId);
      return prev.map((l) => {
        if (l.listing.id !== listingId) return l;
        const stockCap =
          l.listing.stock != null && l.listing.stock > 0 ? l.listing.stock : 99;
        return { ...l, quantity: Math.min(stockCap, q), listing: l.listing };
      });
    });
  }, []);

  const removeFromCart = useCallback((listingId: string) => {
    setItems((prev) => prev.filter((l) => l.listing.id !== listingId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const getQuantity = useCallback(
    (listingId: string) => items.find((l) => l.listing.id === listingId)?.quantity ?? 0,
    [items],
  );

  const itemCount = useMemo(
    () => items.reduce((sum, l) => sum + l.quantity, 0),
    [items],
  );

  const subtotalUgx = useMemo(
    () =>
      items.reduce(
        (sum, l) => sum + parseUgxPrice(l.listing.price) * l.quantity,
        0,
      ),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount,
      subtotalUgx,
      subtotalLabel: formatUgx(subtotalUgx),
      ready,
      addToCart,
      setQuantity,
      removeFromCart,
      clearCart,
      getQuantity,
    }),
    [
      items,
      itemCount,
      subtotalUgx,
      ready,
      addToCart,
      setQuantity,
      removeFromCart,
      clearCart,
      getQuantity,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
