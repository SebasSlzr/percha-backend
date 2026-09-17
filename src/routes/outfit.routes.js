const express = require('express');
const { list, create, update, remove } = require('../controllers/outfit.controller');
const requireAuth = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;