// API: Subir video a GitHub (repo público tucasapicasso-media).
// Recibe stream binario, lo convierte a base64 y lo sube via GitHub Contents API.
// Límite: ~4MB (body size limit de Vercel Functions Hobby).
const ADMIN_KEY = 'picasso2026';

const GH_TOKEN = process.env.GITHUB_DATA_TOKEN;
const GH_MEDIA_REPO = process.env.GITHUB_MEDIA_REPO || 'danielspeedup2701-png/tucasapicasso-media';
const GH_MEDIA_BRANCH = process.env.GITHUB_MEDIA_BRANCH || 'main';
const CDN_BASE = `https://cdn.jsdelivr.net/gh/${GH_MEDIA_REPO}@${GH_MEDIA_BRANCH}`;

module.exports.config = {
  api: { bodyParser: false }
};

function readStream(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    const MAX = 4.2 * 1024 * 1024;
    req.on('data', (c) => {
      total += c.length;
      if (total > MAX) { reject(new Error('Archivo demasiado grande (máximo ~4MB). Comprimí el video antes de subirlo.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-filename');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.headers.authorization !== ADMIN_KEY) return res.status(401).json({ error: 'Clave incorrecta' });
  if (!GH_TOKEN) return res.status(500).json({ error: 'GITHUB_DATA_TOKEN no configurado' });

  const filename = (req.headers['x-filename'] || ('video-' + Date.now() + '.mp4')).replace(/[^a-zA-Z0-9.\-_]/g, '');
  const uniqueName = `media/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${filename}`;

  try {
    const buffer = await readStream(req);
    const base64 = buffer.toString('base64');

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
        content: base64,
        branch: GH_MEDIA_BRANCH
      })
    });
    if (!ghRes.ok) {
      const errTxt = await ghRes.text();
      return res.status(500).json({ error: 'Error al subir a GitHub', detail: errTxt.substring(0, 300) });
    }

    return res.status(200).json({ url: `${CDN_BASE}/${uniqueName}` });
  } catch (error) {
    console.error('Video upload error:', error);
    return res.status(500).json({ error: error.message || 'Error al subir video' });
  }
};
