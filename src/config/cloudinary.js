const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Todas las imágenes de una persona viven bajo percha/<idDeUsuario>/
const userFolder = (userId) => `percha/${userId}`;

// Devuelve un mensaje de error, o null si la imagen es válida. Evita que alguien
// guarde URLs ajenas o apunte a imágenes de otra cuenta.
function validateImage({ imageUrl, imagePublicId }, userId) {
  if (!imageUrl && !imagePublicId) return null;
  if (!imageUrl || !imagePublicId) return 'La imagen necesita url e identificador';
  if (!imageUrl.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`)) {
    return 'La URL de la imagen no es válida';
  }
  if (!imagePublicId.startsWith(`${userFolder(userId)}/`)) {
    return 'El identificador de la imagen no es válido';
  }
  return null;
}

// Borrar imágenes nunca debe impedir que se borre una prenda o una cuenta.
async function deleteImage(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('No se pudo borrar la imagen de Cloudinary:', error.message);
  }
}

async function deleteUserImages(userId) {
  try {
    await cloudinary.api.delete_resources_by_prefix(`${userFolder(userId)}/`);
  } catch (error) {
    console.error('No se pudieron borrar las imágenes del usuario:', error.message);
  }
}

module.exports = { cloudinary, userFolder, validateImage, deleteImage, deleteUserImages };