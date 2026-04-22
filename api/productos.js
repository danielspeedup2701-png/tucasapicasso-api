// API: Guardar y leer datos de productos (precios, nombres, etc.)
// Storage: GitHub (reemplaza Vercel Blob).
const { leer, guardar } = require('./_gh');

const DATA_PATH = 'productos-data.json';
const ADMIN_KEY = 'picasso2026';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const data = await leer(DATA_PATH, { productos: [] });
      if (Array.isArray(data)) return res.status(200).json({ productos: data });
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      if (req.headers.authorization !== ADMIN_KEY) {
        return res.status(401).json({ error: 'Clave incorrecta' });
      }
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!data || !data.productos) {
        return res.status(400).json({ error: 'Datos inválidos' });
      }
      await guardar(DATA_PATH, data);
      return res.status(200).json({ ok: true, saved: data.productos.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Productos API error:', error);
    return res.status(500).json({ error: error.message });
  }
};
