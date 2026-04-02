// API: Guardar y leer datos de productos (precios, nombres, etc.)
const { put, list, head } = require('@vercel/blob');

const BLOB_KEY = 'productos-data.json';
const ADMIN_KEY = 'picasso2026';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET: devolver datos guardados
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: BLOB_KEY });
      if (blobs.length === 0) {
        return res.status(200).json({ productos: [] });
      }
      // Usar el blob más reciente y evitar cache
      const latestBlob = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
      const response = await fetch(latestBlob.url + '?t=' + Date.now());
      const data = await response.json();
      return res.status(200).json(data);
    }

    // POST: guardar datos (requiere clave admin)
    if (req.method === 'POST') {
      const authKey = req.headers.authorization;
      if (authKey !== ADMIN_KEY) {
        return res.status(401).json({ error: 'Clave incorrecta' });
      }

      const data = req.body;
      if (!data || !data.productos) {
        return res.status(400).json({ error: 'Datos inválidos' });
      }

      await put(BLOB_KEY, JSON.stringify(data), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true
      });

      return res.status(200).json({ ok: true, saved: data.productos.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Productos API error:', error);
    return res.status(500).json({ error: error.message });
  }
};
