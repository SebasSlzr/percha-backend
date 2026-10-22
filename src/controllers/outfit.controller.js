const Outfit = require('../models/Outfit');
const Garment = require('../models/Garment');

function serializeGarment(g) {
  if (!g) return null;
  return {
    id: g._id,
    name: g.name,
    category: g.category,
    color: g.color,
    swatchColor: g.swatchColor,
    imageUrl: g.imageUrl ?? null,
    imagePublicId: g.imagePublicId ?? null,
    isFavorite: !!g.isFavorite,
  };
}

function serialize(outfit) {
  return {
    id: outfit._id,
    name: outfit.name,
    head: serializeGarment(outfit.head),
    torso: (outfit.torso || []).map(serializeGarment),
    legs: serializeGarment(outfit.legs),
    feet: serializeGarment(outfit.feet),
  };
}

// Confirma que todos los ids de prenda que llegaron son del usuario dueño
// de la sesión — evita que alguien arme un outfit con ropa ajena.
async function verifyOwnership(ids, ownerId) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return true;
  const count = await Garment.countDocuments({ _id: { $in: uniqueIds }, owner: ownerId });
  return count === uniqueIds.length;
}

// GET /api/outfits (soporta ?q=texto por si luego quieres filtrar en el server)
async function list(req, res) {
  try {
    const filter = { owner: req.userId };
    if (req.query.q) filter.name = { $regex: req.query.q, $options: 'i' };

    const outfits = await Outfit.find(filter).sort({ createdAt: -1 }).populate('head torso legs feet');
    res.json({ outfits: outfits.map(serialize) });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

// POST /api/outfits
async function create(req, res) {
  try {
    const { name, head, torso, legs, feet } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'El outfit necesita un nombre' });
    }

    const torsoIds = Array.isArray(torso) ? torso : [];
    const ownsAll = await verifyOwnership([head, legs, feet, ...torsoIds], req.userId);
    if (!ownsAll) return res.status(400).json({ message: 'Una de las prendas seleccionadas no es válida' });

    const outfit = await Outfit.create({
      owner: req.userId,
      name: name.trim(),
      head: head || null,
      torso: torsoIds,
      legs: legs || null,
      feet: feet || null,
    });

    const populated = await outfit.populate('head torso legs feet');
    res.status(201).json({ outfit: serialize(populated) });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

// PUT /api/outfits/:id — solo aplica los campos que llegaron en el body
async function update(req, res) {
  try {
    const { name, head, torso, legs, feet } = req.body;
    const updates = {};
    const idsToCheck = [];

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: 'El outfit necesita un nombre' });
      updates.name = name.trim();
    }
    if (head !== undefined) { updates.head = head || null; idsToCheck.push(head); }
    if (legs !== undefined) { updates.legs = legs || null; idsToCheck.push(legs); }
    if (feet !== undefined) { updates.feet = feet || null; idsToCheck.push(feet); }
    if (torso !== undefined) {
      updates.torso = Array.isArray(torso) ? torso : [];
      idsToCheck.push(...updates.torso);
    }

    const ownsAll = await verifyOwnership(idsToCheck, req.userId);
    if (!ownsAll) return res.status(400).json({ message: 'Una de las prendas seleccionadas no es válida' });

    const outfit = await Outfit.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      updates,
      { new: true, runValidators: true }
    ).populate('head torso legs feet');

    if (!outfit) return res.status(404).json({ message: 'Outfit no encontrado' });
    res.json({ outfit: serialize(outfit) });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

// DELETE /api/outfits/:id
async function remove(req, res) {
  try {
    const outfit = await Outfit.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    if (!outfit) return res.status(404).json({ message: 'Outfit no encontrado' });
    res.json({ message: 'Outfit eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

module.exports = { list, create, update, remove };