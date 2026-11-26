const { cloudinary } = require('../config/cloudinary');
const Garment = require('../models/Garment');

// Cada eliminación de fondo cuesta 75 transformaciones de Cloudinary.
// Con REMOVE_BG=false se apaga sin tocar código (por ejemplo, si se acaban los créditos).
const enabled = () => process.env.REMOVE_BG !== 'false';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_ATTEMPTS = 15;
const WAIT_MS = 3000;

// URL de la versión sin fondo, en PNG para conservar la transparencia.
function cutoutUrl(publicId) {
  return cloudinary.url(publicId, { secure: true, effect: 'background_removal', format: 'png' });
}

// La primera vez, Cloudinary responde 423 mientras procesa. Se reintenta hasta que esté lista.
async function waitUntilReady(url) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    await response.body?.cancel();
    if (response.ok) return true;
    if (response.status !== 423) {
      console.error(`Quitar fondo: Cloudinary respondió ${response.status} ${response.headers.get('x-cld-error') || ''}`);
      return false;
    }
    await sleep(WAIT_MS);
  }
  console.error('Quitar fondo: Cloudinary tardó demasiado');
  return false;
}

// Se llama sin await: la respuesta a la app no espera. Solo actualiza la prenda si
// todavía tiene la misma foto (por si la cambiaron mientras tanto).
function queueBackgroundRemoval(garment) {
  if (!enabled() || !garment.imagePublicId) return;
  const { _id, imagePublicId } = garment;
  (async () => {
    const url = cutoutUrl(imagePublicId);
    if (!(await waitUntilReady(url))) return;
    await Garment.updateOne({ _id, imagePublicId }, { imageUrl: url });
    console.log(`✂️ Fondo quitado: ${imagePublicId}`);
  })().catch((error) => console.error('No se pudo quitar el fondo:', error.message));
}

module.exports = { queueBackgroundRemoval, cutoutUrl, waitUntilReady };