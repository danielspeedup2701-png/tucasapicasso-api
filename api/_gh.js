// Storage backend: GitHub Contents API.
// Reemplaza Vercel Blob para evitar costos. Los datos se guardan en un repo
// GitHub privado separado del repo del API (para no disparar redeploy en cada write).
//
// Env vars requeridas en Vercel:
//   GITHUB_DATA_TOKEN  - PAT con scope `repo` (classic) o `contents:write` (fine-grained)
//   GITHUB_DATA_REPO   - "owner/repo", ej: "danielspeedup2701-png/tucasapicasso-data"
//   GITHUB_DATA_BRANCH - opcional, default "main"

const GH_TOKEN  = process.env.GITHUB_DATA_TOKEN;
const GH_REPO   = process.env.GITHUB_DATA_REPO;
const GH_BRANCH = process.env.GITHUB_DATA_BRANCH || 'main';

function ghConfigured() {
  return Boolean(GH_TOKEN && GH_REPO);
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'tucasapicasso-api',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

// Lee un archivo JSON. Devuelve { sha, data } (data=null si no existe).
async function ghGet(path) {
  if (!ghConfigured()) throw new Error('GitHub storage no configurado (faltan GITHUB_DATA_TOKEN/GITHUB_DATA_REPO)');
  const url = `https://api.github.com/repos/${GH_REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(GH_BRANCH)}&t=${Date.now()}`;
  const r = await fetch(url, { headers: ghHeaders(), cache: 'no-store' });
  if (r.status === 404) return { sha: null, data: null };
  if (!r.ok) throw new Error(`GH GET ${path} ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const content = Buffer.from(j.content || '', 'base64').toString('utf8');
  let data = null;
  try { data = content ? JSON.parse(content) : null; } catch (_) { data = null; }
  return { sha: j.sha, data };
}

// Escribe un archivo JSON. Maneja creación y update. Reintenta una vez si conflict (409).
async function ghPut(path, data) {
  if (!ghConfigured()) throw new Error('GitHub storage no configurado (faltan GITHUB_DATA_TOKEN/GITHUB_DATA_REPO)');
  for (let intento = 0; intento < 3; intento++) {
    const { sha } = await ghGet(path);
    const body = {
      message: `update ${path} ${new Date().toISOString()}`,
      content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
      branch: GH_BRANCH
    };
    if (sha) body.sha = sha;
    const url = `https://api.github.com/repos/${GH_REPO}/contents/${encodeURIComponent(path)}`;
    const r = await fetch(url, {
      method: 'PUT',
      headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (r.ok) return r.json();
    if (r.status === 409 || r.status === 422) {
      // conflict — reintentar con sha fresco
      await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
      continue;
    }
    throw new Error(`GH PUT ${path} ${r.status}: ${await r.text()}`);
  }
  throw new Error(`GH PUT ${path}: conflict tras 3 reintentos`);
}

// Helpers simples: leer/guardar con default.
async function leer(path, defaultVal = null) {
  try {
    const { data } = await ghGet(path);
    return (data === null || data === undefined) ? defaultVal : data;
  } catch (e) {
    return defaultVal;
  }
}

async function guardar(path, data) {
  return ghPut(path, data);
}

module.exports = { ghConfigured, ghGet, ghPut, leer, guardar };
