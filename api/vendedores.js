// API: Vendedores referidos.
// Storage: GitHub (reemplaza Vercel Blob).
const { leer, guardar } = require('./_gh');

const ADMIN_KEY = 'picasso2026';
const DATA_PATH = 'vendedores-data.json';
const CODIGO_BASE = 119; // primer nuevo vendedor queda con código 120

async function leerVendedores() {
  const data = await leer(DATA_PATH, []);
  return Array.isArray(data) ? data : [];
}

async function guardarVendedores(lista) {
  return guardar(DATA_PATH, lista);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const lista = await leerVendedores();
      const waQuery = (req.query && req.query.wa) ? String(req.query.wa).replace(/\D/g,'') : null;
      if (waQuery) {
        const encontrado = lista.find(v => String(v.whatsapp).replace(/\D/g,'') === waQuery);
        if (encontrado) {
          return res.json({ ok: true, codigo: encontrado.codigo, link: encontrado.link, nombre: encontrado.nombre });
        }
        return res.json({ ok: false, error: 'No encontrado' });
      }
      if (req.headers.authorization === ADMIN_KEY) {
        return res.json({ ok: true, vendedores: lista });
      }
      return res.json({ ok: true, total: lista.length });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { nombre, apellido, whatsapp } = body;
      if (!nombre || !apellido) return res.status(400).json({ error: 'Faltan nombre y apellido' });

      const lista = await leerVendedores();

      if (whatsapp) {
        const waNorm = String(whatsapp).replace(/\D/g, '');
        const existente = lista.find(v => String(v.whatsapp).replace(/\D/g, '') === waNorm);
        if (existente) {
          return res.json({
            ok: true,
            yaRegistrado: true,
            codigo: existente.codigo,
            link: existente.link,
            nombre: existente.nombre,
            apellido: existente.apellido
          });
        }
      }

      const maxCod = lista.reduce((max, v) => Math.max(max, parseInt(v.codigo) || 0), CODIGO_BASE);
      const codigo = String(maxCod + 1);

      const nuevo = {
        id: Date.now(),
        nombre,
        apellido,
        whatsapp: whatsapp || '',
        codigo,
        link: `https://tucasapicasso.com.ar?ref=${codigo}`,
        fechaRegistro: new Date().toISOString(),
        activo: true
      };

      lista.push(nuevo);
      await guardarVendedores(lista);
      return res.json({ ok: true, yaRegistrado: false, codigo, link: nuevo.link });
    }

    if (req.method === 'DELETE') {
      if (req.headers.authorization !== ADMIN_KEY) return res.status(401).json({ error: 'Sin autorización' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { codigo } = body;
      if (!codigo) return res.status(400).json({ error: 'Falta código' });
      const lista = await leerVendedores();
      await guardarVendedores(lista.filter(v => v.codigo !== codigo));
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
