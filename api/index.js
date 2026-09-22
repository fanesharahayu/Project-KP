// Vercel Serverless Function entry point.
// (server.js TIDAK memanggil app.listen saat di-require dari sini.)
//
// SEMENTARA: require dibungkus try/catch agar error init
// (mis. native module) terlihat sebagai JSON, bukan
// FUNCTION_INVOCATION_FAILED yang tanpa pesan. Hapus lagi
// setelah masalah ketemu.
module.exports = async (req, res) => {
  try {
    const app = require('../server');
    return app(req, res);
  } catch (e) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          debug_error: (e && e.message) || String(e),
          stack: ((e && e.stack) || '').split('\n').slice(0, 10)
        })
      );
    }
  }
};
