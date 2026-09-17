const mongoose = require('mongoose');

const outfitSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    head: { type: mongoose.Schema.Types.ObjectId, ref: 'Garment', default: null },
    // El torso admite varias prendas superpuestas (ej. camiseta + chaqueta),
    // en el orden en que la persona las fue agregando.
    torso: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Garment' }],
    legs: { type: mongoose.Schema.Types.ObjectId, ref: 'Garment', default: null },
    feet: { type: mongoose.Schema.Types.ObjectId, ref: 'Garment', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Outfit', outfitSchema);