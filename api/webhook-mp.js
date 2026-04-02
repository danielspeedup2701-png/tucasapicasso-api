// API: Webhook de MercadoPago — notifica WhatsApp al admin + email al comprador
const { MercadoPagoConfig, Payment } = require('mercadopago');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { type, data } = req.body || {};

    // Solo procesar pagos
    if (type !== 'payment') {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN
    });

    const payment = new Payment(client);
    const paymentData = await payment.get({ id: data.id });

    // Solo notificar pagos aprobados
    if (paymentData.status !== 'approved') {
      return res.status(200).json({ ok: true, status: paymentData.status });
    }

    // Extraer datos del pedido
    let orderData = {};
    try {
      orderData = JSON.parse(paymentData.external_reference || '{}');
    } catch (e) {
      orderData = {};
    }

    const total = paymentData.transaction_amount;
    const metodoPago = paymentData.payment_method_id || 'N/A';
    const fecha = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

    // ═══ 1. WHATSAPP AL ADMIN ═══
    const mensajeWA = [
      '\u{1F6D2} *NUEVA COMPRA CONFIRMADA*',
      '',
      '\u{1F4E6} *Producto:* ' + (orderData.producto || 'N/A'),
      '\u{1F3A8} *Color:* ' + (orderData.color || 'N/A'),
      '\u{1F522} *Cantidad:* ' + (orderData.cantidad || 1),
      '\u{1F4B0} *Total:* $' + (total ? total.toLocaleString('es-AR') : 'N/A'),
      '\u{1F4B3} *Metodo:* ' + metodoPago,
      '',
      '\u{1F464} *DATOS DEL CLIENTE*',
      '\u{1F4DD} *Nombre:* ' + (orderData.nombre || '') + ' ' + (orderData.apellido || ''),
      '\u{1F4F1} *Telefono:* ' + (orderData.telefono || 'N/A'),
      '\u{1F4E7} *Mail:* ' + (orderData.mail || 'N/A'),
      '',
      '\u{1F4CD} *DATOS DE ENVIO*',
      '\u{1F3D8} *Provincia:* ' + (orderData.provincia || 'N/A'),
      '\u{1F3D9} *Localidad:* ' + (orderData.localidad || 'N/A'),
      '\u{1F4EE} *Codigo Postal:* ' + (orderData.codigoPostal || 'N/A'),
      '\u{1F6E3} *Calle:* ' + (orderData.calle || 'N/A') + ' ' + (orderData.numeroCasa || ''),
      '\u{2194} *Entre calles:* ' + (orderData.entreCalles || 'N/A'),
      '\u{1F4CB} *Observaciones:* ' + (orderData.observaciones || 'Ninguna'),
      '',
      '\u{2705} *Estado:* PAGADO',
      '\u{1F550} *Fecha:* ' + fecha
    ].join('\n');

    const whatsappNumber = process.env.WHATSAPP_NUMBER;
    const apiKey = process.env.CALLMEBOT_API_KEY;

    if (whatsappNumber && apiKey) {
      const waUrl = 'https://api.callmebot.com/whatsapp.php?phone=' +
        encodeURIComponent(whatsappNumber) +
        '&text=' + encodeURIComponent(mensajeWA) +
        '&apikey=' + encodeURIComponent(apiKey);
      await fetch(waUrl).catch(e => console.error('WhatsApp error:', e.message));
    }

    // ═══ 2. EMAIL AL COMPRADOR ═══
    const resendKey = process.env.RESEND_API_KEY;
    const emailComprador = orderData.mail;

    if (resendKey && emailComprador) {
      const nombreCompleto = (orderData.nombre || '') + ' ' + (orderData.apellido || '');
      const emailHtml = `
        <div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:0 auto;background:#faf8f5;padding:30px;border-radius:12px;">
          <div style="text-align:center;margin-bottom:20px;">
            <h1 style="font-family:'Playfair Display',serif;color:#2d2d2d;margin:0;">Tu Casa Picasso</h1>
            <p style="color:#b8976b;margin:5px 0;">Gracias por tu compra</p>
          </div>
          <div style="background:white;border-radius:10px;padding:25px;margin:15px 0;">
            <h2 style="color:#2d2d2d;font-size:18px;margin-top:0;">Hola ${nombreCompleto}!</h2>
            <p style="color:#555;">Tu pago fue confirmado exitosamente. Estamos preparando tu pedido.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:15px 0;">
            <h3 style="color:#b8976b;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Detalle del pedido</h3>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;color:#888;">Producto</td><td style="padding:8px 0;color:#2d2d2d;text-align:right;font-weight:600;">${orderData.producto || 'N/A'}${orderData.color ? ' - ' + orderData.color : ''}</td></tr>
              <tr><td style="padding:8px 0;color:#888;">Cantidad</td><td style="padding:8px 0;color:#2d2d2d;text-align:right;">${orderData.cantidad || 1}</td></tr>
              <tr style="border-top:2px solid #b8976b;"><td style="padding:12px 0;color:#2d2d2d;font-weight:700;font-size:16px;">Total</td><td style="padding:12px 0;color:#b8976b;text-align:right;font-weight:700;font-size:18px;">$${total ? total.toLocaleString('es-AR') : 'N/A'}</td></tr>
            </table>
            <hr style="border:none;border-top:1px solid #eee;margin:15px 0;">
            <h3 style="color:#b8976b;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Direccion de envio</h3>
            <p style="color:#555;line-height:1.6;margin:5px 0;">
              ${orderData.calle || ''} ${orderData.numeroCasa || ''}<br>
              ${orderData.entreCalles ? 'Entre: ' + orderData.entreCalles + '<br>' : ''}
              ${orderData.localidad || ''}, ${orderData.provincia || ''}<br>
              CP: ${orderData.codigoPostal || ''}
              ${orderData.observaciones ? '<br>Obs: ' + orderData.observaciones : ''}
            </p>
          </div>
          <div style="text-align:center;margin-top:20px;">
            <p style="color:#888;font-size:13px;">Si tenes alguna consulta, escribinos por WhatsApp</p>
            <a href="https://wa.me/541152200306" style="display:inline-block;background:#25d366;color:white;padding:10px 25px;border-radius:25px;text-decoration:none;font-weight:600;">Contactar por WhatsApp</a>
          </div>
          <p style="text-align:center;color:#bbb;font-size:11px;margin-top:25px;">Tu Casa Picasso &mdash; Equipando hogares con estilo</p>
        </div>
      `;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + resendKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Tu Casa Picasso <onboarding@resend.dev>',
          to: emailComprador,
          subject: 'Confirmacion de compra - Tu Casa Picasso',
          html: emailHtml
        })
      }).catch(e => console.error('Email error:', e.message));
    }

    return res.status(200).json({ ok: true, status: 'notified' });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ ok: true, error: error.message });
  }
};
