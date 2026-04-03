// API: Subir imagen/video a Vercel Blob
// También genera client tokens para upload directo de videos grandes (evita límite 4MB)
const { put } = require('@vercel/blob');
const crypto = require('crypto');

const ADMIN_KEY = 'picasso2026';

module.exports.config = {
  api: { bodyParser: { sizeLimit: '4mb' } }
};

// Genera un client token firmado con HMAC para que el browser pueda subir directo a Vercel Blob
function generateClientToken(readWriteToken, pathname) {
  const parts = readWriteToken.split('_');
  const storeId = parts[3] || '';
  if (!storeId) throw new Error('BLOB_READ_WRITE_TOKEN inválido');

  const validUntil = Date.now() + 60 * 60 * 1000; // 1 hora

  const payload = Buffer.from(JSON.stringify({
    pathname,
    allowedContentTypes: [
      'video/mp4', 'video/quicktime', 'video/webm', 'video/avi',
      'video/3gpp', 'video/x-msvideo', 'video/x-matroska',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'
    ],
    maximumSizeInBytes: 20 * 1024 * 1024,
    addRandomSuffix: false,
    validUntil
  })).toString('base64');

  const signature = crypto.createHmac('sha256', readWriteToken).update(payload).digest('hex');
  return `vercel_blob_client_${storeId}_${Buffer.from(`${signature}.${payload}`).toString('base64')}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authKey = req.headers.authorization;
  if (authKey !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Clave incorrecta' });
  }

  try {
    const body = req.body;

    // ── Modo 1: Generar client token para upload directo de video grande ──
    if (body.type === 'blob.generate-client-token') {
      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
      if (!blobToken) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN no configurado' });

      const pathname = body.payload && body.payload.pathname;
      if (!pathname) return res.status(400).json({ error: 'Falta pathname' });

      const clientToken = generateClientToken(blobToken, pathname);
      return res.json({ type: 'blob.generate-client-token', clientToken });
    }

    // ── Modo 2: Upload de imagen/video pequeño via base64 (ya funcionaba) ──
    const { fileName, contentType, data } = body;
    if (!fileName || !contentType || !data) {
      return res.status(400).json({ error: 'Faltan campos: fileName, contentType, data (base64)', v: 2 });
    }

    const base64Clean = data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    const ext = fileName.split('.').pop().toLowerCase();
    const uniqueName = 'media/' + Date.now() + '-' + Math.random().toString(36).substring(2, 7) + '.' + ext;

    const blob = await put(uniqueName, buffer, {
      access: 'public',
      contentType: contentType
    });

    const type = contentType.startsWith('video/') ? 'video' : 'image';
    return res.status(200).json({ url: blob.url, type });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Error al subir archivo', detail: error.message });
  }
};
