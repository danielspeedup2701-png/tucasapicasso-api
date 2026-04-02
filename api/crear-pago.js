// API: Crear preferencia de pago en MercadoPago (REST directo, sin SDK)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      producto, color, cantidad, precio,
      nombre, apellido, provincia, localidad, codigoPostal,
      calle, numeroCasa, entreCalles, observaciones,
      telefono, mail
    } = req.body;

    if (!producto || !cantidad || !precio || !nombre || !apellido || !mail) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    const precioNum = parseFloat(precio);
    const cantidadNum = parseInt(cantidad);

    const prefBody = {
      items: [{
        title: producto + (color ? ' - ' + color : ''),
        quantity: cantidadNum,
        unit_price: precioNum,
        currency_id: 'ARS'
      }],
      payer: {
        name: nombre,
        surname: apellido,
        email: mail
      },
      back_urls: {
        success: 'https://tucasapicasso.com.ar',
        failure: 'https://tucasapicasso.com.ar',
        pending: 'https://tucasapicasso.com.ar'
      },
      auto_return: 'approved',
      binary_mode: true,
      statement_descriptor: 'TUCASAPICASSO',
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 12
      },
      notification_url: 'https://tucasapicasso-api.vercel.app/api/webhook-mp',
      external_reference: JSON.stringify({
        producto, color, cantidad: cantidadNum,
        nombre, apellido, provincia, localidad, codigoPostal,
        calle, numeroCasa, entreCalles, observaciones,
        telefono, mail
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
