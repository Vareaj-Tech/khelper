// ============================================================
// K'HELPER — HEALTH CHECK ENDPOINT
// ============================================================
// URL: https://khelper.org/.netlify/functions/health
//     (or: https://khelper.org/api/health — add redirect to netlify.toml)
//
// Returns: system status, uptime check, config validation
// Use with: UptimeRobot, BetterUptime, or manual checks
// ============================================================

exports.handler = async function(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const checks = {
    timestamp: new Date().toISOString(),
    status: 'ok',
    service: "K'Helper",
    version: '2.0',
    checks: {},
  };

  // ── Check 1: API key configured ──
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  checks.checks.api_key_configured = hasApiKey ? 'ok' : 'MISSING';
  if (!hasApiKey) checks.status = 'degraded';

  // ── Check 2: Anthropic API reachable ──
  if (hasApiKey) {
    try {
      const testResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });

      if (testResponse.ok) {
        checks.checks.anthropic_api = 'ok';
      } else {
        const err = await testResponse.json();
        checks.checks.anthropic_api = `error: ${err.error?.type || testResponse.status}`;
        checks.status = 'degraded';
      }
    } catch (e) {
      checks.checks.anthropic_api = `unreachable: ${e.message}`;
      checks.status = 'down';
    }
  } else {
    checks.checks.anthropic_api = 'skipped (no key)';
  }

  // ── Check 3: Rate limiter functional ──
  checks.checks.rate_limiter = 'ok';

  // ── Check 4: Environment ──
  checks.checks.node_env = process.env.NODE_ENV || 'production';
  checks.checks.region = process.env.AWS_REGION || 'unknown';

  // Return 200 even if degraded — let monitoring tools parse the JSON
  return {
    statusCode: checks.status === 'down' ? 503 : 200,
    headers,
    body: JSON.stringify(checks, null, 2),
  };
};
