import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  try {
    // Accept absolute URLs and also resolve site-relative paths against the current origin
    const target = url.startsWith('/')
      ? new URL(url, req.nextUrl.origin)
      : new URL(url);
    const response = await fetch(target.toString(), {
      headers: {
        // Spoof UA and referer to avoid hotlink 403s from WP/Photon
        'User-Agent': req.headers.get('user-agent') ?? 'Mozilla/5.0 (compatible)',
        Referer: target.origin,
        },
      redirect: 'follow',
    });

    if (!response.ok) {
      // Fallback to images.weserv.nl proxy if origin blocks us
      const fallback = buildWeservUrl(target);
      return NextResponse.redirect(fallback, 302);
    }

    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    const target = safeURL(url);
    if (target) {
      const fallback = buildWeservUrl(target);
      return NextResponse.redirect(fallback, 302);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 400 },
    );
  }
}

function buildWeservUrl(target: URL) {
  // images.weserv.nl expects host/path without scheme
  const stripped = target.href.replace(/^https?:\/\//, '');
  return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}&w=1600&output=webp`;
}

function safeURL(value: string | null) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}
