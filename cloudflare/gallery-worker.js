const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
};

function pickVariant(variants, name) {
  if (!Array.isArray(variants) || variants.length === 0) return '';
  return variants.find((url) => url.endsWith(`/${name}`)) || variants[0];
}

function normalizeImage(image) {
  const meta = image.meta && typeof image.meta === 'object' ? image.meta : {};
  const large = pickVariant(image.variants, 'public');
  const thumb = pickVariant(image.variants, 'thumb') || large;

  return {
    id: image.id,
    thumb,
    large,
    alt: meta.alt || meta.title || image.filename || 'Portfolio gallery image',
    caption: meta.caption || meta.title || image.filename || '',
    uploaded: image.uploaded || '',
    width: Number(meta.width) || 1200,
    height: Number(meta.height) || 900,
  };
}

function isGalleryImage(image) {
  const meta = image.meta && typeof image.meta === 'object' ? image.meta : {};
  return meta.gallery === true || meta.gallery === 'true' || String(image.filename || '').startsWith('gallery-');
}

function corsHeaders(request, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || '*';
  const requestOrigin = request.headers.get('origin');
  return {
    'access-control-allow-origin': allowedOrigin === '*' ? '*' : requestOrigin === allowedOrigin ? allowedOrigin : 'null',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET' || url.pathname !== '/gallery.json') {
      return new Response('Not found', { status: 404 });
    }

    if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_IMAGES_TOKEN) {
      return Response.json({ error: 'Worker bindings are not configured.' }, { status: 500, headers: cors });
    }

    const endpoint = new URL(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/images/v1`);
    endpoint.searchParams.set('per_page', '1000');
    endpoint.searchParams.set('sort_order', 'desc');

    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_IMAGES_TOKEN}` },
    });
    const payload = await response.json();

    if (!response.ok || payload.success !== true) {
      return Response.json(
        { error: 'Cloudflare Images list request failed.' },
        { status: 502, headers: { ...jsonHeaders, ...cors } },
      );
    }

    const images = (payload.result?.images || [])
      .filter(isGalleryImage)
      .map(normalizeImage)
      .filter((image) => image.thumb && image.large);

    return Response.json({ images }, { headers: { ...jsonHeaders, ...cors } });
  },
};
