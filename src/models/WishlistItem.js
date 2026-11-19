const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    url: { type: String, default: null, maxlength: 500 },   // link de la tienda o de la publicación
    store: { type: String, default: null, trim: true, maxlength: 60 },
    price: { type: Number, default: null, min: 0 },           // pesos colombianos
    category: { type: String, default: null },                // una de las categorías de Garment
    imageUrl: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    dominantColor: { type: String, default: null },           // lo calcula el servidor
    purchased: { type: Boolean, default: false },
    lastRemindedAt: { type: Date, default: null },            // lo usa el job de recordatorios push
  },
  { timestamps: true }
);

module.exports = mongoose.model('WishlistItem', wishlistItemSchema);