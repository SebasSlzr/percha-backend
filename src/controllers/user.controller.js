const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Garment = require('../models/Garment');
const Outfit = require('../models/Outfit');
const { deleteUserImages } = require('../config/cloudinary');
const WishlistItem = require('../models/WishlistItem');

function serialize(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    wishlistReminders: user.wishlistReminders ?? true,
  };
}

// GET /api/users/me
async function getMe(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json({ user: serialize(user) });
}

// PUT /api/users/me — solo actualiza lo que venga en el body
async function updateMe(req, res) {
  try {
    const { name, email, password, wishlistReminders } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: 'El nombre no puede estar vacío' });
      updates.name = name.trim();
    }

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: req.userId } });
      if (existing) return res.status(409).json({ message: 'Ya existe una cuenta con ese email' });
      updates.email = normalizedEmail;
    }

    if (password !== undefined) {
      if (password.length < 8) return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
      if (password.length > 72) return res.status(400).json({ message: 'La contraseña no puede superar 72 caracteres' });
      updates.password = await bcrypt.hash(password, 10);
    }

        if (wishlistReminders !== undefined) {
      if (typeof wishlistReminders !== 'boolean') {
        return res.status(400).json({ message: 'wishlistReminders debe ser verdadero o falso' });
      }
      updates.wishlistReminders = wishlistReminders;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No enviaste ningún cambio' });
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true, runValidators: true });
    res.json({ user: serialize(user) });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

// DELETE /api/users/me — borra la cuenta y todo lo que le pertenece
async function deleteMe(req, res) {
  try {
    await deleteUserImages(req.userId);   // nueva línea
    await Garment.deleteMany({ owner: req.userId });
    await Outfit.deleteMany({ owner: req.userId });
    await WishlistItem.deleteMany({ owner: req.userId });
    await User.findByIdAndDelete(req.userId);
    res.json({ message: 'Cuenta eliminada' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

// PUT /api/users/me/push-token  { token: "ExponentPushToken[...]" | null }
// Un teléfono por cuenta: si ese token estaba en otra cuenta (otra persona inició
// sesión en el mismo teléfono), se le quita a esa cuenta. Con null se borra (cierre de sesión).
const PUSH_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

async function savePushToken(req, res) {
  try {
    const { token } = req.body;
    if (token !== null && (typeof token !== 'string' || !PUSH_TOKEN.test(token))) {
      return res.status(400).json({ message: 'Token de notificaciones no válido' });
    }
    if (token) {
      await User.updateMany({ pushToken: token, _id: { $ne: req.userId } }, { pushToken: null });
    }
    await User.updateOne({ _id: req.userId }, { pushToken: token });
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

module.exports = { getMe, updateMe, deleteMe, savePushToken };