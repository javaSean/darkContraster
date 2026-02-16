import Image from 'next/image';
import fs from 'node:fs';
import path from 'node:path';
import { headers } from 'next/headers';
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

export const dynamic = 'force-dynamic';

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

// Local overrides for products whose cloud mockups are incomplete.
const PRODUCT_IMAGE_OVERRIDES: Record<string, string[]> = {
  // Dark Contraster Hardcover Photo Book - full page collages
  '98d6eaa2-f9c7-4c1d-ad26-b3cbd6f4be4c': [
    '/images/hardcoverPhotos/cover-front.webp',
    '/images/hardcoverPhotos/inner-spread-2.webp',
    '/images/hardcoverPhotos/inner-spread-3.webp',
    '/images/hardcoverPhotos/inner-spread-4.webp',
  ],
};

// Folder-based overrides, matched by product name (case-insensitive substring).
const PRODUCT_FOLDER_OVERRIDES: Record<string, string> = {
  'hard cover photo book - collages & poems': 'hardcoverPoemPhotos',
  'hardcover photo book - collages & poems': 'hardcoverPoemPhotos',
};

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
        <MobileSnapManager/>
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
      src: `/galleryImages/${file}`,
    }));
}

async function fetchGelatoProducts(): Promise<StoreProduct[]> {
  // Prefer the current host so we always hit the right deployment/domain
  const host = headers().get('host');
  const protocol = host?.startsWith('localhost') ? 'http' : 'https';
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (host ? `${protocol}://${host}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

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
          productImages: extractProductImages(product),
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
    product.variantDetails?.[0]?.externalPreviewUrl,
    product.variantDetails?.[0]?.externalThumbnailUrl,
    product.productVariants?.[0]?.media?.[0]?.url,
    product.productVariants?.[0]?.images?.[0]?.url,
    product.productVariants?.[0]?.mockups?.[0]?.image?.url,
    product.previewUrl,
  ];

  const src = candidates.find((url) => typeof url === 'string' && url.length > 0);
  return resolveDevImage(src);
}

function extractProductImages(product: any): string[] {
  const overrideGallery = getOverrideGallery(product);
  if (overrideGallery.length) return overrideGallery;

  const pools = [
    normalizeToUrls(product.media),
    normalizeToUrls(product.images),
    normalizeToUrls(product.mockups),
    normalizeToUrls(product.productImages),
    normalizeToUrls(product.productPreviewImages),
    normalizeToUrls(product.files),
    [product.thumbnailUrl, product.previewImageUrl, product.previewUrl],
  ];
  const flat = pools.flat();
  const urls = flat.filter((url) => typeof url === 'string' && url.length > 0).map((url) => resolveDevImage(url));

  // Also pull in any folder override based on product name (for manuals)
  const productName = (product?.name ?? product?.title ?? '').toLowerCase();
  const folderMatch = Object.entries(PRODUCT_FOLDER_OVERRIDES).find(([needle]) => productName.includes(needle));
  if (folderMatch) {
    const folderImages = loadLocalFolderImages(folderMatch[1]);
    urls.push(...folderImages.map((url) => resolveDevImage(url)));
  }

  return urls;
}

function extractVariantImage(variant: any, product: any): string | undefined {
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
    product.productVariants?.find((entry: any) => entry?.id === variant?.id)?.mockups?.[0]?.url,
    product.productVariants?.find((entry: any) => entry?.id === variant?.id)?.media?.[0]?.url,
    product.productVariants?.find((entry: any) => entry?.id === variant?.id)?.previewImageUrl,
    product.productVariants?.find((entry: any) => entry?.id === variant?.id)?.images?.[0]?.url,
    product.productVariants?.find((entry: any) => entry?.id === variant?.id)?.mockups?.[0]?.image?.url,
  ];

  const src = candidates.find((url) => typeof url === 'string' && url.length > 0);
  return resolveDevImage(src) ?? undefined;
}

function extractVariantImages(variant: any, product: any): string[] {
  const overrideGallery = getOverrideGallery(product);
  if (overrideGallery.length) return overrideGallery;

  const pools = [
    normalizeToUrls(variant.media),
    normalizeToUrls(variant.images),
    normalizeToUrls(variant.mockups),
    normalizeToUrls(variant.mockupPreviews),
    normalizeToUrls(variant.productMockups),
    normalizeToUrls(variant.productPreviewImages),
    normalizeToUrls(variant.previewUrls),
    normalizeToUrls(variant.previewUrl),
    normalizeToUrls(variant.previewImages),
    normalizeToUrls(variant.externalPreviewUrl),
    normalizeToUrls(variant.externalThumbnailUrl),
    normalizeToUrls(variant.files),
    normalizeToUrls(
      product.productVariants
        ?.filter((entry: any) => entry?.id === variant?.id)
        ?.flatMap((entry: any) => [
          entry?.images,
          entry?.mockups,
          entry?.mockupPreviews,
          entry?.productMockups,
          entry?.media,
          entry?.previewUrls,
          entry?.previewUrl,
          entry?.previewImageUrl,
          entry?.previewImages,
          entry?.externalPreviewUrl,
          entry?.externalThumbnailUrl,
        ]),
    ),
  ];

  const flat = pools.flat();
  const urls = flat.filter((url) => typeof url === 'string' && url.length > 0).map((url) => resolveDevImage(url));

  // Append any local overrides for this product (e.g., hardcover book manual mockups)
  const override =
    PRODUCT_IMAGE_OVERRIDES[product?.id] || PRODUCT_IMAGE_OVERRIDES[product?.productId] || PRODUCT_IMAGE_OVERRIDES[product?.sku];
  if (override?.length) {
    urls.push(...override.map((url) => resolveDevImage(url)));
  }

  // Name-based folder overrides (e.g., poems hardcover manual images)
  const productName = (product?.name ?? product?.title ?? '').toLowerCase();
  let folderMatch = Object.entries(PRODUCT_FOLDER_OVERRIDES).find(([needle]) => productName.includes(needle));
  if (
    !folderMatch &&
    productName.includes('hard') &&
    productName.includes('cover') &&
    (productName.includes('poem') || productName.includes('poems'))
  ) {
    folderMatch = ['hardcover-poem-fallback', 'hardcoverPoemPhotos'];
  }
  if (folderMatch) {
    const folderImages = loadLocalFolderImages(folderMatch[1]);
    urls.push(...folderImages.map((url) => resolveDevImage(url)));
  }

  // Keep order but drop exact duplicates
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const u of urls) {
    if (!u) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    unique.push(u);
  }
  return unique;
}

function getOverrideGallery(product: any): string[] {
  const pid = product?.id ?? product?.productId ?? product?.sku ?? '';
  const name = (product?.name ?? product?.title ?? '').toLowerCase();

  // Hard overrides: use only local folders, ignore remote images
  const COLLAGE_ID = '98d6eaa2-f9c7-4c1d-ad26-b3cbd6f4be4c';
  const isCollage = pid === COLLAGE_ID || name.includes('full page collages');
  if (isCollage) {
    return loadLocalFolderImages('hardcoverPhotos').map((url) => resolveDevImage(url));
  }

  const POEM_IDS = ['hardcover-poem-fallback'];
  const poemMatch =
    name.includes('collages & poems') ||
    name.includes('collages and poems') ||
    (name.includes('hard') && name.includes('cover') && (name.includes('poem') || name.includes('poems')));
  if (poemMatch || POEM_IDS.includes(pid)) {
    return loadLocalFolderImages('hardcoverPoemPhotos').map((url) => resolveDevImage(url));
  }

  // ID-based overrides table
  const override =
    PRODUCT_IMAGE_OVERRIDES[pid] || PRODUCT_IMAGE_OVERRIDES[product?.productId] || PRODUCT_IMAGE_OVERRIDES[product?.sku];
  if (override?.length) return override.map((url) => resolveDevImage(url));

  return [];
}

function normalizeToUrls(input: any): string[] {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];
  const urls: string[] = [];
  arr.forEach((item) => {
    if (!item) return;
    if (typeof item === 'string') {
      urls.push(item);
      return;
    }
    if (typeof item === 'object') {
      const candidates = [
        item.url,
        item.src,
        item.href,
        item.image?.url,
        item.thumbnailUrl,
        item.previewUrl,
        item.previewImageUrl,
      ];
      const found = candidates.find((c) => typeof c === 'string' && c.length > 0);
      if (found) urls.push(found);
    }
  });
  return urls;
}

function loadLocalFolderImages(folderName: string): string[] {
  const dir = path.join(process.cwd(), 'public', 'images', folderName);
  try {
    const files = fs.readdirSync(dir).filter((file) => /\.(jpe?g|png|webp|gif)$/i.test(file));
    return files.sort().map((file) => `/images/${folderName}/${file}`);
  } catch {
    return [];
  }
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
      const images = extractVariantImages(variant, product);

      return {
        id: String(id),
        title,
        image: extractVariantImage(variant, product),
        images: images.length ? images : undefined,
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
    const segments = fallbackTitle.split(',');
    segments.forEach((segment) => {
      const [name, value] = segment.split(':');
      if (name && value) {
        optionMap[name.trim()] = value.trim();
      }
    });
    // If still empty, fall back to first colon split
    if (Object.keys(optionMap).length === 0) {
      const [name, value] = fallbackTitle.split(':');
      if (name && value) {
        optionMap[name.trim()] = value.trim();
      }
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

function resolveDevImage(url?: string | null): string {
  if (!url) return '';
  // If already a relative path, return as-is (it points to /public)
  if (url.startsWith('/')) return url;
  // In development, prefer cached local copy if manifest maps this URL
  if (process.env.NODE_ENV === 'development') {
    const manifest = getDevImageManifest();
    if (manifest && manifest[url]) {
      return manifest[url];
    }
  }
  // Otherwise fall back to proxy for hosts that hotlink-protect
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    // Skip proxy for shop.darkcontraster.com (serve directly)
    if (host === 'shop.darkcontraster.com') {
      return appendImageVersion(url);
    }
    // Do not append cache-buster to signed URLs (X-Amz-*), or Gelato S3 host
    const hasSignedParams = Array.from(parsed.searchParams.keys()).some((k) => k.toLowerCase().startsWith('x-amz-'));
    const isGelatoS3 = host.includes('gelato-api-live.s3');
    if (host.includes('darkcontraster.com') || host.includes('wp.com')) {
      const targetUrl = hasSignedParams || isGelatoS3 ? url : appendImageVersion(url);
      return `/api/image-proxy?url=${encodeURIComponent(targetUrl)}`;
    }
    return hasSignedParams || isGelatoS3 ? url : appendImageVersion(url);
  } catch {
    return '';
  }
}

let cachedManifest: Record<string, string> | null | undefined;
function getDevImageManifest(): Record<string, string> | null {
  if (cachedManifest !== undefined) return cachedManifest;
  const manifestPath = path.join(process.cwd(), 'public', 'dev-images', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    cachedManifest = null;
    return null;
  }
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    cachedManifest = JSON.parse(raw) as Record<string, string>;
    return cachedManifest;
  } catch {
    cachedManifest = null;
    return null;
  }
}

function appendImageVersion(url: string): string {
  const version =
    process.env.NEXT_PUBLIC_IMAGE_VERSION ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.VERCEL_BUILD_ID ??
    '';
  if (!version) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${version}`;
}
