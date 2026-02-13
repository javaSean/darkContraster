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
      // Always fresh to avoid cache when checking updates or new media
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

    const filteredProducts = rawProducts.filter((product: any) => {
      const status = String(product.status ?? '').toLowerCase();
      const tags = Array.isArray(product.tags)
        ? product.tags.map((t: any) => String(t).toLowerCase())
        : [];
      const ignoredFlag = Boolean(product.ignore ?? product.ignored ?? product.hidden);

      // Exclude publishing errors, drafts, inactive/unpublished, explicit ignored/hidden status or flag, or ignore/hidden tag
      const isBadStatus =
        status === 'publishing_error' ||
        status === 'draft' ||
        status === 'inactive' ||
        status === 'unpublished' ||
        status === 'ignored';
      const isIgnoredTag = tags.includes('ignore') || tags.includes('hidden');

      return !isBadStatus && !isIgnoredTag && !ignoredFlag;
    });

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

    const debug = req.nextUrl.searchParams.get('debug');
    if (debug === '1') {
      return NextResponse.json({
        storeId,
        productCount: enrichedProducts.length,
        upstreamCount: filteredProducts.length,
        upstreamStatus: 200,
        sampleNames: enrichedProducts.slice(0, 5).map((p: any) => p?.name ?? p?.title ?? p?.id),
        data: payload,
      });
    }

    // Debug variant image fields to see what Gelato returns per variant
    if (debug === 'images') {
      const nameFilter = req.nextUrl.searchParams.get('name')?.toLowerCase() ?? '';
      const variantsDebug = enrichedProducts
        .filter((product: any) =>
          nameFilter ? String(product.name ?? product.title ?? '').toLowerCase().includes(nameFilter) : true,
        )
        .map((product: any) => {
          const variants = Array.isArray(product.variantDetails)
            ? product.variantDetails
            : Array.isArray(product.productVariants)
              ? product.productVariants
              : Array.isArray(product.variants)
                ? product.variants
                : [];

          const variantSnapshots = variants.map((variant: any) => {
            const candidates = [
              variant.media?.[0]?.url,
              variant.images?.[0]?.url,
              variant.mockups?.[0]?.image?.url,
              variant.mockups?.[0]?.url,
              variant.externalPreviewUrl,
              variant.externalThumbnailUrl,
              variant.previewUrl,
              variant.previewImageUrl,
              variant.productPreviewImages?.[0],
              variant.files?.[0]?.thumbnailUrl,
              variant.files?.[0]?.url,
            ].filter(Boolean);

            return {
              id: variant.id ?? variant.variantId ?? variant.productVariantId,
              title: variant.title ?? variant.name,
              candidates,
            };
          });

          return {
            productId: product.id,
            name: product.name ?? product.title,
            productImages: [
              product.media?.map((m: any) => m?.url),
              product.images?.map((m: any) => m?.url),
              product.thumbnailUrl,
              product.previewImageUrl,
              product.previewUrl,
            ]
              .flat()
              .filter(Boolean),
            variants: variantSnapshots,
          };
        });

      return NextResponse.json({
        storeId,
        products: variantsDebug,
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
      cache: 'no-store',
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
