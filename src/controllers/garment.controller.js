const Garment = require('../models/Garment');

// Convierte el documento de Mongo a la forma que espera el front (id, no _id).
function serialize(garment) {
  return {
    id: garment._id,
    name: garment.name,
    category: garment.category,
    color: garment.color,
    swatchColor: garment.swatchColor,
  };
}

// GET /api/garments — solo las prendas del usuario autenticado
async function list(req, res) {
  try {
    const garments = await Garment.find({ owner: req.userId }).sort({ createdAt: -1 });
    res.json({ garments: garments.map(serialize) });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

// POST /api/garments
async function create(req, res) {
  try {
    const { name, category, color, swatchColor } = req.body;

    if (!name || !category || !color || !swatchColor) {
      return res.status(400).json({ message: 'Nombre, categoría, color y color de muestra son obligatorios' });
    }

    const garment = await Garment.create({ owner: req.userId, name, category, color, swatchColor });
    res.status(201).json({ garment: serialize(garment) });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

// PUT /api/garments/:id
async function update(req, res) {
  try {
    const { name, category, color, swatchColor } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (color !== undefined) updates.color = color;
    if (swatchColor !== undefined) updates.swatchColor = swatchColor;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No enviaste ningún cambio' });
    }

    const garment = await Garment.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!garment) return res.status(404).json({ message: 'Prenda no encontrada' });
    res.json({ garment: serialize(garment) });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

// DELETE /api/garments/:id
async function remove(req, res) {
  try {
    const garment = await Garment.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    if (!garment) return res.status(404).json({ message: 'Prenda no encontrada' });
    res.json({ message: 'Prenda eliminada' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

module.exports = { list, create, update, remove };