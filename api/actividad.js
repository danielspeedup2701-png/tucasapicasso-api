const { put, list } = require('@vercel/blob');

const ADMIN_KEY = 'picasso2026';
const BLOB_KEY = 'actividad-data.json';

async function leerActividad() {
  try {
    const { blobs } = await list({ prefix: BLOB_KEY });
    if (!blobs.length) return [];
    const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
    const res = await fetch(latest.url + '?t=' + Date.now());
    return await res.json();
  } catch (e) { return []; }
}

async function guardarActividad(lista) {
  await put(BLOB_KEY, JSON.stringify(lista), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json'
  });
}

// Buscar nombre del vendedor por codigo
async function getNombreVendedor(codigo) {
  try {
    const { blobs } = await list({ prefix: 'vendedores-data.json' });
    if (!blobs.length) return null;
    const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
    const res = await fetch(latest.url + '?t=' + Date.now());
    const lista = await res.json();
    const v = lista.find(x => x.codigo === String(codigo));
    return v ? (v.nombre + ' ' + v.apellido).trim() : null;
  } catch (e) { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — solo admin
    if (req.method === 'GET') {
      if (req.headers.authorization !== ADMIN_KEY) return res.status(401).json({ error: 'Sin autorización' });
      const lista = await leerActividad();
      return res.json({ ok: true, actividad: lista });
    }

    // POST — registrar nuevo evento
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { producto, precio, ref, compradorNombre, compradorWhatsapp } = body;

      let vendedorNombre = null;
      if (ref) vendedorNombre = await getNombreVendedor(ref);

      const evento = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        producto: producto || 'Desconocido',
        precio: precio || '',
        compradorNombre: compradorNombre || '',
        compradorWhatsapp: compradorWhatsapp || '',
        ref: ref || null,
        vendedorNombre: vendedorNombre,
        vendida: false,
        montoVenta: '',
        comentario: ''
      };
      const lista = await leerActividad();
      lista.unshift(evento);
      await guardarActividad(lista.slice(0, 500));
      return res.json({ ok: true, id: evento.id });
    }

    // PATCH — actualizar evento (marcar vendida, monto, comentario)
    if (req.method === 'PATCH') {
      if (req.headers.authorization !== ADMIN_KEY) return res.status(401).json({ error: 'Sin autorización' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { id, vendida, montoVenta, comentario } = body;
      if (!id) return res.status(400).json({ error: 'Falta id' });

      const lista = await leerActividad();
      const idx = lista.findIndex(e => String(e.id) === String(id));
      if (idx === -1) return res.status(404).json({ error: 'No encontrado' });

      if (vendida !== undefined) lista[idx].vendida = vendida;
      if (montoVenta !== undefined) lista[idx].montoVenta = montoVenta;
      if (comentario !== undefined) lista[idx].comentario = comentario;

      await guardarActividad(lista);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
