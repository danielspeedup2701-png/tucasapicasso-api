// API: Generar token para upload directo a Vercel Blob (cliente sin límite de body)
const { handleUpload } = require('@vercel/blob/client');

const ADMIN_KEY = 'picasso2026';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Autenticación
  const authKey = req.headers.authorization;
  if (authKey !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Clave incorrecta' });
  }

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: [
            'video/mp4', 'video/quicktime', 'video/webm', 'video/avi', 'video/mov',
            'video/3gpp', 'video/x-msvideo', 'video/x-matroska',
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'
          ],
          maximumSizeInBytes: 20 * 1024 * 1024, // 20MB
          addRandomSuffix: false,
        };
      },
    });
    return res.json(jsonResponse);
  } catch (error) {
    console.error('Upload URL error:', error);
    return res.status(500).json({ error: error.message, detail: String(error) });
  }
};
