// API: Subir imagen/video a GitHub (repo público tucasapicasso-media).
// Reemplaza Vercel Blob para uploads de media. Gratis, sirve via jsdelivr CDN.
// Límite práctico: 4.5MB body de Vercel Functions. Para imágenes y videos cortos alcanza.
const ADMIN_KEY = 'picasso2026';

const GH_TOKEN = process.env.GITHUB_DATA_TOKEN;
const GH_MEDIA_REPO = process.env.GITHUB_MEDIA_REPO || 'danielspeedup2701-png/tucasapicasso-media';
const GH_MEDIA_BRANCH = process.env.GITHUB_MEDIA_BRANCH || 'main';
// CDN más rápido que raw.githubusercontent.com
const CDN_BASE = `https://cdn.jsdelivr.net/gh/${GH_MEDIA_REPO}@${GH_MEDIA_BRANCH}`;

module.exports.config = {
  api: { bodyParser: { sizeLimit: '4mb' } }
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.headers.authorization !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Clave incorrecta' });
  }
  if (!GH_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_DATA_TOKEN no configurado' });
  }

  try {
    const body = req.body;
    const { fileName, contentType, data } = body || {};
    if (!fileName || !contentType || !data) {
      return res.status(400).json({ error: 'Faltan campos: fileName, contentType, data (base64)' });
    }

    const base64Clean = String(data).replace(/^data:[^;]+;base64,/, '');
    // Validar tamaño (4MB base64 ≈ 3MB binary)
    if (base64Clean.length > 5.5 * 1024 * 1024) {
      return res.status(413).json({ error: 'Archivo demasiado grande (máximo ~3MB). Comprimí la imagen/video antes de subirla.' });
    }

    // Generar path único
    const ext = (fileName.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const uniqueName = `media/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    // Subir a GitHub
    const ghUrl = `https://api.github.com/repos/${GH_MEDIA_REPO}/contents/${encodeURIComponent(uniqueName)}`;
    const ghRes = await fetch(ghUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'tucasapicasso-api'
      },
      body: JSON.stringify({
        message: `upload ${uniqueName}`,
        content: base64Clean,
        branch: GH_MEDIA_BRANCH
      })
    });

    if (!ghRes.ok) {
      const errTxt = await ghRes.text();
      return res.status(500).json({ error: 'Error al subir a GitHub', detail: errTxt.substring(0, 300) });
    }

    const url = `${CDN_BASE}/${uniqueName}`;
    const type = contentType.startsWith('video/') ? 'video' : 'image';
    return res.status(200).json({ url, type });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Error al subir archivo', detail: error.message });
  }
};
