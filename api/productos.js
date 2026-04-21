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
      // Ordenar por fecha descendente y probar cada blob hasta encontrar uno válido
      const ordenados = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      for (const blob of ordenados) {
        try {
          const response = await fetch(blob.url + '?t=' + Date.now());
          const txt = await response.text();
          // Validar que sea JSON y tenga la estructura esperada
          if (!txt || txt.trim().charAt(0) !== '{' && txt.trim().charAt(0) !== '[') continue;
          const data = JSON.parse(txt);
          if (data && (Array.isArray(data.productos) || Array.isArray(data))) {
            return res.status(200).json(data);
          }
        } catch (e) {
          // Blob corrupto: intentar el siguiente
          continue;
        }
      }
      // Ningún blob válido — devolver vacío en lugar de error para no romper la web
      return res.status(200).json({ productos: [], warning: 'Blob corrupto o sin datos válidos' });
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
