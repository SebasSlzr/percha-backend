const mongoose = require('mongoose');
const Garment = require('../models/Garment');
const { validateImage, deleteImage } = require('../config/cloudinary');

function serialize(garment) {
  return {
    id: garment._id,
    name: garment.name,
    category: garment.category,
    color: garment.color,
    swatchColor: garment.swatchColor,
    imageUrl: garment.imageUrl ?? null,
    imagePublicId: garment.imagePublicId ?? null,
    isFavorite: !!garment.isFavorite,
  };
}

const serverError = (res, error) =>
  res.status(500).json({ message: 'Error en el servidor', error: error.message });

// GET /api/garments
async function list(req, res) {
  try {
    const garments = await Garment.find({ owner: req.userId }).sort({ createdAt: -1 });
    res.json({ garments: garments.map(serialize) });
  } catch (error) {
    serverError(res, error);
  }
}

// POST /api/garments
async function create(req, res) {
  try {
    const { name, category, color, swatchColor, imageUrl, imagePublicId } = req.body;

    if (!name || !category || !color || !swatchColor) {
      return res.status(400).json({ message: 'Nombre, categoría, color y color de muestra son obligatorios' });
    }

    const imageError = validateImage({ imageUrl, imagePublicId }, req.userId);
    if (imageError) return res.status(400).json({ message: imageError });

    const garment = await Garment.create({
      owner: req.userId,
      name,
      category,
      color,
      swatchColor,
      imageUrl: imageUrl || null,
      imagePublicId: imagePublicId || null,
    });
    res.status(201).json({ garment: serialize(garment) });
  } catch (error) {
    serverError(res, error);
  }
}

// PUT /api/garments/:id (solo aplica los campos que lleguen)
async function update(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Prenda no encontrada' });
    }

    const garment = await Garment.findOne({ _id: req.params.id, owner: req.userId });
    if (!garment) return res.status(404).json({ message: 'Prenda no encontrada' });

    const { name, category, color, swatchColor, imageUrl, imagePublicId } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (color !== undefined) updates.color = color;
    if (swatchColor !== undefined) updates.swatchColor = swatchColor;

    // La imagen se cambia (o se quita con null) siempre con url e identificador juntos.
    const imageChanged = imageUrl !== undefined || imagePublicId !== undefined;
    if (imageChanged) {
      const imageError = validateImage({ imageUrl, imagePublicId }, req.userId);
      if (imageError) return res.status(400).json({ message: imageError });
      updates.imageUrl = imageUrl || null;
      updates.imagePublicId = imagePublicId || null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No enviaste ningún cambio' });
    }

    const previousPublicId = garment.imagePublicId;
    garment.set(updates);
    await garment.save();

    // Si la foto cambió o se quitó, la anterior se borra de Cloudinary.
    if (imageChanged && previousPublicId && previousPublicId !== garment.imagePublicId) {
      await deleteImage(previousPublicId);
    }

    res.json({ garment: serialize(garment) });
  } catch (error) {
    serverError(res, error);
  }
}

// DELETE /api/garments/:id
async function remove(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Prenda no encontrada' });
    }

    const garment = await Garment.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    if (!garment) return res.status(404).json({ message: 'Prenda no encontrada' });

    await deleteImage(garment.imagePublicId);
    res.json({ message: 'Prenda eliminada' });
  } catch (error) {
    serverError(res, error);
  }
}

// PATCH /api/garments/:id/favorite
async function setFavorite(req, res) {
  try {
    const { isFavorite } = req.body;

    if (typeof isFavorite !== 'boolean') {
      return res.status(400).json({ message: 'isFavorite debe ser verdadero o falso' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Prenda no encontrada' });
    }

    const garment = await Garment.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      { isFavorite },
      { new: true }
    );
    if (!garment) return res.status(404).json({ message: 'Prenda no encontrada' });

    res.json({ garment: serialize(garment) });
  } catch (error) {
    serverError(res, error);
  }
}

module.exports = { list, create, update, remove, setFavorite };