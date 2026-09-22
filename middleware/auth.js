function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Silakan login terlebih dahulu' });
  }
  next();
}

function requireRole(...roles) {
  return function (req, res, next) {
    requireAuth(req, res, () => {
      if (!roles.includes(req.session.user.role)) {
        return res.status(403).json({ error: 'Anda tidak memiliki akses' });
      }
      next();
    });
  };
}

module.exports = { requireAuth, requireRole };