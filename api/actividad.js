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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
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
      const { producto, precio, ref, compradorNombre, compradorWhatsapp, items, metodoPago,
              totalCostoA, totalComision, totalGananciaEmpresa } = body;

      let precioNum = 0;
      if (items && items.length > 0) {
        precioNum = items.reduce((s, i) => s + (parseInt(i.precioNum) || 0) * (parseInt(i.qty) || 1), 0);
      } else {
        precioNum = parseInt(String(precio || '').replace(/[^0-9]/g, ''), 10) || 0;
      }

      // Modelo A→E: si los items vienen enriquecidos (con costoA/publicoC/tarjetaD), usarlos.
      // Si no, fallback al modelo viejo (precioNum = transferencia).
      let precioTransferencia, precioTarjeta, comisionVendedor;
      if (items && items.length > 0 && items[0].publicoC !== undefined) {
        precioTransferencia = items.reduce((s, i) => s + (parseInt(i.publicoC) || 0) * (parseInt(i.qty) || 1), 0);
        precioTarjeta       = items.reduce((s, i) => s + (parseInt(i.tarjetaD) || 0) * (parseInt(i.qty) || 1), 0);
        comisionVendedor    = parseInt(totalComision) || items.reduce((s, i) => s + (parseInt(i.comisionTotal) || 0), 0);
      } else {
        precioTransferencia = precioNum;
        precioTarjeta       = precioNum > 0 ? Math.round(precioNum * 1.25) : 0;
        comisionVendedor    = precioTransferencia > 0 ? Math.round(precioTransferencia * 0.20) : 0;
      }

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
        // Modelo A→E (nuevos campos para visibilidad interna del admin)
        totalCostoA: parseInt(totalCostoA) || 0,
        totalComision: parseInt(totalComision) || comisionVendedor || 0,
        totalGananciaEmpresa: parseInt(totalGananciaEmpresa) || 0,
        metodoPago: metodoPago || null,
        compradorNombre: compradorNombre || '',
        compradorWhatsapp: compradorWhatsapp || '',
        ref: ref || null,
        vendedorNombre,
        vendedorWhatsapp,
        // Estado de operación: 'pendiente' (abierta), 'pagada' (cerrada/concretada), 'cancelada'
        estado: 'pendiente',
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
      const { id, vendida, montoVenta, comentario, compradorWhatsapp, comisionPagada, estado, metodoPago, precioTransferencia } = body;
      if (!id) return res.status(400).json({ error: 'Falta id' });

      const lista = await leerActividad();
      const idx = lista.findIndex(e => String(e.id) === String(id));
      if (idx === -1) return res.status(404).json({ error: 'No encontrado' });

      if (vendida !== undefined)           lista[idx].vendida = vendida;
      if (montoVenta !== undefined)        lista[idx].montoVenta = montoVenta;
      if (comentario !== undefined)        lista[idx].comentario = comentario;
      if (compradorWhatsapp !== undefined) lista[idx].compradorWhatsapp = compradorWhatsapp;
      if (comisionPagada !== undefined)    lista[idx].comisionPagada = comisionPagada;
      if (metodoPago !== undefined)        lista[idx].metodoPago = metodoPago;

      // Editar monto de transferencia (recalcula tarjeta +25% y comisión 20%)
      if (precioTransferencia !== undefined) {
        const n = parseInt(String(precioTransferencia).replace(/[^0-9]/g,''),10) || 0;
        lista[idx].precioTransferencia = n;
        lista[idx].precioTarjeta       = n > 0 ? Math.round(n * 1.25) : 0;
        lista[idx].comisionVendedor    = n > 0 ? Math.round(n * 0.20) : 0;
        lista[idx].precio              = n > 0 ? '$' + n.toLocaleString('es-AR') : lista[idx].precio;
      }

      // Estado de la operación: 'pendiente' | 'pagada' | 'cancelada'
      if (estado !== undefined) {
        if (estado === 'pagada')   { lista[idx].estado = 'pagada';   lista[idx].vendida = true;  }
        else if (estado === 'cancelada') { lista[idx].estado = 'cancelada'; lista[idx].vendida = false; lista[idx].comisionPagada = false; }
        else                       { lista[idx].estado = 'pendiente'; lista[idx].vendida = false; }
      }

      await guardarActividad(lista);
      return res.json({ ok: true, evento: lista[idx] });
    }

    if (req.method === 'DELETE') {
      if (req.headers.authorization !== ADMIN_KEY) return res.status(401).json({ error: 'Sin autorización' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'Falta id' });
      const lista = await leerActividad();
      const filtered = lista.filter(e => String(e.id) !== String(id));
      if (filtered.length === lista.length) return res.status(404).json({ error: 'No encontrado' });
      await guardarActividad(filtered);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
