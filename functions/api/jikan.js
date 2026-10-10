// Cloudflare Pages Function: /api/jikan
// Proxies Jikan (MyAnimeList) API requests with edge caching.

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
      },
    });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const endpoint = url.searchParams.get('endpoint');

  if (!endpoint) {
    return new Response(JSON.stringify({ error: 'Missing endpoint' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let cleanEndpoint = endpoint.trim();
  if (!cleanEndpoint.startsWith('/')) {
    cleanEndpoint = '/' + cleanEndpoint;
  }

  if (!/^\/(anime|top\/anime|seasons\/now)(\?|$)/.test(cleanEndpoint)) {
    return new Response(JSON.stringify({ error: 'Unsupported Jikan endpoint' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const targetUrl = `https://api.jikan.moe/v4${cleanEndpoint}`;

  // Check Cloudflare Edge Cache
  const cacheKey = new Request(targetUrl, { method: 'GET' });
  const cache = caches.default;
  let response = await cache.match(cacheKey);

  if (response) {
    return response;
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PiraTY/1.0',
      },
    });

    const data = await upstream.text();
    const headers = new Headers();
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.set('Access-Control-Allow-Origin', '*');

    // Cache anime queries for 1 hour at Cloudflare Edge
    if (upstream.status === 200) {
      headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    } else {
      headers.set('Cache-Control', 'no-cache');
    }

    response = new Response(data, {
      status: upstream.status,
      headers,
    });

    if (upstream.status === 200) {
      context.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Jikan request failed', details: String(err) }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

