const { getStore } = require('@netlify/blobs');

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  let store;
  try {
    store = getStore('gym-duo');
  } catch (e) {
    return { statusCode: 503, headers: HEADERS, body: JSON.stringify({ error: 'storage_unavailable' }) };
  }

  // GET — retorna todos os dados
  if (event.httpMethod === 'GET') {
    try {
      const data = await store.get('gymDuo', { type: 'json' });
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data || {}) };
    } catch (e) {
      return { statusCode: 200, headers: HEADERS, body: '{}' };
    }
  }

  // POST — atualiza um caminho específico (evita sobrescrever dados do outro usuário)
  if (event.httpMethod === 'POST') {
    try {
      const { path, value } = JSON.parse(event.body || '{}');
      if (!path) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'path_required' }) };

      let current = {};
      try { current = (await store.get('gymDuo', { type: 'json' })) || {}; } catch (_) {}

      const keys = path.split('/').filter(Boolean);
      let obj = current;
      for (let i = 0; i < keys.length - 1; i++) {
        if (typeof obj[keys[i]] !== 'object' || !obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;

      await store.set('gymDuo', JSON.stringify(current));
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'method_not_allowed' }) };
};
