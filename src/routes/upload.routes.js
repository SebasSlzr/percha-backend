const express = require('express');
const { createSignature } = require('../controllers/upload.controller');
const requireAuth = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

router.post('/signature', createSignature);

module.exports = router;