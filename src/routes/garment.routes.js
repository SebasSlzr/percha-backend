const express = require('express');
const { list, create, update, remove } = require('../controllers/garment.controller');
const requireAuth = require('../middleware/auth.middleware');

const router = express.Router();

// Todas las rutas de prendas exigen estar logueado.
router.use(requireAuth);

router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;