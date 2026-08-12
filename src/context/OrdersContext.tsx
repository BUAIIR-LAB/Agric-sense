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

import apiService from '@/services/api';
import type { MarketListing, PesapalMethodLike } from '@/types/marketplace';
import { parseUgxPrice } from '@/types/marketplace';

const STORAGE_KEY = 'agrisense-orders-v1';

export type MobileOrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type MobileOrderItem = {
  listingId: string;
  title: string;
  unit: string;
  quantity: number;
  unitPriceUgx: number;
  kind?: 'produce' | 'input';
  imageUri?: string;
};

export type MobileOrder = {
  id: string;
  items: MobileOrderItem[];
  subtotalUgx: number;
  deliveryUgx: number;
  totalUgx: number;
  status: MobileOrderStatus;
  deliveryAddress: string;
  district: string;
  paymentRef: string;
  paymentMethod: PesapalMethodLike;
  paymentMethodLabel: string;
  customerPhone?: string;
  customerName?: string;
  createdAt: string;
  updatedAt: string;
};

type PlaceOrderInput = {
  items: Array<{ listing: MarketListing; quantity: number }>;
  subtotalUgx: number;
  deliveryUgx: number;
  deliveryAddress: string;
  district: string;
  paymentRef: string;
  paymentMethod: PesapalMethodLike;
  paymentMethodLabel: string;
  customerPhone?: string;
  customerName?: string;
  paymentTrackingId?: string;
  merchantReference?: string;
};

type OrdersContextValue = {
  orders: MobileOrder[];
  ready: boolean;
  placeOrder: (input: PlaceOrderInput) => Promise<MobileOrder>;
  getOrder: (id: string) => MobileOrder | undefined;
  refreshOrders: () => Promise<void>;
};

const OrdersContext = createContext<OrdersContextValue | undefined>(undefined);

function mapApiOrder(o: Record<string, unknown>): MobileOrder {
  const items = Array.isArray(o.items) ? o.items : [];
  return {
    id: String(o.id),
    items: items.map((raw) => {
      const i = raw as Record<string, unknown>;
      const kindRaw = String(i.kind ?? '').toLowerCase();
      return {
        listingId: String(i.product_id ?? ''),
        title: String(i.title ?? ''),
        unit: String(i.unit ?? ''),
        quantity: Number(i.quantity ?? 0),
        unitPriceUgx: Number(i.unit_price_ugx ?? 0),
        kind: kindRaw === 'input' || kindRaw === 'produce' ? kindRaw : undefined,
        imageUri: typeof i.image_base64 === 'string' ? i.image_base64 : undefined,
      };
    }),
    subtotalUgx: Number(o.subtotal_ugx ?? 0),
    deliveryUgx: Number(o.delivery_ugx ?? 0),
    totalUgx: Number(o.total_ugx ?? 0),
    status: (o.status as MobileOrderStatus) || 'pending',
    deliveryAddress: String(o.delivery_address ?? ''),
    district: String(o.district ?? ''),
    paymentRef: String(o.payment_ref ?? ''),
    paymentMethod: (o.payment_method as PesapalMethodLike) || 'cash',
    paymentMethodLabel: String(o.payment_method ?? 'cash').toUpperCase(),
    customerPhone: typeof o.customer_phone === 'string' ? o.customer_phone : undefined,
    customerName: typeof o.customer_name === 'string' ? o.customer_name : undefined,
    createdAt: String(o.created_at ?? new Date().toISOString()),
    updatedAt: String(o.updated_at ?? o.created_at ?? new Date().toISOString()),
  };
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<MobileOrder[]>([]);
  const [ready, setReady] = useState(false);

  const refreshOrders = useCallback(async () => {
    try {
      const res = await apiService.getMarketplaceOrders();
      const mapped = (res.items as Record<string, unknown>[]).map(mapApiOrder);
      if (mapped.length) {
        setOrders(mapped);
        return;
      }
    } catch {
      /* keep local cache */
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && mounted) {
          const parsed = JSON.parse(raw) as MobileOrder[];
          if (Array.isArray(parsed)) setOrders(parsed);
        }
        try {
          await refreshOrders();
        } catch {
          /* offline */
        }
      } catch (e) {
        console.warn('Failed to load orders', e);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshOrders]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(orders)).catch((e) =>
      console.warn('Failed to persist orders', e),
    );
  }, [orders, ready]);

  const placeOrder = useCallback(async (input: PlaceOrderInput) => {
    const lineItems = input.items.map(({ listing, quantity }) => ({
      product_id: listing.id,
      quantity,
    }));

    try {
      const quote = await apiService.createMarketplaceQuote(lineItems);
      const apiOrder = await apiService.createMarketplaceOrder({
        items: lineItems,
        delivery_address: input.deliveryAddress.trim(),
        district: input.district.trim(),
        payment_method: input.paymentMethod,
        payment_ref: input.paymentRef,
        quote_id: quote.quote_id,
        payment_tracking_id: input.paymentTrackingId,
        merchant_reference: input.merchantReference,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
      });
      const order = mapApiOrder(apiOrder as Record<string, unknown>);
      order.paymentMethodLabel = input.paymentMethodLabel;
      setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
      return order;
    } catch (e) {
      console.warn('API placeOrder failed, saving locally', e);
      const now = new Date().toISOString();
      const order: MobileOrder = {
        id: `ord_${Date.now()}`,
        items: input.items.map(({ listing, quantity }) => ({
          listingId: listing.id,
          title: listing.title,
          unit: listing.unit,
          quantity,
          unitPriceUgx: parseUgxPrice(listing.price),
          kind: listing.kind,
          imageUri: listing.imageUri ?? listing.images?.[0],
        })),
        subtotalUgx: input.subtotalUgx,
        deliveryUgx: input.deliveryUgx,
        totalUgx: input.subtotalUgx + input.deliveryUgx,
        status: input.paymentMethod === 'cash' ? 'pending' : 'paid',
        deliveryAddress: input.deliveryAddress.trim(),
        district: input.district.trim(),
        paymentRef: input.paymentRef,
        paymentMethod: input.paymentMethod,
        paymentMethodLabel: input.paymentMethodLabel,
        customerPhone: input.customerPhone,
        customerName: input.customerName,
        createdAt: now,
        updatedAt: now,
      };
      setOrders((prev) => [order, ...prev]);
      return order;
    }
  }, []);

  const getOrder = useCallback(
    (id: string) => orders.find((o) => o.id === id),
    [orders],
  );

  const value = useMemo(
    () => ({ orders, ready, placeOrder, getOrder, refreshOrders }),
    [orders, ready, placeOrder, getOrder, refreshOrders],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrders must be used within OrdersProvider');
  return ctx;
}
