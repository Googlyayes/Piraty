// Cloudflare Pages Function: /api/anilist
// Proxies AniList GraphQL requests.

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!payload || !payload.query) {
    return new Response(JSON.stringify({ error: 'Missing AniList query' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check Cloudflare edge cache for successful queries
  const queryStr = JSON.stringify({ q: payload.query, v: payload.variables || {} });
  let hash = 0;
  for (let i = 0; i < queryStr.length; i++) {
    hash = ((hash << 5) - hash) + queryStr.charCodeAt(i);
    hash |= 0;
  }
  const cacheKeyUrl = `https://piraty.in/api/anilist-cache/${Math.abs(hash)}`;
  const cacheKey = new Request(cacheKeyUrl, { method: 'GET' });
  const cache = caches.default;
  let response = await cache.match(cacheKey);

  if (response) {
    return response;
  }

  try {
    const upstream = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        query: payload.query,
        variables: payload.variables && typeof payload.variables === 'object' ? payload.variables : {},
      }),
    });

    const data = await upstream.text();
    const headers = new Headers();
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.set('Access-Control-Allow-Origin', '*');

    if (upstream.status === 200) {
      headers.set('Cache-Control', 'public, max-age=1800, s-maxage=1800');
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
    return new Response(JSON.stringify({ error: 'AniList request failed', details: String(err) }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

