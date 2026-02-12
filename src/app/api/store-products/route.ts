import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const apiKey = process.env.GELATO_API_KEY;
  const storeId = process.env.GELATO_STORE_ID;

  if (!apiKey || !storeId) {
    return NextResponse.json(
      { error: 'Missing GELATO_API_KEY or GELATO_STORE_ID env vars' },
      { status: 500 },
    );
  }

  const url = `https://ecommerce.gelatoapis.com/v1/stores/${storeId}/products?order=desc&orderBy=createdAt&offset=0&limit=100`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      // Always fetch fresh so newly published products appear immediately
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gelato products fetch failed', response.status, errorText);
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    const rawProducts = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.products)
        ? data.products
        : Array.isArray(data)
          ? data
          : [];

    const filteredProducts = rawProducts.filter(
      (product: any) => (product.status ?? '').toLowerCase() !== 'publishing_error',
    );

    const enrichedProducts = await Promise.all(
      filteredProducts.map(async (product: any) => {
        const variantDetails = await fetchProductVariants(storeId, product.id, apiKey);
        return { ...product, variantDetails };
      }),
    );

    const payload = {
      ...data,
      products: enrichedProducts,
    };

    if (req.nextUrl.searchParams.get('debug') === '1') {
      return NextResponse.json({
        storeId,
        productCount: enrichedProducts.length,
        upstreamCount: filteredProducts.length,
        upstreamStatus: 200,
        sampleNames: enrichedProducts.slice(0, 5).map((p: any) => p?.name ?? p?.title ?? p?.id),
        data: payload,
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Gelato products fetch exception', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Gelato products' },
      { status: 500 },
    );
  }
}

async function fetchProductVariants(storeId: string, productId: string, apiKey: string) {
  if (!productId) return [];

  const variantUrl = `https://ecommerce.gelatoapis.com/v1/stores/${storeId}/products/${productId}/variants`;

  try {
    const response = await fetch(variantUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return Array.isArray(data?.productVariants) ? data.productVariants : [];
  } catch {
    return [];
  }
}
