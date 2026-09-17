const express = require('express');
const { getMe, updateMe, deleteMe } = require('../controllers/user.controller');
const requireAuth = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/me', getMe);
router.put('/me', updateMe);
router.delete('/me', deleteMe);

module.exports = router;