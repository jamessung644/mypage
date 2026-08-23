const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
};

const imageExtensions = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp']);
const imageContentTypes = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function corsHeaders(request, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || '*';
  const requestOrigin = request.headers.get('origin');
  return {
    'access-control-allow-origin': allowedOrigin === '*' ? '*' : requestOrigin === allowedOrigin ? allowedOrigin : 'null',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-allow-headers': 'content-type, range',
    vary: 'Origin',
  };
}

function encodeObjectKey(key) {
  return key.split('/').map(encodeURIComponent).join('/');
}

function fileDetails(key) {
  const filename = key.split('/').pop() || '';
  const dotIndex = filename.lastIndexOf('.');
  const extension = dotIndex >= 0 ? filename.slice(dotIndex + 1).toLowerCase() : '';
  const stem = dotIndex >= 0 ? filename.slice(0, dotIndex) : filename;
  return {
    extension,
    title: stem.replace(/[-_]+/g, ' ').trim() || 'Portfolio gallery image',
  };
}

function normalizeObject(object, origin) {
  const metadata = object.customMetadata || {};
  const details = fileDetails(object.key);
  const etag = String(object.etag || '').replace(/^"|"$/g, '');
  const version = etag ? `?v=${encodeURIComponent(etag)}` : '';
  const imageUrl = `${origin}/image/${encodeObjectKey(object.key)}${version}`;
  const uploaded = object.uploaded instanceof Date
    ? object.uploaded.toISOString()
    : new Date(object.uploaded || 0).toISOString();

  return {
    id: object.key,
    thumb: imageUrl,
    large: imageUrl,
    alt: metadata.alt || metadata.caption || details.title,
    caption: metadata.caption || details.title,
    uploaded,
    width: Number(metadata.width) || 1200,
    height: Number(metadata.height) || 900,
  };
}

function isGalleryImage(object) {
  if (!object || typeof object.key !== 'string' || !object.key.startsWith('gallery/')) return false;
  return imageExtensions.has(fileDetails(object.key).extension);
}

async function galleryResponse(env, url, cors) {
  if (!env.GALLERY_BUCKET || typeof env.GALLERY_BUCKET.list !== 'function') {
    return Response.json(
      { error: 'R2 binding GALLERY_BUCKET is not configured.' },
      { status: 500, headers: { ...jsonHeaders, ...cors } },
    );
  }

  const result = await env.GALLERY_BUCKET.list({
    prefix: 'gallery/',
    include: ['customMetadata'],
    limit: 1000,
  });
  const images = (result.objects || [])
    .filter(isGalleryImage)
    .sort((a, b) => new Date(b.uploaded || 0) - new Date(a.uploaded || 0))
    .map((object) => normalizeObject(object, url.origin));

  return Response.json({ images }, { headers: { ...jsonHeaders, ...cors } });
}

function decodeObjectKey(pathname) {
  try {
    return pathname
      .slice('/image/'.length)
      .split('/')
      .map(decodeURIComponent)
      .join('/');
  } catch {
    return '';
  }
}

async function imageResponse(request, env, url, cors) {
  if (!env.GALLERY_BUCKET || typeof env.GALLERY_BUCKET.get !== 'function') {
    return Response.json(
      { error: 'R2 binding GALLERY_BUCKET is not configured.' },
      { status: 500, headers: { ...jsonHeaders, ...cors } },
    );
  }

  const key = decodeObjectKey(url.pathname);
  if (!isGalleryImage({ key })) return new Response('Not found', { status: 404, headers: cors });

  const object = await env.GALLERY_BUCKET.get(key);
  if (!object) return new Response('Not found', { status: 404, headers: cors });

  const headers = new Headers(cors);
  if (typeof object.writeHttpMetadata === 'function') object.writeHttpMetadata(headers);
  if (!headers.has('content-type')) headers.set('content-type', imageContentTypes[fileDetails(key).extension]);
  if (object.httpEtag) headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(request.method === 'HEAD' ? null : object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method === 'GET' && url.pathname === '/gallery.json') {
      return galleryResponse(env, url, cors);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/image/')) {
      return imageResponse(request, env, url, cors);
    }
    return new Response('Not found', { status: 404, headers: cors });
  },
};
