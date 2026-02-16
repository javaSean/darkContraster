// Downloads remote product images to public/dev-images for local development.
// Run with: npm run cache:dev-images
// Requires GELATO_API_KEY and GELATO_STORE_ID in env.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');

const GELATO_API_KEY = process.env.GELATO_API_KEY;
const GELATO_STORE_ID = process.env.GELATO_STORE_ID;

if (!GELATO_API_KEY || !GELATO_STORE_ID) {
  console.error('Missing GELATO_API_KEY or GELATO_STORE_ID in environment.');
  process.exit(1);
}

const OUT_DIR = path.join(process.cwd(), 'public', 'dev-images');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');

async function main() {
  await fsp.mkdir(OUT_DIR, { recursive: true });

  const products = await fetchProducts();
  const urls = collectImageUrls(products);
  if (!urls.length) {
    console.warn('No image URLs found from Gelato products.');
    return;
  }

  const manifest = {};
  for (const url of urls) {
    try {
      const filename = await downloadImage(url, OUT_DIR);
      manifest[url] = `/dev-images/${filename}`;
      console.log('Cached', url, '->', filename);
    } catch (err) {
      console.warn('Failed to cache', url, err.message);
    }
  }

  await fsp.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Saved manifest with ${Object.keys(manifest).length} entries to ${MANIFEST_PATH}`);
}

async function fetchProducts() {
  const url = `https://ecommerce.gelatoapis.com/v1/stores/${GELATO_STORE_ID}/products?order=desc&orderBy=createdAt&offset=0&limit=100`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': GELATO_API_KEY,
    },
  });
  if (!res.ok) {
    throw new Error(`Gelato products fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.products)
      ? data.products
      : Array.isArray(data)
        ? data
        : [];
  return items;
}

function collectImageUrls(products) {
  const urls = new Set();
  products.forEach((product) => {
    const top = pickImage(product);
    if (top) urls.add(top);
    const variants = Array.isArray(product.productVariants) ? product.productVariants : [];
    variants.forEach((variant) => {
      const v = pickImage(variant);
      if (v) urls.add(v);
    });
  });
  return Array.from(urls);
}

function pickImage(entry) {
  if (!entry) return null;
  const candidates = [
    entry.media?.[0]?.url,
    entry.images?.[0]?.url,
    entry.thumbnailUrl,
    entry.previewImageUrl,
    entry.previewUrl,
    entry.mockups?.[0]?.image?.url,
  ];
  return candidates.find((u) => typeof u === 'string' && u.length > 0) || null;
}

async function downloadImage(url, dir) {
  const hash = crypto.createHash('md5').update(url).digest('hex');
  const extMatch = /\.([a-zA-Z0-9]+)(\?.*)?$/.exec(url);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'img';
  const filename = `${hash}.${ext}`;
  const dest = path.join(dir, filename);

  if (fs.existsSync(dest)) return filename;

  const buffer = await fetchBuffer(url);
  await fsp.writeFile(dest, buffer);
  return filename;
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
