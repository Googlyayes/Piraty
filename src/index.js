// Master Cloudflare Worker for PiraTY
// Handles /api/tmdb, /api/jikan, /api/anilist, and serves static assets for all other routes.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. TMDB Proxy
    if (url.pathname === '/api/tmdb' || url.pathname.startsWith('/api/tmdb')) {
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

      if (!/^\/(trending|movie|tv|search|discover|collection)(\/|\?|$)/.test(cleanEndpoint)) {
        return new Response(JSON.stringify({ error: 'Unsupported TMDB endpoint' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const defaultToken = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjMmRiYmRkZDhmZjQ3OTk5ODY1NTExZTk3M2IyMDQyZSIsIm5iZiI6MTc3ODk0OTkxMS41Nywic3ViIjoiNmEwODlmMTczMWZhYjY1NWFjM2I3OWVjIiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.C-K1QHol6eCzyMGp8R1CNztStXqrYKE_iaSPQLcYODs';
      const tmdbToken = (env && env.TMDB_READ_ACCESS_TOKEN) ? env.TMDB_READ_ACCESS_TOKEN : defaultToken;
      const targetUrl = `https://api.themoviedb.org/3${cleanEndpoint}`;

      const cacheKey = new Request(targetUrl, { method: 'GET' });
      const cache = caches.default;
      let cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
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

        if (upstream.status === 200) {
          headers.set('Cache-Control', 'public, max-age=1800, s-maxage=1800');
        } else {
          headers.set('Cache-Control', 'no-cache');
        }

        const response = new Response(data, {
          status: upstream.status,
          headers,
        });

        if (upstream.status === 200) {
          ctx.waitUntil(cache.put(cacheKey, response.clone()));
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

    // 2. Jikan Proxy
    if (url.pathname === '/api/jikan' || url.pathname.startsWith('/api/jikan')) {
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
      const cacheKey = new Request(targetUrl, { method: 'GET' });
      const cache = caches.default;
      let cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
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

        if (upstream.status === 200) {
          headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        } else {
          headers.set('Cache-Control', 'no-cache');
        }

        const response = new Response(data, {
          status: upstream.status,
          headers,
        });

        if (upstream.status === 200) {
          ctx.waitUntil(cache.put(cacheKey, response.clone()));
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

    // 3. AniList Proxy
    if (url.pathname === '/api/anilist' || url.pathname.startsWith('/api/anilist')) {
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

      try {
        const upstream = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'PiraTY/1.0',
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

        return new Response(data, {
          status: upstream.status,
          headers,
        });
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

    // 4. Default: Serve static assets
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    // For Pages Advanced Mode (_worker.js) fallback
    return fetch(request);
  },
};

