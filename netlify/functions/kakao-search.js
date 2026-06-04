// K'HELPER — KAKAO LOCAL SEARCH PROXY
// Calls Kakao Local Search API and returns place results
// Env variable: KAKAO_REST_API_KEY (set in Netlify dashboard)

exports.handler = async function(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'Kakao API not configured', places: [] }),
    };
  }

  let query, size;
  try {
    const body = JSON.parse(event.body || '{}');
    query = (body.query || '').trim();
    size = Math.min(parseInt(body.size) || 5, 15);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!query) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query is required' }) };
  }

  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=${size}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `KakaoAK ${apiKey}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Kakao API error:', res.status, errText);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Kakao API error', places: [] }) };
    }

    const data = await res.json();
    const places = (data.documents || []).map(doc => ({
      name: doc.place_name,
      address: doc.road_address_name || doc.address_name,
      phone: doc.phone || null,
      category: doc.category_name,
      lat: parseFloat(doc.y),
      lng: parseFloat(doc.x),
      url: doc.place_url,
      query: doc.place_name,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ places, total: data.meta?.total_count || 0 }),
    };
  } catch (err) {
    console.error('Kakao search handler error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Search failed', places: [] }) };
  }
};
