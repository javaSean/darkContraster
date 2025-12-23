import Image from 'next/image';
import fs from 'node:fs';
import path from 'node:path';
import { EnterButton } from '../components/EnterButton';
import { GallerySearch } from '../components/GallerySearch';
import { MobileTabs } from '../components/MobileTabs';
import { MobileSnapManager } from '../components/MobileSnapManager';
import { StoreSection } from '../components/StoreSection';
import type {
  StoreCategory,
  StoreProduct,
  StoreVariant,
  StoreProductOption,
} from '../types/store';

const galleryImages = getGalleryImages();

const socialLinks = [
  { label: 'Instagram', href: 'https://instagram.com/darkcontraster' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@darkcontraster' },
];

const navigationItems = [
  { label: 'Home', href: '#hero' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Store', href: '#store' },
  { label: 'Bio', href: '#bio' },
];

export default async function HomePage() {
  const storeProducts = await fetchGelatoProducts();

  return (
    <>
      <section className="hero" id="hero">
        <div className="hero-dog">
          <Image
            src="/images/darkContrasterDogAnimation.gif"
            alt="Dark Contraster dog animation"
            fill
            priority
            sizes="100vw"
            style={{ objectFit: 'contain' }}
            unoptimized
          />
        </div>
        <div className="hero-content">
          <div className="hero-actions start">
            <EnterButton />
          </div>
        </div>
      </section>

      <main id="site-root">
        <MobileSnapManager />
        <section className="section" id="gallery">
          <GallerySearch images={galleryImages} />
        </section>

        <StoreSection products={storeProducts} />

        <section className="section bio" id="bio">
          <div className="bio-columns">
            <div className="bio-block">
              <h2>Bio</h2>
              <p>
                Dark Contraster (aka Sean) builds new worlds with found images—not digital ones—magazines, photobooks,
                anything with a history. Inspired by imagination and dystopia, he creates immersive hand-cut art with razor
                blades and glue. These are his surreal creations. If you want something that makes you feel something different
                each time you look at it, his prints are available above, and the colors pop best framed without matte.
              </p>
            </div>
            <div className="bio-block">
              <h3 className="with-underline">Social</h3>
              <ul className="timeline">
                {socialLinks.map((link) => (
                  <li key={link.label}>
                    <strong>{link.label}</strong>
                    <a href={link.href} target="_blank" rel="noreferrer">
                      {link.href.replace(/^https?:\/\//, '')}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <MobileTabs items={navigationItems} />
      </main>
    </>
  );
}

type GalleryImage = {
  title: string;
  src: string;
};

function getGalleryImages(): GalleryImage[] {
  const dir = path.join(process.cwd(), 'public', 'galleryImages');
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return [];
  }

  return files
    .filter((file) => /\.(jpe?g|png|gif|webp)$/i.test(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => ({
      title: file.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(),
      src: `/galleryImages/${encodeURIComponent(file)}`,
    }));
}

async function fetchGelatoProducts(): Promise<StoreProduct[]> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  try {
    const response = await fetch(`${baseUrl}/api/store-products`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Gelato API error:', response.statusText);
      return [];
    }

    const data = await response.json();
    const rawProducts = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.products)
        ? data.products
        : Array.isArray(data)
          ? data
          : [];

    if (!Array.isArray(rawProducts)) {
      return [];
    }

    return rawProducts
      .map((product: any) => {
        const variants: StoreVariant[] = extractVariants(product);
        const primaryVariantPrice = variants[0]?.formattedPrice ?? '';
        return {
          id: (product.id ?? product.productId ?? product.sku ?? product.name ?? crypto.randomUUID()) as string,
          name: (product.name ?? product.title ?? 'Untitled product') as string,
          description: cleanHtml((product.description ?? product.longDescription ?? '') as string),
          price:
            product.price?.formatted ??
            (product.price?.amount ? `${product.price.amount} ${product.price.currency ?? ''}`.trim() : '') ??
            primaryVariantPrice,
          status:
            typeof product.status === 'string'
              ? product.status
              : typeof product.availability === 'string'
                ? product.availability
                : '',
          image: extractProductImage(product),
          tags: normalizeTags(product.tags),
          category: determineCategory(product),
          variants,
          options: extractProductOptions(product, variants),
        };
      })
      .filter((product) => product.status?.toLowerCase() !== 'publishing_error');
  } catch (error) {
    console.error('Failed to fetch Gelato products:', error);
    return [];
  }
}

function cleanHtml(input?: string): string {
  if (!input) return '';
  return input.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function extractProductImage(product: any): string {
  const candidates = [
    product.media?.[0]?.url,
    product.images?.[0]?.url,
    product.thumbnailUrl,
    product.previewImageUrl,
    product.productVariants?.[0]?.media?.[0]?.url,
    product.productVariants?.[0]?.images?.[0]?.url,
    product.productVariants?.[0]?.mockups?.[0]?.image?.url,
    product.previewUrl,
  ];

  const src = candidates.find((url) => typeof url === 'string' && url.length > 0);
  return src ?? '';
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag): tag is string => Boolean(tag));
}

function determineCategory(product: any): StoreCategory {
  const tags = normalizeTags(product.tags).map((tag) => tag.toLowerCase());
  const productType = String(product.productType ?? product.type ?? '').toLowerCase();

  const hasAccessoriesSignal = tags.some((tag) => tag.includes('accessor')) || productType.includes('accessor');
  if (hasAccessoriesSignal) return 'accessories';

  const hasPrintSignal = tags.some((tag) => tag.includes('print')) || productType.includes('print');
  if (hasPrintSignal) return 'prints';

  return 'other';
}

function extractVariants(product: any): StoreVariant[] {
  const sources = Array.isArray(product.variantDetails)
    ? product.variantDetails
    : Array.isArray(product.variants)
      ? product.variants
      : [];

  return sources
    .map((variant: any, index: number) => {
      const id =
        variant.id ??
        variant.variantId ??
        variant.productVariantId ??
        variant.externalId ??
        `${product.id ?? 'variant'}-${index}`;

      const rawTitle = variant.title ?? variant.name ?? buildVariantTitleFromOptions(variant);
      const title = typeof rawTitle === 'string' && rawTitle.trim().length > 0 ? rawTitle.trim() : 'Variant';
      const priceValue =
        typeof variant.price === 'number'
          ? variant.price
          : typeof variant.price?.amount === 'number'
            ? variant.price.amount
            : undefined;
      const currency = variant.currency ?? variant.price?.currency ?? product.price?.currency ?? 'USD';
      const optionMap = extractVariantOptions(variant, title);

      return {
        id: String(id),
        title,
        price: priceValue,
        currency,
        formattedPrice: formatPriceValue(priceValue, currency),
        options: optionMap,
        optionSignature: buildOptionSignature(optionMap),
      };
    })
    .filter((variant: StoreVariant) => Boolean(variant.title));
}

function buildVariantTitleFromOptions(variant: any): string | null {
  const options = Array.isArray(variant.options)
    ? variant.options
    : Array.isArray(variant.productVariantOptions)
      ? variant.productVariantOptions
      : [];

  if (!options.length) return null;

  const parts = options
    .map((option: any) => {
      if (typeof option === 'string') return option;
      if (option?.name && option?.value) return `${option.name}: ${option.value}`;
      if (option?.name && Array.isArray(option?.values)) return `${option.name}: ${option.values.join(', ')}`;
      return '';
    })
    .filter(Boolean);

  return parts.length ? parts.join(' / ') : null;
}

function extractProductOptions(product: any, variants: StoreVariant[]): StoreProductOption[] {
  const rawOptions = Array.isArray(product.productVariantOptions)
    ? product.productVariantOptions
    : Array.isArray(product.variantOptions)
      ? product.variantOptions
      : [];

  let normalized: StoreProductOption[] = rawOptions
    .map((option: any) => normalizeOption(option))
    .filter((option: StoreProductOption | null): option is StoreProductOption => Boolean(option));

  if (normalized.length === 0 && variants.length > 0) {
    const optionMap = new Map<string, Set<string>>();

    variants.forEach((variant: StoreVariant) => {
      Object.entries(variant.options).forEach(([name, value]) => {
        if (!name || !value) return;
        if (!optionMap.has(name)) {
          optionMap.set(name, new Set());
        }
        optionMap.get(name)!.add(value);
      });
    });

    normalized = Array.from(optionMap.entries()).map(([name, values]) => ({
      name,
      values: Array.from(values),
    }));
  }

  if (normalized.length > 0) {
    return normalized;
  }

  if (variants.length > 1) {
    return [
      {
        name: 'Variant',
        values: variants.map((variant) => variant.title),
      },
    ];
  }

  return [];
}

function normalizeOption(option: any): StoreProductOption | null {
  const name = typeof option?.name === 'string' ? option.name.trim() : '';
  if (!name) return null;

  const values = Array.isArray(option.values)
    ? option.values
    : Array.isArray(option.options)
      ? option.options
      : [];

  const normalizedValues = values
    .map((value: any) => {
      if (typeof value === 'string') return value.trim();
      if (typeof value?.name === 'string') return value.name.trim();
      return '';
    })
    .filter(Boolean);

  if (!normalizedValues.length) return null;

  return {
    name,
    values: normalizedValues,
  };
}

function extractVariantOptions(variant: any, fallbackTitle: string): Record<string, string> {
  const optionEntries = Array.isArray(variant.variantOptions)
    ? variant.variantOptions
    : Array.isArray(variant.options)
      ? variant.options
      : [];

  const optionMap: Record<string, string> = {};

  optionEntries.forEach((entry: any) => {
    if (entry?.name && entry?.value) {
      optionMap[entry.name.trim()] = entry.value.trim();
    }
  });

  if (Object.keys(optionMap).length === 0 && typeof fallbackTitle === 'string' && fallbackTitle.includes(':')) {
    const [name, value] = fallbackTitle.split(':');
    if (name && value) {
      optionMap[name.trim()] = value.trim();
    }
  }

  return optionMap;
}

function buildOptionSignature(options: Record<string, string>): string {
  const pairs = Object.entries(options).map(([name, value]) => {
    return `${normalizeOptionKey(name)}::${normalizeOptionValue(value)}`;
  });

  return pairs.sort().join('|');
}

function normalizeOptionKey(input: string) {
  return input.trim().toLowerCase();
}

function normalizeOptionValue(input: string) {
  return input.trim().toLowerCase();
}

function formatPriceValue(amount?: number, currency?: string): string {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount);
}
