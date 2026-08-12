import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAppContext } from '@/context/AppContext';
import { useCart } from '@/context/CartContext';
import { useOrders } from '@/context/OrdersContext';
import {
  chargeViaPesapal,
  PESAPAL_METHODS,
  type PesapalMethod,
} from '@/services/pesapal';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';
import { formatUgx } from '@/types/marketplace';

const FREE_DELIVERY_MIN = 200_000;
const DELIVERY_FEE = 15_000;

export default function CheckoutScreen() {
  const router = useRouter();
  const { state } = useAppContext();
  const { items, itemCount, subtotalUgx, clearCart } = useCart();
  const { placeOrder } = useOrders();

  const [address, setAddress] = useState(state.profile?.area ?? '');
  const [district, setDistrict] = useState('');
  const [method, setMethod] = useState<PesapalMethod>('mtn');
  const [momoPhone, setMomoPhone] = useState(state.profile?.phoneNumber ?? '');
  const [cardName, setCardName] = useState(state.profile?.name ?? '');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [successMethod, setSuccessMethod] = useState<string | null>(null);
  const [successTotal, setSuccessTotal] = useState<number | null>(null);
  const [successCash, setSuccessCash] = useState(false);

  useEffect(() => {
    if (state.profile?.phoneNumber && !momoPhone) {
      setMomoPhone(state.profile.phoneNumber);
    }
  }, [state.profile?.phoneNumber, momoPhone]);

  const delivery = useMemo(
    () => (itemCount === 0 ? 0 : subtotalUgx >= FREE_DELIVERY_MIN ? 0 : DELIVERY_FEE),
    [itemCount, subtotalUgx],
  );
  const total = subtotalUgx + delivery;

  const onPay = async () => {
    if (paying) return;
    setError(null);

    if (!state.isAuthenticated) {
      setError('Sign in to complete payment with Pesapal.');
      return;
    }
    if (!address.trim() || !district.trim()) {
      setError('Enter delivery address and district.');
      return;
    }
    if (!items.length) {
      setError('Your cart is empty.');
      return;
    }

    setPaying(true);
    try {
      const charged = await chargeViaPesapal({
        amountUgx: total,
        method,
        phone: momoPhone,
        cardName,
        cardNumber,
        cardExpiry,
        cardCvv,
        description: `AgriSense mobile order (${itemCount} items)`,
      });

      if (charged.ok === false) {
        setError(charged.error);
        return;
      }

      const order = await placeOrder({
        items,
        subtotalUgx,
        deliveryUgx: delivery,
        deliveryAddress: address,
        district,
        paymentRef: charged.paymentRef,
        paymentMethod: charged.method,
        paymentMethodLabel: charged.methodLabel,
        customerPhone: state.profile?.phoneNumber,
        customerName: state.profile?.name,
        paymentTrackingId: charged.trackingId,
        merchantReference: charged.merchantReference,
      });

      clearCart();
      setSuccessOrderId(order.id);
      setSuccessRef(charged.paymentRef);
      setSuccessMethod(charged.methodLabel);
      setSuccessTotal(order.totalUgx);
      setSuccessCash(charged.payOnDelivery);
    } finally {
      setPaying(false);
    }
  };

  if (successOrderId && successRef) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <View style={{ width: 24 }} />
          <Text style={styles.topTitle}>Payment successful</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.successWrap}>
          <MaterialCommunityIcons
            name={successCash ? 'cash' : 'check-circle'}
            size={64}
            color={palette.brandGreen}
          />
          <Text style={styles.successTitle}>
            {successCash ? 'Order placed — pay cash on delivery' : 'Pesapal payment completed'}
          </Text>
          <Text style={styles.successBody}>
            {successCash ? (
              <>
                Have {successTotal != null ? formatUgx(successTotal) : 'the total'} ready in cash
                when delivery arrives.{'\n'}
              </>
            ) : (
              <>
                Paid with {successMethod}
                {successTotal != null ? ` · ${formatUgx(successTotal)}` : ''}.{'\n'}
              </>
            )}
            Reference: <Text style={styles.successRef}>{successRef}</Text>
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.replace(`/orders/${successOrderId}`)}
          >
            <Text style={styles.primaryBtnText}>Track this order</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/orders')}>
            <Text style={styles.secondaryText}>All orders</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.replace('/(tabs)/marketplace')}
          >
            <Text style={styles.secondaryText}>Back to Marketplace</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!items.length) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={palette.text.primary} />
          </Pressable>
          <Text style={styles.topTitle}>Checkout</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.successWrap}>
          <Text style={styles.successTitle}>Nothing to checkout</Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.replace('/(tabs)/marketplace')}
          >
            <Text style={styles.primaryBtnText}>Continue shopping</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back">
          <MaterialCommunityIcons name="arrow-left" size={24} color={palette.text.primary} />
        </Pressable>
        <Text style={styles.topTitle}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!state.isAuthenticated ? (
          <View style={styles.authBox}>
            <Text style={styles.authTitle}>Sign in to pay</Text>
            <Text style={styles.authBody}>
              Browse and cart as a guest — account is only required at Pesapal checkout.
            </Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.push('/login')}>
              <Text style={styles.primaryBtnText}>Sign in</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Order summary</Text>
        {items.map(({ listing, quantity }) => (
          <View key={listing.id} style={styles.summaryLine}>
            <Text style={styles.summaryTitle} numberOfLines={1}>
              {listing.title} × {quantity}
            </Text>
            <Text style={styles.summaryPrice}>
              {formatUgx(
                (Number.parseFloat(listing.price.replace(/,/g, '')) || 0) * quantity,
              )}
            </Text>
          </View>
        ))}

        <Text style={styles.sectionLabel}>Delivery</Text>
        <TextInput
          style={styles.input}
          placeholder="Trading centre / village"
          placeholderTextColor={palette.text.tertiary}
          value={address}
          onChangeText={setAddress}
          editable={!paying}
        />
        <TextInput
          style={styles.input}
          placeholder="District (e.g. Tororo)"
          placeholderTextColor={palette.text.tertiary}
          value={district}
          onChangeText={setDistrict}
          editable={!paying}
        />

        <View style={styles.pesaBrand}>
          <Text style={styles.pesaMark}>Payment</Text>
          <Text style={styles.pesaSecure}>Pesapal · Cash on delivery</Text>
        </View>

        <Text style={styles.sectionLabel}>Payment method</Text>
        {PESAPAL_METHODS.map((m) => {
          const active = method === m.id;
          return (
            <Pressable
              key={m.id}
              style={[
                styles.methodCard,
                active && styles.methodCardActive,
                active && methodTint(m.id),
              ]}
              onPress={() => !paying && setMethod(m.id)}
              disabled={paying}
            >
              <View style={[styles.radio, active && styles.radioActive]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.methodLabel}>{m.label}</Text>
                <Text style={styles.methodHint}>{m.hint}</Text>
              </View>
            </Pressable>
          );
        })}

        {method === 'card' ? (
          <View style={styles.fields}>
            <TextInput
              style={styles.input}
              placeholder="Name on card"
              placeholderTextColor={palette.text.tertiary}
              value={cardName}
              onChangeText={setCardName}
              editable={!paying}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Card number"
              placeholderTextColor={palette.text.tertiary}
              value={cardNumber}
              onChangeText={setCardNumber}
              editable={!paying}
              keyboardType="number-pad"
            />
            <View style={styles.row2}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="MM/YY"
                placeholderTextColor={palette.text.tertiary}
                value={cardExpiry}
                onChangeText={setCardExpiry}
                editable={!paying}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="CVV"
                placeholderTextColor={palette.text.tertiary}
                value={cardCvv}
                onChangeText={setCardCvv}
                editable={!paying}
                keyboardType="number-pad"
                secureTextEntry
              />
            </View>
            <Text style={styles.hint}>Demo: 4111 1111 1111 1111 · future MM/YY · any CVV</Text>
          </View>
        ) : method === 'cash' ? (
          <View style={styles.cashBox}>
            <Text style={styles.cashTitle}>Cash on delivery</Text>
            <Text style={styles.cashBody}>
              Have exact cash ready for the delivery agent. Your order is confirmed now; payment is
              collected on arrival.
            </Text>
          </View>
        ) : (
          <View style={styles.fields}>
            <TextInput
              style={styles.input}
              placeholder={method === 'mtn' ? 'MTN MoMo number' : 'Airtel Money number'}
              placeholderTextColor={palette.text.tertiary}
              value={momoPhone}
              onChangeText={setMomoPhone}
              editable={!paying}
              keyboardType="phone-pad"
            />
            <Text style={styles.hint}>Pesapal will send a payment prompt to this phone.</Text>
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.summary}>
          <Row label="Subtotal" value={formatUgx(subtotalUgx)} />
          <Row label="Delivery" value={delivery === 0 ? 'FREE' : formatUgx(delivery)} />
          <Row label="Total" value={formatUgx(total)} strong />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.primaryBtn,
            (paying || !state.isAuthenticated) && styles.primaryBtnDisabled,
          ]}
          onPress={onPay}
          disabled={paying || !state.isAuthenticated}
        >
          {paying ? (
            <View style={styles.payingRow}>
              <ActivityIndicator color={palette.text.primary} />
              <Text style={styles.primaryBtnText}>
                {method === 'cash'
                  ? 'Confirming cash order…'
                  : method === 'card'
                    ? 'Processing with Pesapal…'
                    : 'Waiting for MoMo approval…'}
              </Text>
            </View>
          ) : (
            <Text style={styles.primaryBtnText}>
              {method === 'cash'
                ? `Place order · Pay ${formatUgx(total)} cash on delivery`
                : `Pay ${formatUgx(total)} with Pesapal`}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, strong && styles.summaryStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryStrong]}>{value}</Text>
    </View>
  );
}

function methodTint(id: PesapalMethod) {
  if (id === 'mtn') return { backgroundColor: '#FFF9E6' };
  if (id === 'airtel') return { backgroundColor: '#FFF0F0' };
  if (id === 'cash') return { backgroundColor: '#F3FAF3' };
  return { backgroundColor: '#EEF5FF' };
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
  content: {
    padding: spacing.lg,
    paddingBottom: 32,
    gap: 10,
  },
  authBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: radius.md,
    padding: 14,
    gap: 8,
    marginBottom: 4,
  },
  authTitle: { fontFamily: Fonts.bold, fontSize: 15, color: palette.text.primary },
  authBody: { fontFamily: Fonts.regular, fontSize: 13, color: palette.text.secondary },
  sectionLabel: {
    marginTop: 8,
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: palette.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
  },
  summaryTitle: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: palette.text.primary },
  summaryPrice: { fontFamily: Fonts.semiBold, fontSize: 13, color: palette.text.primary },
  input: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border.card,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: palette.text.primary,
  },
  pesaBrand: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  pesaMark: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: '#0B4F8A',
  },
  pesaSecure: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: palette.text.tertiary,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D5D9D9',
    backgroundColor: palette.white,
  },
  methodCardActive: {
    borderColor: palette.brandGreen,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#879596',
    marginTop: 2,
  },
  radioActive: {
    borderColor: palette.brandGreen,
    backgroundColor: palette.brandGreen,
  },
  methodLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: palette.text.primary,
  },
  methodHint: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: palette.text.muted,
    lineHeight: 16,
  },
  fields: { gap: 10, marginTop: 4 },
  cashBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: radius.md,
    padding: 14,
    gap: 6,
  },
  cashTitle: { fontFamily: Fonts.bold, fontSize: 14, color: palette.brandGreenDark },
  cashBody: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: palette.text.secondary,
    lineHeight: 18,
  },
  row2: { flexDirection: 'row', gap: 10 },
  hint: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: palette.text.tertiary,
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    borderRadius: radius.md,
    padding: 12,
  },
  errorText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: '#C62828',
  },
  summary: {
    marginTop: 8,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E3E6E6',
    padding: 14,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: palette.text.secondary,
  },
  summaryValue: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.text.primary,
  },
  summaryStrong: {
    fontFamily: Fonts.bold,
    fontSize: 16,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: palette.border.light,
    backgroundColor: palette.white,
  },
  primaryBtn: {
    backgroundColor: '#FFD814',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCD200',
  },
  primaryBtnDisabled: { opacity: 0.75 },
  primaryBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: palette.text.primary,
  },
  secondaryBtn: { paddingVertical: 10, alignItems: 'center' },
  secondaryText: { fontFamily: Fonts.semiBold, fontSize: 14, color: '#007185' },
  payingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: 12,
  },
  successTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: palette.text.primary,
    textAlign: 'center',
  },
  successBody: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: palette.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  successRef: {
    fontFamily: Fonts.bold,
    color: palette.text.primary,
  },
});
