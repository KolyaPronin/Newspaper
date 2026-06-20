const express = require('express');
const router = express.Router();
const {
  getUserById,
  getUsers,
} = require('../controllers/userController');
const { authenticate, requireRoles } = require('../middleware/authMiddleware');

router.use(authenticate);

router.route('/')
  .get(requireRoles('chief_editor', 'layout_designer'), getUsers);

router.route('/:id')
  .get(requireRoles('chief_editor', 'layout_designer'), getUserById);

module.exports = router;

