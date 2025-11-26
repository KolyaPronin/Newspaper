const express = require('express');
const router = express.Router();
const {
  getUserById,
  getUsers,
} = require('../controllers/userController');
const { authenticate, requireRoles } = require('../middleware/authMiddleware');

router.use(authenticate);

router.route('/')
  .get(requireRoles('chief_editor'), getUsers);

router.route('/:id')
  .get(requireRoles('chief_editor'), getUserById);

module.exports = router;

