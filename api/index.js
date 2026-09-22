// Vercel Serverless Function entry point.
// Express app adalah handler (req, res) yang valid, jadi cukup diekspor.
// (server.js TIDAK memanggil app.listen saat di-require dari sini.)
const app = require('../server');

module.exports = app;
