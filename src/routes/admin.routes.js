const express = require('express');
const { list, remove } = require('../controllers/admin.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireAdmin = require('../middleware/admin.middleware');

const router = express.Router();

// Primero se verifica la sesión, después el rol.
router.use(requireAuth, requireAdmin);

router.get('/users', list);
router.delete('/users/:id', remove);

module.exports = router;