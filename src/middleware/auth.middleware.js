const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Revisa el header "Authorization: Bearer <token>" y que la cuenta siga existiendo.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No hay token, acceso denegado' });
  }

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const exists = await User.exists({ _id: decoded.userId });
    if (!exists) return res.status(401).json({ message: 'La cuenta ya no existe' });

    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

module.exports = requireAuth;