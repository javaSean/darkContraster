"use client";

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type CartItem = {
  productId: string;
  variantId?: string;
  name: string;
  variantTitle?: string;
  unitAmount: number;
  currency: string;
  image?: string;
  quantity: number;
  kind?: ProductKind;
};

type CartContextValue = {
  items: CartItem[];
  cartCount: number;
  cartTotalLabel: string;
  addItem: (item: CartItem) => void;
  replaceItems: (items: CartItem[]) => void;
  updateQuantity: (productId: string, variantId: string | undefined, delta: number) => void;
  removeItem: (productId: string, variantId?: string) => void;
  toggleCart: () => void;
  closeCart: () => void;
  cartOpen: boolean;
  cartError: string;
  shippingCountry: string;
  postalCode: string;
  shippingAmount: number | null;
  shippingLabel: string;
  couponCode: string;
  setShippingCountry: (next: string) => void;
  setPostalCode: (next: string) => void;
  setCouponCode: (next: string) => void;
  checkoutCart: () => Promise<void>;
  purchasingId: string | null;
  computeShippingPreview: () => { amountCents: number | null; label: string };
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartError, setCartError] = useState('');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [shippingCountry, setShippingCountry] = useState('US');
  const [postalCode, setPostalCode] = useState('');
  const [shippingAmount, setShippingAmount] = useState<number | null>(null);
  const [shippingLabel, setShippingLabel] = useState('Standard shipping');
  const [couponCode, setCouponCode] = useState('');

  const cartCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  const cartTotalLabel = useMemo(() => {
    if (!items.length) return '';
    const amount = items.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
    const currency = items[0]?.currency ?? 'USD';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  }, [items]);

  // Auto-recalculate shipping whenever items or country change
  useEffect(() => {
    if (!items.length || !shippingCountry) {
      setShippingAmount(null);
      return;
    }
    try {
      const { amountCents, label } = computeFlatRateShipping(items, shippingCountry);
      setShippingAmount(amountCents);
      setShippingLabel(label);
      setCartError('');
    } catch (error) {
      console.error(error);
      setCartError(error instanceof Error ? error.message : 'Unable to get quote');
      setShippingAmount(null);
    }
  }, [items, shippingCountry]);

  function addItem(item: CartItem) {
    setItems((prev) => {
      const existing = prev.find(
        (entry) => entry.productId === item.productId && entry.variantId === item.variantId,
      );
      if (existing) {
        return prev.map((entry) =>
          entry.productId === item.productId && entry.variantId === item.variantId
            ? { ...entry, quantity: entry.quantity + item.quantity }
            : entry,
        );
      }
      return [...prev, item];
    });
  }

  function replaceItems(nextItems: CartItem[]) {
    setItems(nextItems);
  }

  function updateQuantity(productId: string, variantId: string | undefined, delta: number) {
    setItems((prev) =>
      prev
        .map((entry) => {
          if (entry.productId === productId && entry.variantId === variantId) {
            return { ...entry, quantity: Math.max(1, entry.quantity + delta) };
          }
          return entry;
        })
        .filter((entry) => entry.quantity > 0),
    );
  }

  function removeItem(productId: string, variantId?: string) {
    setItems((prev) =>
      prev.filter((entry) => !(entry.productId === productId && entry.variantId === variantId)),
    );
  }

  async function checkoutCart() {
    if (!items.length) {
      setCartError('Add at least one item to checkout.');
      return;
    }
    if (!shippingAmount || !shippingCountry) {
      setCartError('Get a shipping quote before checkout.');
      return;
    }
    setCartError('');
    setPurchasingId('cart');
    try {
      await handleCheckoutRequest(
        items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.name,
          variantTitle: item.variantTitle,
          unitAmount: item.unitAmount,
          currency: item.currency,
          image: item.image,
          quantity: item.quantity,
        })),
        {
          amount: shippingAmount,
          country: shippingCountry,
          label: shippingLabel,
        },
        couponCode || undefined,
      );
    } catch (error) {
      console.error(error);
      setCartError(error instanceof Error ? error.message : 'Unable to start checkout');
    } finally {
      setPurchasingId(null);
    }
  }

  const value: CartContextValue = {
    items,
    cartCount,
    cartTotalLabel,
    addItem,
    replaceItems,
    updateQuantity,
    removeItem,
    toggleCart: () => setCartOpen((prev) => !prev),
    closeCart: () => setCartOpen(false),
    cartOpen,
    cartError,
    shippingCountry,
    postalCode,
    shippingAmount,
    shippingLabel,
    couponCode,
    setShippingCountry,
    setPostalCode,
    setCouponCode,
    checkoutCart,
    purchasingId,
    computeShippingPreview: () => {
      try {
        const { amountCents, label } = computeFlatRateShipping(items, shippingCountry);
        return { amountCents, label };
      } catch {
        return { amountCents: null, label: 'Standard shipping' };
      }
    },
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}

type CheckoutPayload = {
  productId: string;
  variantId?: string;
  productName: string;
  variantTitle?: string;
  unitAmount: number;
  currency: string;
  image?: string;
  quantity?: number;
};

type ShippingPayload = {
  amount: number;
  country: string;
  label?: string;
};

async function handleCheckoutRequest(payload: CheckoutPayload[], shipping: ShippingPayload, coupon?: string) {
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: payload.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.productName,
        variantTitle: item.variantTitle,
        unitAmount: item.unitAmount,
        currency: item.currency,
        image: item.image,
        quantity: item.quantity ?? 1,
      })),
      shipping,
      coupon,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error ?? 'Unable to start checkout');
  }

  const data = await response.json();
  if (!data?.url) {
    throw new Error('Checkout session missing URL');
  }

  window.location.href = data.url as string;
}

function computeFlatRateShipping(items: CartItem[], country: string): { amountCents: number; label: string } {
  if (!items.length) throw new Error('No items in cart');
  const flattened = items.flatMap((item) => Array.from({ length: item.quantity }, () => item));
  if (!flattened.length) throw new Error('No items in cart');

  const perItemRates = flattened.map((item) => getRatesForItem(item, country));

  const highestFirst = Math.max(...perItemRates.map((r) => r.firstCents));
  const maxAdditionalRaw = Math.max(...perItemRates.map((r) => r.additionalCents));
  const maxAdditional = Math.ceil(maxAdditionalRaw / 100) * 100; // round additional to nearest dollar

  const rawTotal = highestFirst + maxAdditional * Math.max(0, flattened.length - 1);
  const total = Math.ceil(rawTotal / 100) * 100; // round up to nearest dollar

  const label = perItemRates.find((r) => r.label)?.label ?? 'Standard shipping';
  return { amountCents: total, label };
}

type RegionKey = 'us' | 'eu' | 'uk' | 'ca' | 'au' | 'nz' | 'sg' | 'jp' | 'br' | 'world';
type ProductKind = 'tee' | 'hoodie' | 'print' | 'book' | 'tote' | 'default';

type RateEntry = { firstCents: number; additionalCents: number };

const RATE_TABLE: Record<ProductKind, Record<RegionKey, RateEntry>> = {
  tee: {
    us: { firstCents: 399, additionalCents: 158 },
    eu: { firstCents: 469, additionalCents: 149 },
    uk: { firstCents: 410, additionalCents: 122 },
    ca: { firstCents: 930, additionalCents: 281 },
    au: { firstCents: 848, additionalCents: 256 },
    nz: { firstCents: 1022, additionalCents: 281 },
    sg: { firstCents: 650, additionalCents: 200 },
    jp: { firstCents: 700, additionalCents: 250 },
    br: { firstCents: 1200, additionalCents: 400 },
    world: { firstCents: 1500, additionalCents: 500 },
  },
  hoodie: {
    us: { firstCents: 739, additionalCents: 229 },
    eu: { firstCents: 752, additionalCents: 251 },
    uk: { firstCents: 565, additionalCents: 153 },
    ca: { firstCents: 901, additionalCents: 259 },
    au: { firstCents: 806, additionalCents: 241 },
    nz: { firstCents: 1023, additionalCents: 205 },
    sg: { firstCents: 1473, additionalCents: 525 },
    jp: { firstCents: 1505, additionalCents: 536 },
    br: { firstCents: 567, additionalCents: 284 },
    world: { firstCents: 1800, additionalCents: 700 },
  },
  print: {
    us: { firstCents: 569, additionalCents: 40 },
    eu: { firstCents: 545, additionalCents: 21 },
    uk: { firstCents: 590, additionalCents: 50 },
    ca: { firstCents: 634, additionalCents: 57 },
    au: { firstCents: 723, additionalCents: 65 },
    nz: { firstCents: 508, additionalCents: 20 },
    sg: { firstCents: 606, additionalCents: 21 },
    jp: { firstCents: 1032, additionalCents: 27 },
    br: { firstCents: 469, additionalCents: 18 },
    world: { firstCents: 1000, additionalCents: 200 },
  },
  book: {
    us: { firstCents: 391, additionalCents: 154 },
    eu: { firstCents: 590, additionalCents: 237 },
    uk: { firstCents: 489, additionalCents: 197 },
    ca: { firstCents: 666, additionalCents: 265 },
    au: { firstCents: 802, additionalCents: 319 },
    nz: { firstCents: 927, additionalCents: 369 },
    sg: { firstCents: 770, additionalCents: 354 },
    jp: { firstCents: 2731, additionalCents: 1089 },
    br: { firstCents: 1609, additionalCents: 646 },
    world: { firstCents: 2000, additionalCents: 800 },
  },
  tote: {
    us: { firstCents: 366, additionalCents: 184 },
    eu: { firstCents: 501, additionalCents: 157 },
    uk: { firstCents: 431, additionalCents: 135 },
    ca: { firstCents: 575, additionalCents: 160 },
    au: { firstCents: 596, additionalCents: 110 },
    nz: { firstCents: 689, additionalCents: 128 },
    sg: { firstCents: 1302, additionalCents: 312 },
    jp: { firstCents: 1124, additionalCents: 269 },
    br: { firstCents: 416, additionalCents: 231 },
    world: { firstCents: 1500, additionalCents: 500 },
  },
  default: {
    us: { firstCents: 399, additionalCents: 158 },
    eu: { firstCents: 469, additionalCents: 149 },
    uk: { firstCents: 410, additionalCents: 122 },
    ca: { firstCents: 930, additionalCents: 281 },
    au: { firstCents: 848, additionalCents: 256 },
    nz: { firstCents: 1022, additionalCents: 281 },
    sg: { firstCents: 650, additionalCents: 200 },
    jp: { firstCents: 700, additionalCents: 250 },
    br: { firstCents: 1200, additionalCents: 400 },
    world: { firstCents: 1500, additionalCents: 500 },
  },
};

function getRatesForItem(item: CartItem, country: string): RateEntry & { label: string } {
  const region = getRegion(country);
  const kind = getProductKind(item.kind, item.name);
  const table = RATE_TABLE[kind] ?? RATE_TABLE.default;
  const rates = table[region] ?? RATE_TABLE.default[region] ?? RATE_TABLE.default.world;
  const label = 'Standard shipping';
  return { ...rates, label };
}

function getProductKind(kindHint: ProductKind | undefined, name: string): ProductKind {
  if (kindHint) return kindHint;
  const lower = name.toLowerCase();
  if (lower.includes('tee') || lower.includes('t-shirt') || lower.includes('shirt')) return 'tee';
  if (lower.includes('hoodie') || lower.includes('pullover') || lower.includes('sweatshirt')) return 'hoodie';
  if (lower.includes('print') || lower.includes('poster')) return 'print';
  if (lower.includes('book')) return 'book';
  if (lower.includes('tote') || lower.includes('bag')) return 'tote';
  return 'default';
}

function getRegion(countryCode: string): RegionKey {
  const code = countryCode.toUpperCase();
  if (code === 'US' || code === 'USA') return 'us';
  if (code === 'CA') return 'ca';
  if (code === 'GB' || code === 'UK' || code === 'IE') return 'uk';
  if (code === 'AU') return 'au';
  if (code === 'NZ') return 'nz';
  if (code === 'SG') return 'sg';
  if (code === 'JP') return 'jp';
  if (code === 'BR') return 'br';

  const euSet = new Set([
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT',
    'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'NO', 'CH', 'IS', 'LI',
  ]);
  if (euSet.has(code)) return 'eu';

  if (code === 'BR') return 'br';

  return 'world';
}
