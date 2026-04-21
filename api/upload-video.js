// api/upload-video.js — Sube video directamente a Vercel Blob via streaming
const { put } = require('@vercel/blob');

const ADMIN_KEY = 'picasso2026';

// Desactivar body parser para manejar el stream directamente
module.exports.config = {
  api: { bodyParser: false }
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-filename');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authKey = req.headers.authorization;
  if (authKey !== ADMIN_KEY) return res.status(401).json({ error: 'Clave incorrecta' });

  const filename = req.headers['x-filename'] || ('video-' + Date.now() + '.mp4');
  const contentType = req.headers['content-type'] || 'video/mp4';

  try {
    const blob = await put('media/' + filename, req, {
      access: 'public',
      contentType,
    });
    return res.status(200).json({ url: blob.url });
  } catch (error) {
    console.error('Video upload error:', error);
    return res.status(500).json({ error: 'Error al subir video', detail: error.message });
  }
};
