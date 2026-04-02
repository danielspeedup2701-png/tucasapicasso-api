// API: Subir imagen/video a Vercel Blob
const { put } = require('@vercel/blob');

const ADMIN_KEY = 'picasso2026';

// Desactivar body parser de Vercel para manejar archivos grandes
module.exports.config = {
  api: { bodyParser: { sizeLimit: '4mb' } }
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth
  const authKey = req.headers.authorization;
  if (authKey !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Clave incorrecta' });
  }

  try {
    const { fileName, contentType, data } = req.body;

    if (!fileName || !contentType || !data) {
      return res.status(400).json({ error: 'Faltan campos: fileName, contentType, data (base64)' });
    }

    // Decodificar base64
    const base64Clean = data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    // Generar nombre único
    const ext = fileName.split('.').pop().toLowerCase();
    const uniqueName = 'media/' + Date.now() + '-' + Math.random().toString(36).substring(2, 7) + '.' + ext;

    // Subir a Vercel Blob
    const blob = await put(uniqueName, buffer, {
      access: 'public',
      contentType: contentType
    });

    // Determinar tipo
    const type = contentType.startsWith('video/') ? 'video' : 'image';

    return res.status(200).json({
      url: blob.url,
      type: type
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Error al subir archivo', detail: error.message });
  }
};
