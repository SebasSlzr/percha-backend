const User = require('../models/User');

// Va después de requireAuth. Consulta el rol en la base de datos en cada
// petición, en vez de confiar en el token, para que un cambio de rol
// tenga efecto de inmediato.
async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.userId).select('role');
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'No tienes permisos de administrador' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

module.exports = requireAdmin;