const mongoose = require('mongoose');
const User = require('../models/User');
const Garment = require('../models/Garment');
const Outfit = require('../models/Outfit');
const { deleteUserImages } = require('../config/cloudinary');
const WishlistItem = require('../models/WishlistItem');
const { serialize: serializeGarment } = require('./garment.controller');
const { serialize: serializeOutfit } = require('./outfit.controller');
const { runWishlistReminders } = require('../jobs/wishlistReminders');

// Convierte [{ _id: idDelDueño, count }] en un mapa idDelDueño -> count.
function toCountMap(rows) {
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

// GET /api/admin/users — todos los usuarios, con cuántas prendas y outfits tiene cada uno
async function list(req, res) {
  try {
    const [users, garmentRows, outfitRows] = await Promise.all([
      User.find().sort({ createdAt: -1 }),
      Garment.aggregate([{ $group: { _id: '$owner', count: { $sum: 1 } } }]),
      Outfit.aggregate([{ $group: { _id: '$owner', count: { $sum: 1 } } }]),
    ]);

    const garmentCounts = toCountMap(garmentRows);
    const outfitCounts = toCountMap(outfitRows);

    res.json({
      users: users.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        garmentCount: garmentCounts.get(String(user._id)) ?? 0,
        outfitCount: outfitCounts.get(String(user._id)) ?? 0,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

// DELETE /api/admin/users/:id — borra al usuario y todo lo que le pertenece
async function remove(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Id de usuario inválido' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Un admin no se puede borrar a sí mismo ni a otro admin desde el panel.
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'No se puede eliminar a un administrador' });
    }
    await deleteUserImages(id);  // nueva línea
    await Garment.deleteMany({ owner: id });
    await Outfit.deleteMany({ owner: id });
    await WishlistItem.deleteMany({ owner: id });   
    await User.findByIdAndDelete(id);      
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

// GET /api/admin/users/:id/wardrobe — prendas y outfits de un usuario, en solo lectura.
// Solo administradores (el router ya aplica requireAuth y requireAdmin).
async function wardrobe(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ message: 'Usuario no encontrado' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const [garments, outfits] = await Promise.all([
      Garment.find({ owner: id }).sort({ createdAt: -1 }),
      Outfit.find({ owner: id }).sort({ createdAt: -1 }).populate('head torso legs feet'),
    ]);

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        wishlistReminders: user.wishlistReminders ?? true,
        garmentCount: garments.length,
        outfitCount: outfits.length,
      },
      garments: garments.map(serializeGarment),
      outfits: outfits.map(serializeOutfit),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

// POST /api/admin/reminders/run: ejecuta el job ya, con las mismas reglas.
async function runReminders(req, res) {
  const sent = await runWishlistReminders();
  res.json({ sent });
}

module.exports = { list, remove, wardrobe, runReminders };