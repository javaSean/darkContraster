import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

const siteUrl = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
);

const successUrl = normalizeStripeUrl(
  process.env.STRIPE_SUCCESS_URL ?? `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
);
const cancelUrl = normalizeStripeUrl(
  process.env.STRIPE_CANCEL_URL ?? `${siteUrl}/#store`,
);

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe secret key missing' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const items: CheckoutItem[] = Array.isArray(body?.items) ? body.items : [body ?? {}];
    const shipping = body?.shipping as
      | { amount?: number; country?: string; label?: string }
      | undefined;

    const normalized = items
      .map((item) => normalizeItem(item))
      .filter((item): item is NormalizedItem => Boolean(item));

    if (!normalized.length) {
      return NextResponse.json({ error: 'Missing product details for checkout' }, { status: 400 });
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = normalized.map((item) => {
      return {
        price_data: {
          currency: item.currency.toLowerCase(),
          unit_amount: item.unitAmount,
          tax_behavior: 'exclusive',
          product_data: {
            name: item.variantTitle ? `${item.name} — ${item.variantTitle}` : item.name,
            metadata: {
              productId: item.productId ?? '',
              variantId: item.variantId ?? '',
            },
          },
        },
        quantity: item.quantity ?? 1,
      };
    });

    const cartSlim = normalized.map((item) => ({
      p: item.productId ?? '',
      v: item.variantId ?? '',
      q: item.quantity ?? 1,
    }));
    let cartMetadata = JSON.stringify(cartSlim);
    if (cartMetadata.length > 450) {
      cartMetadata = cartMetadata.slice(0, 450);
    }

    const first = normalized[0];

    // Require a shipping amount (computed via Gelato quote) and country
    if (!shipping?.amount || !shipping?.country) {
      return NextResponse.json({ error: 'Shipping quote required' }, { status: 400 });
    }

    const shippingAmount = Math.round(shipping.amount);
    const shippingCountry = String(shipping.country).toUpperCase() as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry;

    console.log('Creating Stripe session', {
      lineItems: lineItems.length,
      shippingAmount,
      shippingCountry,
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      automatic_tax: { enabled: true },
      shipping_address_collection: {
        allowed_countries: [shippingCountry],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            display_name: shipping?.label || 'Standard shipping',
            fixed_amount: { amount: shippingAmount, currency: first.currency.toLowerCase() },
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 5 },
              maximum: { unit: 'business_day', value: 12 },
            },
          },
        },
      ],
      line_items: lineItems,
      metadata: {
        cart: cartMetadata,
        productId: first.productId ?? '',
        variantId: first.variantId ?? '',
        shippingAmount: String(shippingAmount),
        shippingCountry,
        source: 'darkContraster',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to start checkout' },
      { status: 500 },
    );
  }
}

// Note: Stripe session images removed to eliminate URL validation errors during checkout.

function normalizeBaseUrl(value: string): string {
  if (!value) return value;
  if (value.startsWith('http://') && !value.includes('localhost')) {
    return value.replace('http://', 'https://');
  }
  return value.replace(/\/+$/, '');
}

function normalizeStripeUrl(value: string): string {
  if (!value) return value;
  if (value.startsWith('http://') && !value.includes('localhost')) {
    return value.replace('http://', 'https://');
  }
  return value;
}

type CheckoutItem = {
  productId?: string;
  variantId?: string | null;
  name?: string;
  variantTitle?: string;
  unitAmount?: number;
  currency?: string;
  image?: string;
  quantity?: number;
};

type NormalizedItem = {
  productId?: string;
  variantId?: string;
  name: string;
  variantTitle?: string;
  unitAmount: number;
  currency: string;
  image?: string;
  quantity?: number;
};

function normalizeItem(item: CheckoutItem): NormalizedItem | null {
  const name = item.name?.trim();
  const currency = item.currency?.trim();
  if (!name || typeof item.unitAmount !== 'number' || !currency) return null;

  const unitAmountInCents = Math.round(item.unitAmount * 100);
  if (unitAmountInCents <= 0) return null;

  return {
    productId: item.productId ?? '',
    variantId: item.variantId ?? '',
    name,
    variantTitle: item.variantTitle ?? '',
    unitAmount: unitAmountInCents,
    currency,
    image: item.image ?? '',
    quantity: item.quantity ?? 1,
  };
}
