// Minimal client for the OpenRouter provisioning API (management key, not a normal key).
// Used by mint-keys.mjs and revoke-keys.mjs on a speaker laptop. Never by the dispenser.

const DEFAULT_BASE = 'https://openrouter.ai/api/v1';

export function createClient({ baseUrl, managementKey } = {}) {
  const base = (baseUrl ?? process.env.WORKSHOP_OPENROUTER_API ?? DEFAULT_BASE).replace(/\/$/, '');
  if (!managementKey) throw new Error('createClient: managementKey is required');
  const headers = { authorization: `Bearer ${managementKey}`, 'content-type': 'application/json' };

  async function call(method, route, body) {
    const res = await fetch(`${base}${route}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`OpenRouter ${method} ${route} failed: HTTP ${res.status}`);
    return json;
  }

  return {
    async createKey({ name, limit, expiresAt }) {
      const json = await call('POST', '/keys', { name, limit, expires_at: expiresAt });
      if (!json?.key || !json?.data?.hash) throw new Error('OpenRouter POST /keys: unexpected response shape');
      return { key: json.key, hash: json.data.hash };
    },
    async disableKey(hash) {
      await call('PATCH', `/keys/${encodeURIComponent(hash)}`, { disabled: true });
    },
  };
}
