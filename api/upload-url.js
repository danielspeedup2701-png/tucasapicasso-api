// Endpoint obsoleto: Vercel Blob reemplazado por GitHub storage.
// Queda como stub para no romper llamadas viejas del frontend.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(410).json({
    error: 'Endpoint obsoleto. Usar /api/upload-media o /api/upload-video.',
    gone: true
  });
};
