const express = require('express');
const router = express.Router();
const checkDatabase = require('../middleware/checkDatabase');
const { authenticate } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const {
  getIllustrationsByArticle,
  getIllustrationById,
  createIllustration,
  updateIllustration,
  deleteIllustration,
} = require('../controllers/illustrationController');

router.use(checkDatabase);
router.use(authenticate);

router.get('/article/:articleId', getIllustrationsByArticle);

router.get('/:id', getIllustrationById);

router.post('/', upload.single('image'), createIllustration);

router.put('/:id', updateIllustration);

router.delete('/:id', deleteIllustration);

module.exports = router;

