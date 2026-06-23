const express = require('express');
const {
  getLayouts,
  getLayoutById,
  createLayout,
  updateLayout,
  deleteLayout,
} = require('../controllers/layoutController');
const { authenticate, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.use(requireRoles('layout_designer', 'chief_editor'));

router.route('/')
  .get(getLayouts)
  .post(createLayout);

router.route('/:id')
  .get(getLayoutById)
  .put(updateLayout)
  .delete(requireRoles('chief_editor'), deleteLayout);

module.exports = router;

