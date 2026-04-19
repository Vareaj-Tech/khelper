exports.handler = async function(event, context) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const keyConfigured = !!(apiKey && apiKey.length > 10);
  let anthropicReachable = false;
  if (keyConfigured) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
      });
      anthropicReachable = res.status !== 401 && res.status !== 403;
    } catch (e) { anthropicReachable = false; }
  }
  const status = keyConfigured && anthropicReachable ? 'ok' : 'down';
  return {
    statusCode: status === 'ok' ? 200 : 503, headers,
    body: JSON.stringify({ status, service: "K'Helper", timestamp: new Date().toISOString(),
      checks: { api_key_configured: keyConfigured, anthropic_reachable: anthropicReachable } }),
  };
};
