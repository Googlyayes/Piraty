// Cloudflare Pages Function: /api/tmdb
// Proxies TMDB API requests with edge caching and secure token handling.

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight if called cross-origin, or standard methods
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

  // Ensure leading slash and security check against allowed TMDB root paths
  let cleanEndpoint = endpoint.trim();
  if (!cleanEndpoint.startsWith('/')) {
    cleanEndpoint = '/' + cleanEndpoint;
  }

  if (!/^\/(trending|movie|tv|search|discover|collection)(\/|\?|$)/.test(cleanEndpoint)) {
    return new Response(JSON.stringify({ error: 'Unsupported TMDB endpoint' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fallback token: uses env.TMDB_READ_ACCESS_TOKEN if configured, else default token
  const defaultToken = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjMmRiYmRkZDhmZjQ3OTk5ODY1NTExZTk3M2IyMDQyZSIsIm5iZiI6MTc3ODk0OTkxMS41Nywic3ViIjoiNmEwODlmMTczMWZhYjY1NWFjM2I3OWVjIiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.C-K1QHol6eCzyMGp8R1CNztStXqrYKE_iaSPQLcYODs';
  const tmdbToken = (env && env.TMDB_READ_ACCESS_TOKEN) ? env.TMDB_READ_ACCESS_TOKEN : defaultToken;

  const targetUrl = `https://api.themoviedb.org/3${cleanEndpoint}`;

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
        'Authorization': `Bearer ${tmdbToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    const data = await upstream.text();
    const headers = new Headers();
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.set('Access-Control-Allow-Origin', '*');

    // Cache successful catalog/search responses for 30 minutes at Cloudflare Edge
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
    return new Response(JSON.stringify({ error: 'TMDB request failed', details: String(err) }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

