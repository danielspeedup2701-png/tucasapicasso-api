// API: Generar client token para upload directo a Vercel Blob
// Replicamos la lógica de @vercel/blob/client sin importarlo (falla en Vercel build)
const crypto = require('crypto');

const ADMIN_KEY = 'picasso2026';

function generateClientToken(readWriteToken, options) {
  // Extraer storeId del token (formato: vercel_blob_rw_XXXXX_storeid...)
  const parts = readWriteToken.split('_');
  const storeId = parts[3] || '';

  if (!storeId) {
    throw new Error('BLOB_READ_WRITE_TOKEN inválido: no se encontró storeId');
  }

  // Validez de 1 hora
  const validUntil = Date.now() + 60 * 60 * 1000;

  const payload = Buffer.from(JSON.stringify({
    pathname: options.pathname,
    allowedContentTypes: options.allowedContentTypes,
    maximumSizeInBytes: options.maximumSizeInBytes,
    addRandomSuffix: options.addRandomSuffix !== undefined ? options.addRandomSuffix : false,
    validUntil: validUntil
  })).toString('base64');

  // Firmar con HMAC-SHA256
  const signature = crypto
    .createHmac('sha256', readWriteToken)
    .update(payload)
    .digest('hex');

  return `vercel_blob_client_${storeId}_${Buffer.from(`${signature}.${payload}`).toString('base64')}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Autenticación admin
  const authKey = req.headers.authorization;
  if (authKey !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Clave incorrecta' });
  }

  try {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN no configurado en el servidor' });
    }

    const { payload } = req.body;
    if (!payload || !payload.pathname) {
      return res.status(400).json({ error: 'Falta pathname en el payload' });
    }

    const clientToken = generateClientToken(blobToken, {
      pathname: payload.pathname,
      allowedContentTypes: [
        'video/mp4', 'video/quicktime', 'video/webm', 'video/avi', 'video/mov',
        'video/3gpp', 'video/x-msvideo', 'video/x-matroska',
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'
      ],
      maximumSizeInBytes: 20 * 1024 * 1024, // 20MB
      addRandomSuffix: false
    });

    return res.json({
      type: 'blob.generate-client-token',
      clientToken: clientToken
    });

  } catch (error) {
    console.error('Upload URL error:', error);
    return res.status(500).json({ error: error.message });
  }
};
