import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
const gelatoApiKey = process.env.GELATO_API_KEY?.trim();
const gelatoStoreId = process.env.GELATO_STORE_ID?.trim();

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
      console.error('Failed to handle checkout.session.completed', {
        sessionId: session.id,
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined,
      });
      // Signal failure so Stripe will retry delivery; better to risk duplicate than drop fulfillment
      const message = err instanceof Error ? err.message : 'Fulfillment failed';
      return NextResponse.json({ error: `Fulfillment failed: ${message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (!gelatoApiKey || !gelatoStoreId) {
    throw new Error('Gelato env vars missing');
  }
  if (!isUuid(gelatoStoreId)) {
    throw new Error(`Gelato store ID is not a valid UUID: "${gelatoStoreId}"`);
  }

  const customer = session.customer_details as Stripe.Checkout.Session.CustomerDetails | null;
  // Prefer shipping_details; fall back to customer_details.address if shipping missing
  const shippingRaw = (session as any).shipping_details as
    | { name?: string | null; phone?: string | null; address?: Stripe.Address | null }
    | null;
  const shippingAddress =
    shippingRaw?.address || customer?.address
      ? {
          address: (shippingRaw?.address || customer?.address) as Stripe.Address,
          name: shippingRaw?.name || customer?.name || '',
          phone: shippingRaw?.phone || customer?.phone || '',
        }
      : null;

  if (!shippingAddress?.address || !shippingAddress.name) {
    throw new Error('Missing shipping details on session (shipping_details and customer.address empty)');
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

  const currency = (session.currency || session.metadata?.currency || 'USD').toUpperCase();

  // Attempt to enrich variants with productUid to help Gelato UI connection status
  const variantUidCache = new Map<string, string>();
  async function getProductUid(productId: string, variantId?: string) {
    const key = `${productId}:${variantId ?? ''}`;
    if (variantUidCache.has(key)) return variantUidCache.get(key);
    try {
      const res = await fetch(
        `https://ecommerce.gelatoapis.com/v1/stores/${gelatoStoreId}/products/${productId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': gelatoApiKey!,
          } as HeadersInit,
        },
      );
      if (!res.ok) {
        return null;
      }
      const data = await res.json();
      const variants =
        Array.isArray(data?.variantDetails) && data.variantDetails.length
          ? data.variantDetails
          : Array.isArray(data?.productVariants)
            ? data.productVariants
            : Array.isArray(data?.variants)
              ? data.variants
              : [];
      const match = variants.find((v: any) => {
        const id =
          v?.id ??
          v?.variantId ??
          v?.productVariantId ??
          v?.externalId;
        return id && variantId && String(id) === String(variantId);
      });
      const uid = match?.productUid ?? null;
      variantUidCache.set(key, uid || null);
      return uid || null;
    } catch {
      return null;
    }
  }

  // Enrich items with productUid where available
  const itemsWithUid = await Promise.all(
    cartItems.map(async (item) => {
      const productUid = await getProductUid(item.productId, item.variantId);
      return {
        storeProductId: item.productId,
        storeProductVariantId: item.variantId ?? '',
        quantity: item.quantity ?? 1,
        itemReferenceId: item.variantId || item.productId,
        ...(productUid ? { productUid } : {}),
      };
    }),
  );

  const payload = {
    orderReferenceId: session.id,
    storeId: gelatoStoreId,
    currency,
    // Helps Gelato UI show a reference (use email when available)
    customerReference: customer?.email || session.id,
    customer: {
      email: customer?.email ?? '',
      phone: shippingAddress.phone ?? customer?.phone ?? '',
      firstName: shippingAddress.name,
    },
    shippingAddress: {
      firstName: shippingAddress.name,
      addressLine1: shippingAddress.address.line1 ?? '',
      addressLine2: shippingAddress.address.line2 ?? '',
      city: shippingAddress.address.city ?? '',
      state: shippingAddress.address.state ?? '',
      postalCode: shippingAddress.address.postal_code ?? '',
      country: shippingAddress.address.country ?? '',
    },
    shippingMethod: 'standard',
    items: itemsWithUid,
  };

  console.log('Submitting Gelato order', {
    orderReferenceId: payload.orderReferenceId,
    storeId: payload.storeId,
    currency: payload.currency,
    items: payload.items,
  });

  const gelatoRes = await fetch('https://order.gelatoapis.com/v4/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': gelatoApiKey,
      // Prevent duplicate orders on Stripe retries
      'Idempotency-Key': session.id,
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
