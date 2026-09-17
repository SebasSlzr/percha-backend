const mongoose = require('mongoose');

const garmentSchema = new mongoose.Schema(
  {
    // Cada prenda pertenece a un usuario — nunca se mezclan armarios entre cuentas.
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['Camiseta', 'Pantalón', 'Chaqueta', 'Vestido', 'Zapatos', 'Accesorio'],
    },
    color: { type: String, required: true, trim: true },
    swatchColor: { type: String, required: true, trim: true }, // hex, mientras no hay fotos reales
  },
  { timestamps: true }
);

module.exports = mongoose.model('Garment', garmentSchema);