const sharp = require('sharp');

const TIMEOUT_MS = 10000;

const toHex = ({ r, g, b }) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

// Calcula el color dominante de una imagen en memoria. Recorta el 60 % central
// porque la prenda suele estar al centro y los bordes son fondo.
async function dominantColorFromBuffer(buffer) {
  const { width, height } = await sharp(buffer).metadata();
  const crop = {
    left: Math.round(width * 0.2),
    top: Math.round(height * 0.2),
    width: Math.max(1, Math.round(width * 0.6)),
    height: Math.max(1, Math.round(height * 0.6)),
  };
  // stats() lee la imagen de entrada, no el resultado de extract(): por eso se
  // genera primero el recorte como buffer y se analiza ese.
  const cropped = await sharp(buffer).extract(crop).toBuffer();
  const { dominant } = await sharp(cropped).stats();
  return toHex(dominant);
}

// Descarga una miniatura de Cloudinary (más liviana) y calcula su color.
// Si algo falla devuelve null: no detectar el color nunca impide guardar.
async function detectDominantColor(imageUrl) {
  if (!imageUrl) return null;
  const thumbUrl = imageUrl.replace('/upload/', '/upload/w_300,f_jpg/');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(thumbUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`Cloudinary respondió ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    return await dominantColorFromBuffer(buffer);
  } catch (error) {
    console.error('No se pudo detectar el color dominante:', error.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { detectDominantColor, dominantColorFromBuffer };