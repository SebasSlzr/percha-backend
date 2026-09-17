const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Garment = require('../models/Garment');
const Outfit = require('../models/Outfit');

function serialize(user) {
  return { id: user._id, name: user.name, email: user.email };
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
    const { name, email, password } = req.body;
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
    await Garment.deleteMany({ owner: req.userId });
    await Outfit.deleteMany({ owner: req.userId });
    await User.findByIdAndDelete(req.userId);
    res.json({ message: 'Cuenta eliminada' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

module.exports = { getMe, updateMe, deleteMe };