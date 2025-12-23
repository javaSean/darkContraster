import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const gelatoApiKey = process.env.GELATO_API_KEY;
const gelatoStoreId = process.env.GELATO_STORE_ID;

const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

export async function POST(request: Request) {
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const body = await request.text();
  const headerList = await headers();
  const sig = headerList.get('stripe-signature');

  let event: Stripe.Event;
  try {
    if (!sig) {
      throw new Error('Missing Stripe signature');
    }
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      // Avoid firing real Gelato orders for Stripe test mode sessions
      if (!session.livemode) {
        console.log('Skipping Gelato fulfillment for test mode session', session.id);
        return NextResponse.json({ received: true });
      }
      await handleCheckoutCompleted(session);
    } catch (err) {
      console.error('Failed to handle checkout.session.completed', err);
      // Return 200 so Stripe doesn't retry forever, but log the error
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (!gelatoApiKey || !gelatoStoreId) {
    throw new Error('Gelato env vars missing');
  }

  const shipping = (session as any).shipping_details as
    | { name?: string | null; phone?: string | null; address?: Stripe.Address | null }
    | null;
  const customer = session.customer_details as Stripe.Checkout.Session.CustomerDetails | null;
  if (!shipping?.address || !shipping.name) {
    throw new Error('Missing shipping details on session');
  }

  // Pull cart metadata (array of items) for multi-item checkouts
  const cartMeta = session.metadata?.cart;
  let cartItems: { productId: string; variantId?: string; quantity: number }[] = [];
  if (cartMeta) {
    try {
      const parsed = JSON.parse(cartMeta);
      if (Array.isArray(parsed)) {
        cartItems = parsed
          .map((item) => ({
            productId: String((item.productId ?? item.p) ?? ''),
            variantId: item.variantId ? String(item.variantId) : item.v ? String(item.v) : '',
            quantity: Number(item.quantity ?? item.q ?? 1) || 1,
          }))
          .filter((item) => item.productId);
      }
    } catch {
      cartItems = [];
    }
  }

  // Fallback for legacy single-item metadata
  if (!cartItems.length) {
    const productId = session.metadata?.productId;
    if (productId) {
      cartItems.push({
        productId,
        variantId: session.metadata?.variantId ?? '',
        quantity: 1,
      });
    }
  }

  if (!cartItems.length) {
    throw new Error('Missing product metadata on session');
  }

  const payload = {
    orderReferenceId: session.id,
    storeId: gelatoStoreId,
    customer: {
      email: customer?.email ?? '',
      phone: shipping.phone ?? customer?.phone ?? '',
      firstName: shipping.name,
    },
    shippingAddress: {
      firstName: shipping.name,
      addressLine1: shipping.address.line1 ?? '',
      addressLine2: shipping.address.line2 ?? '',
      city: shipping.address.city ?? '',
      state: shipping.address.state ?? '',
      postalCode: shipping.address.postal_code ?? '',
      country: shipping.address.country ?? '',
    },
    shippingMethod: 'standard',
    items: cartItems.map((item) => ({
      storeProductId: item.productId,
      storeProductVariantId: item.variantId ?? '',
      quantity: item.quantity ?? 1,
    })),
  };

  const gelatoRes = await fetch('https://order.gelatoapis.com/v4/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': gelatoApiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!gelatoRes.ok) {
    const text = await gelatoRes.text();
    throw new Error(`Gelato order error: ${gelatoRes.status} ${text}`);
  }

  const data = await gelatoRes.json();
  console.log('Gelato order created', data?.id ?? data);
}
