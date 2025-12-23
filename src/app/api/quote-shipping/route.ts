import { NextResponse } from 'next/server';

const gelatoApiKey = process.env.GELATO_API_KEY;
const gelatoStoreId = process.env.GELATO_STORE_ID;

const EU_COUNTRIES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
]);

export async function POST(request: Request) {
  if (!gelatoApiKey || !gelatoStoreId) {
    return NextResponse.json({ error: 'Gelato not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { items, address } = body ?? {};

    if (!Array.isArray(items) || !items.length) {
      return NextResponse.json({ error: 'Missing items' }, { status: 400 });
    }

    if (!address?.country || !address?.postalCode) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    const normalizedItems = items
      .map((item: any) => ({
        productId: String(item.productId ?? ''),
        variantId: item.variantId ? String(item.variantId) : '',
        quantity: Number(item.quantity ?? 1) || 1,
      }))
      .filter((item) => item.productId);

    if (!normalizedItems.length) {
      return NextResponse.json({ error: 'Invalid items' }, { status: 400 });
    }

    const quotePayload = {
      storeId: gelatoStoreId,
      orderReferenceId: `quote-${Date.now()}`,
      shippingMethod: 'standard',
      items: normalizedItems.map((item) => ({
        storeProductId: item.productId,
        storeProductVariantId: item.variantId,
        quantity: item.quantity,
      })),
      shippingAddress: {
        country: String(address.country).toUpperCase(),
        postalCode: String(address.postalCode),
        city: address.city || 'City',
        state: address.state || '',
        addressLine1: address.addressLine1 || 'Address line',
        addressLine2: address.addressLine2 || '',
      },
    };

    let gelatoRes: Response;
    // Store-friendly quote endpoint (same host used for order creation with store products)
    const url = 'https://order.gelatoapis.com/v4/orders/quotes';
    try {
      gelatoRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': gelatoApiKey,
        },
        body: JSON.stringify(quotePayload),
      });
    } catch (err) {
      return NextResponse.json(
        { error: 'Network error contacting Gelato', detail: (err as Error)?.message ?? '', url },
        { status: 502 },
      );
    }

    if (!gelatoRes.ok) {
      const text = await gelatoRes.text();
      return NextResponse.json(
        {
          error: 'Gelato quote failed',
          detail: text || gelatoRes.statusText,
          status: gelatoRes.status,
          url,
        },
        { status: 502 },
      );
    }

    const data = await gelatoRes.json();
    const gelatoShippingCents = Math.round((data?.shipping?.totalAmount ?? 0) * 100);
    const country = quotePayload.shippingAddress.country;

    const bandCents = getBandCents(country);
    const toleranceCents = 400; // $4 tolerance ceiling
    const base = Math.max(bandCents, gelatoShippingCents);
    const threshold = bandCents + toleranceCents;
    const chargeRaw = base > threshold ? base : bandCents;
    const chargeCents = Math.ceil(chargeRaw / 100) * 100; // round up to whole dollars
    const surcharge = chargeCents > bandCents;

    return NextResponse.json({
      country,
      gelatoShippingCents,
      chargeCents,
      bandCents,
      surcharge,
      currency: 'usd',
      quoteId: data?.id ?? '',
      raw: data,
    });
  } catch (error) {
    console.error('Quote error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to fetch quote' },
      { status: 500 },
    );
  }
}

function getBandCents(country: string) {
  const iso = country.toUpperCase();
  if (iso === 'US') return 500;
  if (EU_COUNTRIES.has(iso)) return 900;
  return 1500;
}
