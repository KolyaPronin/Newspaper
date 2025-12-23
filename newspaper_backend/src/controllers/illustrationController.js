const Illustration = require('../models/Illustration');
const Article = require('../models/Article');
const path = require('path');
const fs = require('fs');

const getIllustrations = async (req, res) => {
  try {
    const { kind, global, articleId } = req.query;
    const filter = {};

    if (kind) {
      filter.kind = kind;
    }

    if (global === 'true') {
      filter.articleId = null;
    }

    if (articleId) {
      filter.articleId = articleId;
    }

    const illustrations = await Illustration.find(filter)
      .populate('articleId', 'title')
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: illustrations.length,
      data: illustrations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getIllustrationsByArticle = async (req, res) => {
  try {
    const { articleId } = req.params;
    const { kind } = req.query;

    const filter = { articleId };
    if (kind) filter.kind = kind;

    const illustrations = await Illustration.find(filter)
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: illustrations.length,
      data: illustrations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getIllustrationById = async (req, res) => {
  try {
    const illustration = await Illustration.findById(req.params.id)
      .populate('articleId', 'title')
      .populate('createdBy', 'username email');

    if (!illustration) {
      return res.status(404).json({
        success: false,
        error: 'Illustration not found',
      });
    }

    res.json({
      success: true,
      data: illustration,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const createIllustration = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    const { articleId, caption, position, columnIndex, kind } = req.body;
    const resolvedKind = kind === 'ad' ? 'ad' : 'illustration';

    let resolvedArticleId = null;
    if (articleId) {
      const article = await Article.findById(articleId);
      if (!article) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          error: 'Article not found',
        });
      }

      if (resolvedKind === 'illustration' && article.status !== 'approved') {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'Can only add illustrations to approved articles',
        });
      }

      resolvedArticleId = articleId;
    }

    const fileUrl = `/uploads/illustrations/${req.file.filename}`;

    const illustration = await Illustration.create({
      articleId: resolvedArticleId,
      kind: resolvedKind,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      url: fileUrl,
      caption: caption || '',
      position: position || 'inline',
      columnIndex: columnIndex ? parseInt(columnIndex) : null,
      createdBy: req.user.id,
    });

    const populated = await Illustration.findById(illustration._id)
      .populate('articleId', 'title')
      .populate('createdBy', 'username email');

    res.status(201).json({
      success: true,
      data: populated,
    });
  } catch (error) {
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete file:', unlinkError);
      }
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const updateIllustration = async (req, res) => {
  try {
    const { caption, position, columnIndex } = req.body;
    const illustration = await Illustration.findById(req.params.id);

    if (!illustration) {
      return res.status(404).json({
        success: false,
        error: 'Illustration not found',
      });
    }

    if (illustration.createdBy.toString() !== req.user.id && req.user.role !== 'chief_editor') {
      return res.status(403).json({
        success: false,
        error: 'You can only edit your own illustrations',
      });
    }

    if (caption !== undefined) illustration.caption = caption;
    if (position !== undefined) illustration.position = position;
    if (columnIndex !== undefined) illustration.columnIndex = columnIndex ? parseInt(columnIndex) : null;

    await illustration.save();

    const populated = await Illustration.findById(illustration._id)
      .populate('articleId', 'title')
      .populate('createdBy', 'username email');

    res.json({
      success: true,
      data: populated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const deleteIllustration = async (req, res) => {
  try {
    const illustration = await Illustration.findById(req.params.id);

    if (!illustration) {
      return res.status(404).json({
        success: false,
        error: 'Illustration not found',
      });
    }

    if (illustration.createdBy.toString() !== req.user.id && req.user.role !== 'chief_editor') {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own illustrations',
      });
    }

    if (fs.existsSync(illustration.path)) {
      fs.unlinkSync(illustration.path);
    }

    await illustration.deleteOne();

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

module.exports = {
  getIllustrations,
  getIllustrationsByArticle,
  getIllustrationById,
  createIllustration,
  updateIllustration,
  deleteIllustration,
};

