const express = require('express');
const router = express.Router();
const { register, login, me, logout } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, me);
router.post('/logout', authenticate, logout);

module.exports = router;

