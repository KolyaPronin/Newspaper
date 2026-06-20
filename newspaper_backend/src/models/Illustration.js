const mongoose = require('mongoose');

const illustrationSchema = new mongoose.Schema({
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    default: null,
  },
  kind: {
    type: String,
    enum: ['illustration', 'ad'],
    default: 'illustration',
  },
  filename: {
    type: String,
    required: [true, 'Filename is required'],
  },
  originalName: {
    type: String,
    required: [true, 'Original filename is required'],
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required'],
  },
  size: {
    type: Number,
    required: [true, 'File size is required'],
  },
  path: {
    type: String,
    required: [true, 'File path is required'],
  },
  url: {
    type: String,
    required: [true, 'File URL is required'],
  },
  caption: {
    type: String,
    default: '',
  },
  position: {
    type: String,
    enum: ['inline', 'fixed'],
    default: 'inline',
  },
  columnIndex: {
    type: Number,
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required'],
  },
}, {
  timestamps: true,
});

illustrationSchema.index({ articleId: 1 });
illustrationSchema.index({ kind: 1, articleId: 1 });
illustrationSchema.index({ createdBy: 1 });

const Illustration = mongoose.model('Illustration', illustrationSchema);

module.exports = Illustration;

