const express = require('express');
const { getMe, updateMe, deleteMe, savePushToken } = require('../controllers/user.controller');
const requireAuth = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/me', getMe);
router.put('/me', updateMe);
router.delete('/me', deleteMe);
router.put('/me/push-token', savePushToken);

module.exports = router;