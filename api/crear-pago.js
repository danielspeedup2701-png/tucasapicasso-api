// API: Crear preferencia de pago en MercadoPago (REST directo, sin SDK)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      producto, color, cantidad, precio, items: carritoItems,
      nombre, apellido, provincia, localidad, codigoPostal,
      calle, numeroCasa, entreCalles, observaciones,
      telefono, mail, referido
    } = req.body;

    if (!producto || !precio || !nombre || !apellido || !mail) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    const precioNum   = parseFloat(precio);
    const cantidadNum = parseInt(cantidad) || 1;

    // Si hay ítems del carrito, armar lista múltiple para MP; si no, ítem único
    let mpItems;
    if (carritoItems && carritoItems.length > 1) {
      mpItems = carritoItems.map(function(it, idx) {
        return {
          id: 'item-' + (idx + 1),
          title: it.nombre || 'Producto',
          description: it.nombre || 'Producto',
          category_id: 'home',
          quantity: parseInt(it.qty) || 1,
          unit_price: parseFloat(it.precioNum) || 0,
          currency_id: 'ARS'
        };
      });
    } else {
      mpItems = [{
        id: 'producto-001',
        title: producto + (color ? ' - ' + color : ''),
        description: producto,
        category_id: 'home',
        quantity: cantidadNum,
        unit_price: precioNum,
        currency_id: 'ARS'
      }];
    }

    const prefBody = {
      items: mpItems,
      payer: {
        name: nombre,
        surname: apellido,
        email: mail,
        phone: {
          area_code: '54',
          number: telefono || ''
        },
        address: {
          street_name: calle || '',
          street_number: numeroCasa || '',
          zip_code: codigoPostal || ''
        }
      },
      // Datos adicionales del comprador — reducen el score de riesgo en MP
      additional_info: {
        items: mpItems.map(function(it) {
          return { id: it.id, title: it.title, description: it.description, category_id: it.category_id, quantity: it.quantity, unit_price: it.unit_price };
        }),
        payer: {
          first_name: nombre,
          last_name: apellido,
          phone: {
            area_code: '54',
            number: telefono || ''
          },
          address: {
            street_name: calle || '',
            street_number: numeroCasa || '',
            zip_code: codigoPostal || ''
          },
          registration_date: '2020-01-01T00:00:00.000-03:00',
          is_prime_user: false,
          is_first_purchase_online: false
        },
        shipments: {
          receiver_address: {
            street_name: calle || '',
            street_number: numeroCasa || '',
            zip_code: codigoPostal || '',
            city_name: localidad || '',
            state_name: provincia || ''
          }
        }
      },
      back_urls: {
        success: 'https://tucasapicasso.com.ar',
        failure: 'https://tucasapicasso.com.ar',
        pending: 'https://tucasapicasso.com.ar'
      },
      auto_return: 'approved',
      statement_descriptor: 'TUCASAPICASSO',
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 12
      },
      notification_url: 'https://tucasapicasso-api.vercel.app/api/webhook-mp',
      external_reference: JSON.stringify({
        producto, color, cantidad: cantidadNum,
        items: carritoItems || null,
        nombre, apellido, provincia, localidad, codigoPostal,
        calle, numeroCasa, entreCalles, observaciones,
        telefono, mail,
        referido: referido || 'directo'
      })
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.MP_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(prefBody)
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: 'Error MercadoPago', detail: result.message || JSON.stringify(result) });
    }

    return res.status(200).json({
      init_point: result.init_point,
      id: result.id
    });

  } catch (error) {
    console.error('Error creando preferencia:', error);
    return res.status(500).json({ error: 'Error al crear el pago', detail: error.message });
  }
};
