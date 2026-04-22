// API: Registro de actividad (pedidos, ventas concretadas, comisiones).
// Storage: GitHub (reemplaza Vercel Blob).
const { leer, guardar } = require('./_gh');

const ADMIN_KEY = 'picasso2026';
const DATA_PATH = 'actividad-data.json';
const VENDEDORES_PATH = 'vendedores-data.json';

async function leerActividad() {
  const data = await leer(DATA_PATH, []);
  return Array.isArray(data) ? data : [];
}

async function guardarActividad(lista) {
  return guardar(DATA_PATH, lista);
}

async function getVendedor(codigo) {
  try {
    const lista = await leer(VENDEDORES_PATH, []);
    if (!Array.isArray(lista)) return null;
    return lista.find(x => String(x.codigo) === String(codigo)) || null;
  } catch (e) { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      if (req.headers.authorization !== ADMIN_KEY) return res.status(401).json({ error: 'Sin autorización' });
      const lista = await leerActividad();
      return res.json({ ok: true, actividad: lista });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { producto, precio, ref, compradorNombre, compradorWhatsapp, items, metodoPago } = body;

      let precioNum = 0;
      if (items && items.length > 0) {
        precioNum = items.reduce((s, i) => s + (parseInt(i.precioNum) || 0) * (parseInt(i.qty) || 1), 0);
      } else {
        precioNum = parseInt(String(precio || '').replace(/[^0-9]/g, ''), 10) || 0;
      }

      // Precio base (lo que ingresa el admin) = precio transferencia.
      // Tarjeta tiene 25% de recargo. Comisión vendedor = 20% del precio transferencia.
      const precioTransferencia = precioNum;
      const precioTarjeta       = precioNum > 0 ? Math.round(precioNum * 1.25) : 0;
      const comisionVendedor    = precioTransferencia > 0 ? Math.round(precioTransferencia * 0.20) : 0;

      let vendedorNombre = null;
      let vendedorWhatsapp = null;
      if (ref) {
        const v = await getVendedor(ref);
        if (v) {
          vendedorNombre   = ((v.nombre || '') + ' ' + (v.apellido || '')).trim();
          vendedorWhatsapp = String(v.whatsapp || '').replace(/\D/g, '');
        }
      }

      const precioTexto = precioNum > 0 ? '$' + precioNum.toLocaleString('es-AR') : (precio || '');

      const evento = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        producto: producto || 'Desconocido',
        precio: precioTexto,
        items: items || null,
        precioTarjeta,
        precioTransferencia,
        comisionVendedor,
        metodoPago: metodoPago || null,
        compradorNombre: compradorNombre || '',
        compradorWhatsapp: compradorWhatsapp || '',
        ref: ref || null,
        vendedorNombre,
        vendedorWhatsapp,
        vendida: false,
        comisionPagada: false,
        montoVenta: '',
        comentario: ''
      };
      const lista = await leerActividad();
      lista.unshift(evento);
      await guardarActividad(lista.slice(0, 500));
      return res.json({ ok: true, id: evento.id });
    }

    if (req.method === 'PATCH') {
      if (req.headers.authorization !== ADMIN_KEY) return res.status(401).json({ error: 'Sin autorización' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { id, vendida, montoVenta, comentario, compradorWhatsapp, comisionPagada } = body;
      if (!id) return res.status(400).json({ error: 'Falta id' });

      const lista = await leerActividad();
      const idx = lista.findIndex(e => String(e.id) === String(id));
      if (idx === -1) return res.status(404).json({ error: 'No encontrado' });

      if (vendida !== undefined)           lista[idx].vendida = vendida;
      if (montoVenta !== undefined)        lista[idx].montoVenta = montoVenta;
      if (comentario !== undefined)        lista[idx].comentario = comentario;
      if (compradorWhatsapp !== undefined) lista[idx].compradorWhatsapp = compradorWhatsapp;
      if (comisionPagada !== undefined)    lista[idx].comisionPagada = comisionPagada;

      await guardarActividad(lista);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
