const Article = require('../models/Article');
const Issue = require('../models/Issue');

const isOwner = (article, userId) => {
  if (!article?.authorId) return false;
  return article.authorId.toString() === userId;
};

const getArticles = async (req, res) => {
  try {
    const { authorId, status } = req.query;
    const filter = {};

    if (req.user.role === 'author') {
      filter.authorId = req.user.id;
    } else if (authorId) {
      filter.authorId = authorId;
    }

    if (status) {
      filter.status = status;
    }

    const articles = await Article.find(filter)
      .populate('authorId', 'username email')
      .populate({
        path: 'issueId',
        select: 'number publicationDate',
        options: { strictPopulate: false } // Не падать, если issueId null или не существует
      })
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: articles.length,
      data: articles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getArticleById = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id)
      .populate('authorId', 'username email')
      .populate({
        path: 'issueId',
        select: 'number publicationDate',
        options: { strictPopulate: false }
      });

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
      });
    }

    if (req.user.role === 'author' && !isOwner(article, req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this article',
      });
    }

    res.json({
      success: true,
      data: article,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const createArticle = async (req, res) => {
  try {
    const { title, content, authorId, issueId } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required',
      });
    }

    const resolvedAuthorId = req.user.role === 'chief_editor' && authorId
      ? authorId
      : req.user.id;

    const article = await Article.create({
      title,
      content,
      authorId: resolvedAuthorId,
      issueId: issueId || null,
      status: 'draft',
    });

    const populatedArticle = await Article.findById(article._id)
      .populate('authorId', 'username email')
      .populate({
        path: 'issueId',
        select: 'number publicationDate',
        options: { strictPopulate: false }
      });

    res.status(201).json({
      success: true,
      data: populatedArticle,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const updateArticle = async (req, res) => {
  try {
    const { title, content } = req.body;
    const article = await Article.findById(req.params.id);

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
      });
    }

    const userRole = req.user.role;
    const owner = isOwner(article, req.user.id);

    if (userRole === 'author' && !owner) {
      return res.status(403).json({
        success: false,
        error: 'You can only edit your own articles',
      });
    }

    if (userRole === 'author' && !['draft', 'needs_revision'].includes(article.status)) {
      return res.status(400).json({
        success: false,
        error: 'Authors can edit only drafts or articles needing revision',
      });
    }

    if (userRole === 'proofreader' && article.status !== 'under_review') {
      return res.status(400).json({
        success: false,
        error: 'Proofreaders can edit articles only during review',
      });
    }

    if (title) article.title = title;
    if (content) article.content = content;

    await article.save();

    const populatedArticle = await Article.findById(article._id)
      .populate('authorId', 'username email')
      .populate({
        path: 'issueId',
        select: 'number publicationDate',
        options: { strictPopulate: false }
      });

    res.json({
      success: true,
      data: populatedArticle,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const deleteArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
      });
    }

    await article.deleteOne();

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const submitForReview = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
      });
    }

    if (article.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Only draft articles can be submitted for review',
      });
    }

    if (!isOwner(article, req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Only the author can submit this article',
      });
    }

    article.status = 'under_review';
    await article.save();

    const populatedArticle = await Article.findById(article._id)
      .populate('authorId', 'username email')
      .populate({
        path: 'issueId',
        select: 'number publicationDate',
        options: { strictPopulate: false }
      });

    res.json({
      success: true,
      data: populatedArticle,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const approveArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
      });
    }

    if (article.status !== 'under_review') {
      return res.status(400).json({
        success: false,
        error: 'Only articles under review can be approved',
      });
    }

    article.status = 'approved';
    await article.save();

    const populatedArticle = await Article.findById(article._id)
      .populate('authorId', 'username email')
      .populate({
        path: 'issueId',
        select: 'number publicationDate',
        options: { strictPopulate: false }
      });

    res.json({
      success: true,
      data: populatedArticle,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const requestRevision = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
      });
    }

    if (article.status !== 'under_review') {
      return res.status(400).json({
        success: false,
        error: 'Only articles under review can be returned for revision',
      });
    }

    article.status = 'needs_revision';
    await article.save();

    const populatedArticle = await Article.findById(article._id)
      .populate('authorId', 'username email')
      .populate({
        path: 'issueId',
        select: 'number publicationDate',
        options: { strictPopulate: false }
      });

    res.json({
      success: true,
      data: populatedArticle,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  submitForReview,
  approveArticle,
  requestRevision,
};

