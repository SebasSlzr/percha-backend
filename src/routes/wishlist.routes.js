const express = require('express');
const ctrl = require('../controllers/wishlist.controller');
const requireAuth = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.post('/preview', ctrl.preview); // antes de las rutas con :id
router.get('/:id', ctrl.getOne);
router.put('/:id', ctrl.update);
router.patch('/:id/purchased', ctrl.setPurchased);
router.post('/:id/move-to-wardrobe', ctrl.moveToWardrobe);
router.delete('/:id', ctrl.remove);

module.exports = router;