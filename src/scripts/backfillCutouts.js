// Uso: docker exec percha-api node src/scripts/backfillCutouts.js
// En producción: en Render, pestaña Shell, ejecutar node src/scripts/backfillCutouts.js
const mongoose = require('mongoose');
const Garment = require('../models/Garment');
const { cutoutUrl, waitUntilReady } = require('../utils/removeBackground');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const garments = await Garment.find({
    imagePublicId: { $ne: null },
    imageUrl: { $not: /e_background_removal/ },
  });
  console.log(`Prendas por procesar: ${garments.length}`);

  for (const garment of garments) {
    const url = cutoutUrl(garment.imagePublicId);
    if (await waitUntilReady(url)) {
      await Garment.updateOne({ _id: garment._id }, { imageUrl: url });
      console.log(`✂️ ${garment.name}`);
    }
  }

  await mongoose.disconnect();
  console.log('Listo');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});