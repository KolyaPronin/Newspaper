const express = require('express');
const router = express.Router();
const checkDatabase = require('../middleware/checkDatabase');
const {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  submitForReview,
  approveArticle,
  requestRevision,
} = require('../controllers/articleController');
const { authenticate, requireRoles } = require('../middleware/authMiddleware');

router.use(checkDatabase);
router.use(authenticate);

router.route('/')
  .get(getArticles)
  .post(requireRoles('author', 'chief_editor'), createArticle);

router.route('/:id')
  .get(getArticleById)
  .put(requireRoles('author', 'proofreader', 'chief_editor'), updateArticle)
  .delete(requireRoles('chief_editor'), deleteArticle);

router.route('/:id/submit')
  .post(requireRoles('author'), submitForReview);

router.route('/:id/approve')
  .post(requireRoles('proofreader', 'chief_editor'), approveArticle);

router.route('/:id/request-revision')
  .post(requireRoles('proofreader', 'chief_editor'), requestRevision);

module.exports = router;

