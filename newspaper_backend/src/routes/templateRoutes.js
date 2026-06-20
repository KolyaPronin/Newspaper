const express = require('express');
const {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} = require('../controllers/templateController');
const { authenticate, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);

router.route('/')
  .get(requireRoles('layout_designer', 'chief_editor'), getTemplates)
  .post(requireRoles('layout_designer', 'chief_editor'), createTemplate);

router.route('/:id')
  .get(requireRoles('layout_designer', 'chief_editor'), getTemplateById)
  .put(requireRoles('layout_designer', 'chief_editor'), updateTemplate)
  .delete(requireRoles('chief_editor'), deleteTemplate);

module.exports = router;

