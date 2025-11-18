// js/utils/api.js
function buildUrl(path) {
  // path peut être "api/login" ou "/api/login" → on unifie
  const clean = String(path).replace(/^\//, ''); // retire le leading slash

  // détecte le contexte à partir de l'URL courante
  // ex: /casino-backend/  -> base = /casino-backend
  //     /                 -> base = ""
  const parts = window.location.pathname.split('/').filter(Boolean);
  const base = parts.length > 0 ? `/${parts[0]}` : '';

  return `${base}/${clean}`;
}

export async function api(path, { method = 'GET', body } = {}) {
  const url = buildUrl(path); // construit l'URL avec le contexte
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  });
  let data = null;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const err = new Error(data.error || 'http_error');
    err.status = res.status;
    throw err;
  }
  return data;
}
