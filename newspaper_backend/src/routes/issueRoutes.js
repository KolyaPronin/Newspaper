const express = require('express');
const {
  getIssues,
  getIssueById,
  startIssueWorkflow,
  addIssueArticle,
} = require('../controllers/issueController');
const { authenticate, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);

router.route('/')
  .get(requireRoles('chief_editor', 'layout_designer', 'proofreader'), getIssues);

router.route('/start')
  .post(requireRoles('chief_editor'), startIssueWorkflow);

router.post('/:id/articles', requireRoles('chief_editor'), addIssueArticle);

router.route('/:id')
  .get(requireRoles('chief_editor', 'layout_designer', 'proofreader'), getIssueById);

module.exports = router;
