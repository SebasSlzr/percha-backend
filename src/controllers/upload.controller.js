const crypto = require('crypto');
const { cloudinary, userFolder } = require('../config/cloudinary');

// POST /api/uploads/signature
// La app pide una firma y sube la foto directo a Cloudinary. El API secret
// nunca sale del servidor; solo viaja la firma, que caduca.
function createSignature(req, res) {
  const timestamp = Math.round(Date.now() / 1000);
  const publicId = `${userFolder(req.userId)}/${crypto.randomBytes(6).toString('hex')}`;

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, public_id: publicId },
    process.env.CLOUDINARY_API_SECRET
  );

  res.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    publicId,
  });
}

module.exports = { createSignature };