const mongoose = require('mongoose');

const garmentSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['Camiseta', 'Pantalón', 'Chaqueta', 'Vestido', 'Zapatos', 'Accesorio'],
    },
    color: { type: String, required: true, trim: true },
    swatchColor: { type: String, required: true, trim: true },
    // Solo se guarda la URL pública de Cloudinary, nunca el archivo.
    imageUrl: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    isFavorite: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Garment', garmentSchema);