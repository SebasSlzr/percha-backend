const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    // El rol nunca llega desde el registro: todos entran como 'user'.
    // Las cuentas ya existentes lo reciben por el valor por defecto.
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    wishlistReminders: { type: Boolean, default: true }, // ¿recibe recordatorios push de la wishlist?
    pushToken: { type: String, default: null },           // token de Expo del teléfono; nunca se envía a la app
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);