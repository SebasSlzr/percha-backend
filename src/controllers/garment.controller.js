const mongoose = require('mongoose');
const Garment = require('../models/Garment');
const { validateImage, deleteImage } = require('../config/cloudinary');
const { detectDominantColor } = require('../utils/dominantColor');
const { colorName } = require('../utils/colorName');

const HEX = /^#[0-9A-Fa-f]{6}$/;
const FALLBACK_SWATCH = '#B8B2A7'; // si no se pudo detectar el color; la usuaria lo corrige

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
    dominantColor: garment.dominantColor ?? null,
  };
}

const serverError = (res, error) =>
  res.status(500).json({ message: 'Error en el servidor', error: error.message });

const notFound = (res) => res.status(404).json({ message: 'Prenda no encontrada' });

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
// Regla del servidor: si la prenda tiene foto, el color lo detecta el backend.
// Si la app manda swatchColor, se respeta: es la corrección de la usuaria.
async function create(req, res) {
  try {
    const { name, category, imageUrl, imagePublicId } = req.body;
    let { color, swatchColor } = req.body;

    if (!name || !category) {
      return res.status(400).json({ message: 'Nombre y categoría son obligatorios' });
    }
    if (swatchColor !== undefined && !HEX.test(swatchColor)) {
      return res.status(400).json({ message: 'El color de muestra debe ser un hexadecimal como #A1B2C3' });
    }

    const imageError = validateImage({ imageUrl, imagePublicId }, req.userId);
    if (imageError) return res.status(400).json({ message: imageError });

    let dominantColor = null;
    if (imageUrl) {
      dominantColor = await detectDominantColor(imageUrl);
      if (!swatchColor) swatchColor = dominantColor || FALLBACK_SWATCH;
      if (!color) color = dominantColor ? colorName(dominantColor) : 'Sin detectar';
    } else if (!color || !swatchColor) {
      return res.status(400).json({ message: 'Sin foto, el nombre del color y el color de muestra son obligatorios' });
    }

    const garment = await Garment.create({
      owner: req.userId,
      name,
      category,
      color,
      swatchColor,
      imageUrl: imageUrl || null,
      imagePublicId: imagePublicId || null,
      dominantColor,
    });
    res.status(201).json({ garment: serialize(garment) });
  } catch (error) {
    serverError(res, error);
  }
}

// PUT /api/garments/:id (solo aplica los campos que lleguen)
async function update(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);

    const garment = await Garment.findOne({ _id: req.params.id, owner: req.userId });
    if (!garment) return notFound(res);

    const { name, category, color, swatchColor, imageUrl, imagePublicId } = req.body;
    if (swatchColor !== undefined && !HEX.test(swatchColor)) {
      return res.status(400).json({ message: 'El color de muestra debe ser un hexadecimal como #A1B2C3' });
    }

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

      if (updates.imageUrl) {
        // Foto nueva: se vuelve a detectar el color, salvo que la usuaria lo haya corregido.
        const dominantColor = await detectDominantColor(updates.imageUrl);
        updates.dominantColor = dominantColor;
        if (swatchColor === undefined && dominantColor) updates.swatchColor = dominantColor;
        if (color === undefined && dominantColor) updates.color = colorName(dominantColor);
      } else {
        updates.dominantColor = null;
      }
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
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);

    const garment = await Garment.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    if (!garment) return notFound(res);

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
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);

    const garment = await Garment.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      { isFavorite },
      { new: true }
    );
    if (!garment) return notFound(res);

    res.json({ garment: serialize(garment) });
  } catch (error) {
    serverError(res, error);
  }
}

module.exports = { list, create, update, remove, setFavorite, serialize };