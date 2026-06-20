const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
  },
  status: {
    type: String,
    enum: ['draft', 'under_review', 'needs_revision', 'approved', 'published'],
    default: 'draft',
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author ID is required'],
  },
  issueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Issue',
    default: null,
  },
}, {
  timestamps: true,
});

articleSchema.index({ authorId: 1, status: 1 });
articleSchema.index({ status: 1 });
articleSchema.index({ issueId: 1 });

const Article = mongoose.model('Article', articleSchema);

module.exports = Article;

