// Calcula el color dominante de las prendas con foto que aún no lo tienen.
// Se puede correr varias veces: solo toca las que faltan.
// Uso: docker exec percha-api node src/scripts/backfillColors.js
const mongoose = require('mongoose');
const Garment = require('../models/Garment');
const { detectDominantColor } = require('../utils/dominantColor');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const garments = await Garment.find({ imageUrl: { $ne: null }, dominantColor: null });
  console.log(`Prendas por revisar: ${garments.length}`);

  for (const garment of garments) {
    const dominantColor = await detectDominantColor(garment.imageUrl);
    if (!dominantColor) continue;
    // Solo se guarda el color detectado; el color de muestra que eligió la usuaria no se toca.
    await Garment.updateOne({ _id: garment._id }, { dominantColor });
    console.log(`${garment.name}: ${dominantColor}`);
  }

  await mongoose.disconnect();
  console.log('Listo');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});