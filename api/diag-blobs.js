const { list } = require('@vercel/blob');

const ADMIN_KEY = 'picasso2026';

// Diagnóstico temporal: lista los blobs de vendedores y actividad con preview del contenido
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.headers.authorization !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Sin autorización' });
  }

  async function inspectPrefix(prefix) {
    try {
      const { blobs } = await list({ prefix });
      const ordenados = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      const detalles = [];
      for (const blob of ordenados.slice(0, 10)) {
        let preview = null;
        let parsed = null;
        let parseErr = null;
        try {
          const r = await fetch(blob.url + '?t=' + Date.now());
          const txt = await r.text();
          preview = txt ? txt.substring(0, 300) : '(vacío)';
          try {
            const data = JSON.parse(txt);
            parsed = {
              type: Array.isArray(data) ? 'array' : typeof data,
              length: Array.isArray(data) ? data.length : (data && typeof data === 'object' ? Object.keys(data).length : null)
            };
          } catch (e) { parseErr = e.message; }
        } catch (e) { preview = 'ERR fetch: ' + e.message; }
        detalles.push({
          url: blob.url,
          pathname: blob.pathname,
          size: blob.size,
          uploadedAt: blob.uploadedAt,
          preview,
          parsed,
          parseErr
        });
      }
      return { total: blobs.length, blobs: detalles };
    } catch (e) { return { error: e.message }; }
  }

  const [vendedores, actividad] = await Promise.all([
    inspectPrefix('vendedores-data.json'),
    inspectPrefix('actividad-data.json')
  ]);

  return res.json({ ok: true, vendedores, actividad });
};
