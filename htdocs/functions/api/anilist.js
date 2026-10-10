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

