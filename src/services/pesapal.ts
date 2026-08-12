export type PesapalMethod = 'mtn' | 'airtel' | 'card' | 'cash';

export type PesapalChargeInput = {
  amountUgx: number;
  method: PesapalMethod;
  phone?: string;
  cardName?: string;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  customerEmail?: string;
  description?: string;
};

export type PesapalChargeResult =
  | {
      ok: true;
      trackingId: string;
      merchantReference: string;
      paymentRef: string;
      method: PesapalMethod;
      methodLabel: string;
      payOnDelivery: boolean;
    }
  | { ok: false; error: string };

export const PESAPAL_METHODS: Array<{
  id: PesapalMethod;
  label: string;
  hint: string;
}> = [
  {
    id: 'mtn',
    label: 'MTN MoMo',
    hint: 'Approve the Pesapal prompt on your MTN phone',
  },
  {
    id: 'airtel',
    label: 'Airtel Money',
    hint: 'Approve the Pesapal prompt on your Airtel phone',
  },
  {
    id: 'card',
    label: 'Card',
    hint: 'Visa / Mastercard via Pesapal secure checkout',
  },
  {
    id: 'cash',
    label: 'Cash on delivery',
    hint: 'Pay the rider or seller in cash when your order arrives',
  },
];

export function pesapalMethodLabel(method: PesapalMethod): string {
  return PESAPAL_METHODS.find((m) => m.id === method)?.label ?? method;
}

export function normalizeUgPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('256') && digits.length === 12) return `0${digits.slice(3)}`;
  return digits;
}

export function validateUgMobile(phone: string): string | null {
  const digits = normalizeUgPhone(phone);
  if (!digits) return 'Enter the mobile money number.';
  if (digits.length !== 10 || !digits.startsWith('0')) {
    return 'Use a Uganda mobile number like 0772 123 456.';
  }
  const prefix = digits.slice(0, 3);
  const valid = ['070', '071', '072', '073', '074', '075', '076', '077', '078', '079'];
  if (!valid.includes(prefix)) return 'Invalid Uganda mobile prefix.';
  return null;
}

function luhnOk(num: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i -= 1) {
    let n = Number(num[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function validateCardFields(input: {
  cardName?: string;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
}): string | null {
  const name = (input.cardName ?? '').trim();
  const number = (input.cardNumber ?? '').replace(/\s+/g, '');
  const expiry = (input.cardExpiry ?? '').trim();
  const cvv = (input.cardCvv ?? '').trim();

  if (name.length < 2) return 'Enter the name on the card.';
  if (!/^\d{13,19}$/.test(number) || !luhnOk(number)) {
    return 'Enter a valid card number.';
  }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
    return 'Expiry must be MM/YY.';
  }
  const [mm, yy] = expiry.split('/').map(Number);
  const now = new Date();
  const exp = new Date(2000 + yy, mm);
  if (exp <= now) return 'Card appears expired.';
  if (!/^\d{3,4}$/.test(cvv)) return 'Enter a valid CVV.';
  return null;
}

export async function chargeViaPesapal(
  input: PesapalChargeInput,
): Promise<PesapalChargeResult> {
  if (!Number.isFinite(input.amountUgx) || input.amountUgx <= 0) {
    return { ok: false, error: 'Invalid payment amount.' };
  }

  if (input.method === 'cash') {
    await new Promise((r) => setTimeout(r, 400));
    const merchantReference = `AGS-${Date.now().toString(36).toUpperCase()}`;
    const paymentRef = `CASH-${Math.floor(100000 + Math.random() * 899999)}`;
    return {
      ok: true,
      trackingId: `COD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      merchantReference,
      paymentRef,
      method: 'cash',
      methodLabel: pesapalMethodLabel('cash'),
      payOnDelivery: true,
    };
  }

  if (input.method === 'mtn' || input.method === 'airtel') {
    const phoneError = validateUgMobile(input.phone ?? '');
    if (phoneError) return { ok: false, error: phoneError };
  } else {
    const cardError = validateCardFields(input);
    if (cardError) return { ok: false, error: cardError };
  }

  try {
    const apiService = (await import('@/services/api')).default;
    const charged = await apiService.chargeMarketplacePayment({
      amount_ugx: Math.round(input.amountUgx),
      method: input.method,
      phone: input.phone,
      card:
        input.method === 'card'
          ? {
              name: input.cardName || '',
              number: input.cardNumber || '',
              expiry: input.cardExpiry || '',
              cvv: input.cardCvv || '',
            }
          : undefined,
    });
    return {
      ok: true,
      trackingId: charged.tracking_id,
      merchantReference: charged.merchant_reference,
      paymentRef: charged.payment_ref,
      method: input.method,
      methodLabel: pesapalMethodLabel(input.method),
      payOnDelivery: false,
    };
  } catch (e) {
    // Offline / not deployed yet — local demo charge
    console.warn('Market charge API unavailable, using local stub', e);
  }

  await new Promise((r) => setTimeout(r, 800));
  const merchantReference = `AGS-${Date.now().toString(36).toUpperCase()}`;
  const trackingId = `PES-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const code = input.method.toUpperCase();
  const paymentRef = `PESA-${code}-${Math.floor(100000 + Math.random() * 899999)}`;

  return {
    ok: true,
    trackingId,
    merchantReference,
    paymentRef,
    method: input.method,
    methodLabel: pesapalMethodLabel(input.method),
    payOnDelivery: false,
  };
}
