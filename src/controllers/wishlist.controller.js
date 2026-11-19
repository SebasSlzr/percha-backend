const crypto = require('crypto');
const mongoose = require('mongoose');
const WishlistItem = require('../models/WishlistItem');
const Garment = require('../models/Garment');
const { cloudinary, userFolder, validateImage, deleteImage } = require('../config/cloudinary');
const { detectDominantColor } = require('../utils/dominantColor');
const { colorName } = require('../utils/colorName');
const { fetchHtml, extractPreview, LinkError } = require('../utils/linkPreview');
const { serialize: serializeGarment } = require('./garment.controller');

const FALLBACK_SWATCH = '#B8B2A7';
const MAX_PRICE = 100000000;
const categories = () => Garment.schema.path('category').enumValues;

function serialize(item) {
  return {
    id: item._id,
    name: item.name,
    url: item.url ?? null,
    store: item.store ?? null,
    price: item.price ?? null,
    category: item.category ?? null,
    imageUrl: item.imageUrl ?? null,
    imagePublicId: item.imagePublicId ?? null,
    dominantColor: item.dominantColor ?? null,
    purchased: !!item.purchased,
    createdAt: item.createdAt,
  };
}

const serverError = (res, error) =>
  res.status(500).json({ message: 'Error en el servidor', error: error.message });

const notFound = (res) => res.status(404).json({ message: 'Deseo no encontrado' });

// Busca un deseo del usuario. Si el id es inválido o es de otra persona, devuelve
// null y se responde 404: no se revela si existe (IDOR).
async function findOwned(req) {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  return WishlistItem.findOne({ _id: req.params.id, owner: req.userId });
}

// Valida los campos de texto, precio y categoría. Con partial = true solo revisa
// los que llegaron. Devuelve { error } o { data } con los valores ya limpios.
function validateFields(body, { partial }) {
  const data = {};

  if (body.name !== undefined || !partial) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return { error: 'El nombre es obligatorio' };
    if (name.length > 80) return { error: 'El nombre no puede superar 80 caracteres' };
    data.name = name;
  }

  if (body.url !== undefined) {
    const url = typeof body.url === 'string' ? body.url.trim() : body.url;
    if (url === null || url === '') data.url = null;
    else if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { error: 'El link debe empezar por http:// o https://' };
    } else if (url.length > 500) return { error: 'El link no puede superar 500 caracteres' };
    else data.url = url;
  }

  if (body.store !== undefined) {
    const store = typeof body.store === 'string' ? body.store.trim() : body.store;
    if (store === null || store === '') data.store = null;
    else if (typeof store !== 'string') return { error: 'La tienda debe ser texto' };
    else if (store.length > 60) return { error: 'La tienda no puede superar 60 caracteres' };
    else data.store = store;
  }

  if (body.price !== undefined) {
    if (body.price === null) data.price = null;
    else if (typeof body.price !== 'number' || !Number.isFinite(body.price)) {
      return { error: 'El precio debe ser un número' };
    } else if (body.price < 0) return { error: 'El precio no puede ser negativo' };
    else if (body.price >= MAX_PRICE) return { error: 'El precio es demasiado alto' };
    else data.price = body.price;
  }

  if (body.category !== undefined) {
    if (body.category === null || body.category === '') data.category = null;
    else if (!categories().includes(body.category)) return { error: 'Elige una categoría válida' };
    else data.category = body.category;
  }

  return { data };
}

// GET /api/wishlist
async function list(req, res) {
  try {
    const items = await WishlistItem.find({ owner: req.userId }).sort({ createdAt: -1 });
    res.json({ items: items.map(serialize) });
  } catch (error) {
    serverError(res, error);
  }
}

// GET /api/wishlist/:id
async function getOne(req, res) {
  try {
    const item = await findOwned(req);
    if (!item) return notFound(res);
    res.json({ item: serialize(item) });
  } catch (error) {
    serverError(res, error);
  }
}

// POST /api/wishlist
async function create(req, res) {
  try {
    const { error, data } = validateFields(req.body, { partial: false });
    if (error) return res.status(400).json({ message: error });

    const { imageUrl, imagePublicId } = req.body;
    const imageError = validateImage({ imageUrl, imagePublicId }, req.userId);
    if (imageError) return res.status(400).json({ message: imageError });

    const item = await WishlistItem.create({
      owner: req.userId,
      ...data,
      imageUrl: imageUrl || null,
      imagePublicId: imagePublicId || null,
      dominantColor: imageUrl ? await detectDominantColor(imageUrl) : null,
    });
    res.status(201).json({ item: serialize(item) });
  } catch (error) {
    serverError(res, error);
  }
}

// PUT /api/wishlist/:id (solo aplica los campos que lleguen)
async function update(req, res) {
  try {
    const item = await findOwned(req);
    if (!item) return notFound(res);

    const { error, data } = validateFields(req.body, { partial: true });
    if (error) return res.status(400).json({ message: error });

    const { imageUrl, imagePublicId } = req.body;
    const imageChanged = imageUrl !== undefined || imagePublicId !== undefined;
    if (imageChanged) {
      const imageError = validateImage({ imageUrl, imagePublicId }, req.userId);
      if (imageError) return res.status(400).json({ message: imageError });
      data.imageUrl = imageUrl || null;
      data.imagePublicId = imagePublicId || null;
      data.dominantColor = data.imageUrl ? await detectDominantColor(data.imageUrl) : null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No enviaste ningún cambio' });
    }

    const previousPublicId = item.imagePublicId;
    item.set(data);
    await item.save();

    if (imageChanged && previousPublicId && previousPublicId !== item.imagePublicId) {
      await deleteImage(previousPublicId);
    }

    res.json({ item: serialize(item) });
  } catch (error) {
    serverError(res, error);
  }
}

// PATCH /api/wishlist/:id/purchased
async function setPurchased(req, res) {
  try {
    const { purchased } = req.body;
    if (typeof purchased !== 'boolean') {
      return res.status(400).json({ message: 'purchased debe ser verdadero o falso' });
    }
    const item = await findOwned(req);
    if (!item) return notFound(res);

    item.purchased = purchased;
    await item.save();
    res.json({ item: serialize(item) });
  } catch (error) {
    serverError(res, error);
  }
}

// DELETE /api/wishlist/:id
async function remove(req, res) {
  try {
    const item = await findOwned(req);
    if (!item) return notFound(res);

    await item.deleteOne();
    await deleteImage(item.imagePublicId);
    res.json({ message: 'Deseo eliminado' });
  } catch (error) {
    serverError(res, error);
  }
}

// POST /api/wishlist/:id/move-to-wardrobe  { category }
// Crea una prenda con la foto del deseo y elimina el deseo.
// La imagen NO se borra de Cloudinary: ahora pertenece a la prenda.
async function moveToWardrobe(req, res) {
  try {
    const { category } = req.body;
    if (!categories().includes(category)) {
      return res.status(400).json({ message: 'Elige una categoría válida' });
    }

    const item = await findOwned(req);
    if (!item) return notFound(res);
    if (!item.imageUrl) {
      return res.status(400).json({ message: 'Para pasarlo al armario, el deseo necesita una foto' });
    }

    const dominantColor = item.dominantColor || (await detectDominantColor(item.imageUrl));
    const garment = await Garment.create({
      owner: req.userId,
      name: item.name,
      category,
      color: dominantColor ? colorName(dominantColor) : 'Sin detectar',
      swatchColor: dominantColor || FALLBACK_SWATCH,
      imageUrl: item.imageUrl,
      imagePublicId: item.imagePublicId,
      dominantColor,
    });
    await item.deleteOne();

    res.status(201).json({ garment: serializeGarment(garment) });
  } catch (error) {
    serverError(res, error);
  }
}

// POST /api/wishlist/preview  { url }
// El servidor lee la página (con protección SSRF), extrae nombre, tienda, precio
// y categoría, y sube la imagen a Cloudinary en la carpeta del usuario.
async function preview(req, res) {
  try {
    const { url } = req.body;
    if (typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ message: 'Escribe o pega un link' });
    }
    if (url.length > 500) return res.status(400).json({ message: 'El link no puede superar 500 caracteres' });

    const { html, finalUrl } = await fetchHtml(url.trim());
    const data = extractPreview(html, finalUrl.toString());
    if (!data.name && !data.imageUrl) {
      throw new LinkError(422, 'No pudimos leer los datos de ese link');
    }

    // Cloudinary descarga la imagen directamente desde la tienda.
    let imageUrl = null;
    let imagePublicId = null;
    if (data.imageUrl) {
      try {
        const uploaded = await cloudinary.uploader.upload(data.imageUrl, {
          public_id: `${userFolder(req.userId)}/${crypto.randomBytes(6).toString('hex')}`,
          resource_type: 'image',
          timeout: 15000,
        });
        imageUrl = uploaded.secure_url;
        imagePublicId = uploaded.public_id;
      } catch (uploadError) {
        console.error('No se pudo copiar la imagen del link:', uploadError.message);
      }
    }

    res.json({
      preview: { name: data.name, store: data.store, price: data.price, category: data.category, imageUrl, imagePublicId },
    });
  } catch (error) {
    if (error instanceof LinkError) return res.status(error.status).json({ message: error.message });
    serverError(res, error);
  }
}

module.exports = { list, getOne, create, update, setPurchased, remove, moveToWardrobe, preview };