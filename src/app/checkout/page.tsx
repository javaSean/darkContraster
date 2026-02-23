'use client';

// Ensure this page always renders server-side (avoids static 404 on some hosts)
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '../../context/CartContext';

interface RawProduct {
  id?: string;
  productId?: string;
  sku?: string;
  name?: string;
  title?: string;
  price?: { amount?: number; currency?: string; formatted?: string };
  variantDetails?: RawVariant[];
  productVariants?: RawVariant[];
  variants?: RawVariant[];
  media?: any[];
  images?: any[];
  thumbnailUrl?: string;
  previewImageUrl?: string;
  previewUrl?: string;
}

interface RawVariant {
  id?: string;
  variantId?: string;
  productVariantId?: string;
  externalId?: string;
  title?: string;
  name?: string;
  price?: number | { amount?: number; currency?: string };
  currency?: string;
  media?: any[];
  images?: any[];
  mockups?: any[];
  previewImageUrl?: string;
  previewUrl?: string;
}

export default function CheckoutPrefillPage() {
  return (
    <Suspense fallback={<LoadingState message="Preparing your checkout…" />}>
      <CheckoutPrefillInner />
    </Suspense>
  );
}

function CheckoutPrefillInner() {
  const search = useSearchParams();
  const router = useRouter();
  const { replaceItems, setCouponCode, toggleCart } = useCart();

  const productId = search.get('productId')?.trim() || search.get('pid')?.trim() || '';
  const variantParam = search.get('variantId')?.trim() || search.get('vid')?.trim() || '';
  const quantityParam = search.get('quantity') || search.get('qty') || '1';
  const couponParam = search.get('coupon')?.trim() || '';
  const productsParam = search.get('products')?.trim() || '';

  const quantity = useMemo(() => {
    const n = parseInt(quantityParam, 10);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 1;
  }, [quantityParam]);

  const [status, setStatus] = useState<'idle' | 'fetching' | 'done' | 'failed'>('idle');
  const [message, setMessage] = useState('Preparing your checkout…');

  useEffect(() => {
    async function run() {
      setStatus('fetching');
      setMessage('Adding your item…');

      try {
        const res = await fetch('/api/store-products', { cache: 'no-store' });
        if (!res.ok) throw new Error('Could not load products');
        const data = await res.json();
        const products: RawProduct[] = Array.isArray(data?.products)
          ? data.products
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data)
              ? data
              : [];

        const parsedList = parseProductsParam(productsParam);
        const targets = parsedList.length
          ? parsedList
          : productId
            ? [{ productId, quantity, variantId: variantParam || undefined }]
            : [];

        if (!targets.length) {
          setMessage('No products specified. Redirecting to store…');
          router.replace('/#store');
          return;
        }

        const itemsToAdd = [];
        for (const t of targets.slice(0, 10)) {
          const match = products.find((p) =>
            [p.id, p.productId, p.sku].filter(Boolean).some((id) => String(id).trim() === t.productId),
          );
          if (!match) continue;

          const variants: RawVariant[] = Array.isArray(match.variantDetails)
            ? match.variantDetails
            : Array.isArray(match.productVariants)
              ? match.productVariants
              : Array.isArray(match.variants)
                ? match.variants
                : [];

          const variant = t.variantId
            ? variants.find((v) =>
                [v.id, v.variantId, v.productVariantId, v.externalId].filter(Boolean).some((id) => String(id).trim() === t.variantId),
              ) || variants[0]
            : variants[0];

          const priceValue = normalizePrice(variant?.price ?? match.price);
          const currency = normalizeCurrency(variant?.currency ?? (variant?.price as any)?.currency ?? match.price?.currency ?? 'USD');
          if (!priceValue || !currency) continue;

          const image = pickImage(variant, match);

          itemsToAdd.push({
            productId: t.productId,
            variantId: variant ? (variant.id ?? variant.variantId ?? variant.productVariantId ?? variant.externalId ?? undefined) : undefined,
            name: match.name ?? match.title ?? 'Product',
            variantTitle: variant?.title ?? variant?.name,
            unitAmount: priceValue,
            currency,
            image,
            quantity: t.quantity,
          });
        }

        if (!itemsToAdd.length) throw new Error('No matching products to add');

        // Replace cart with provided items
        replaceItems(itemsToAdd);

        if (couponParam) setCouponCode(couponParam);

        setStatus('done');
        setMessage('Item added. Opening cart…');
        toggleCart();
        router.replace('/#store');
      } catch (err) {
        console.error(err);
        setStatus('failed');
        setMessage('Could not prepare checkout. Please choose your item in the store.');
        setTimeout(() => router.replace('/#store'), 1200);
      }
    }

    run();
  }, [couponParam, productId, quantity, router, setCouponCode, toggleCart, variantParam]);

  return <LoadingState message={message} showFailed={status === 'failed'} />;
}

function LoadingState({ message, showFailed }: { message: string; showFailed?: boolean }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        color: '#f7f7f7',
        background: '#050505',
      }}
    >
      <div style={{ maxWidth: 360, textAlign: 'center', lineHeight: 1.5 }}>
        <div
          className="checkout-spinner"
          style={{
            margin: '0 auto 14px',
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '3px solid rgba(255, 255, 255, 0.25)',
            borderTopColor: '#fff',
            animation: 'checkout-spin 0.9s linear infinite',
          }}
        />
        <p>{message}</p>
        {showFailed && <p style={{ fontSize: 14, opacity: 0.8 }}>We&rsquo;re redirecting you to the store.</p>}
      </div>
      <style jsx global>{`
        @keyframes checkout-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

function normalizePrice(price: any): number | null {
  if (typeof price === 'number') return price;
  if (price && typeof price.amount === 'number') return price.amount;
  return null;
}

function normalizeCurrency(input: any): string {
  const cur = typeof input === 'string' ? input : '';
  return cur || 'USD';
}

function parseProductsParam(input: string): { productId: string; quantity: number; variantId?: string }[] {
  if (!input) return [];
  return input
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const parts = token.split(':').map((p) => p.trim()).filter(Boolean);
      const [pid, qtyRaw, vid] = parts;
      const qty = Math.min(Math.max(parseInt(qtyRaw || '1', 10) || 1, 1), 10);
      return { productId: pid, quantity: qty, variantId: vid };
    })
    .filter((entry) => entry.productId);
}

function pickImage(variant?: RawVariant, product?: RawProduct): string | undefined {
  const candidates = [
    (variant as any)?.mockups?.[0]?.image?.url,
    (variant as any)?.mockups?.[0]?.url,
    (variant as any)?.images?.[0]?.url,
    (variant as any)?.media?.[0]?.url,
    variant?.previewImageUrl,
    variant?.previewUrl,
    (product as any)?.media?.[0]?.url,
    (product as any)?.images?.[0]?.url,
    product?.thumbnailUrl,
    product?.previewImageUrl,
    product?.previewUrl,
  ];
  return candidates.find((c) => typeof c === 'string' && c.length > 0);
}
