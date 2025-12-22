const mongoose = require('mongoose');

const columnContainerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  columnIndex: { type: Number, required: true },
  content: { type: String, default: '' },
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    default: null,
  },
  kind: {
    type: String,
    enum: ['text', 'illustration'],
    default: 'text',
  },
  illustrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Illustration',
    default: null,
  },
  span: {
    type: Number,
    enum: [1, 2],
    default: 1,
  },
  spanRole: {
    type: String,
    enum: ['main', 'ghost'],
    default: null,
  },
  height: { type: Number, default: 0 },
  isFilled: { type: Boolean, default: false },
}, { _id: false });

const layoutSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template',
    required: true,
  },
  issueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Issue',
    default: null,
  },
  pageNumber: {
    type: Number,
    min: 1,
    default: null,
  },
  headerContent: {
    type: String,
    default: '',
  },
  footerContent: {
    type: String,
    default: '',
  },
  columns: {
    type: [[columnContainerSchema]],
    default: [],
  },
  illustrations: {
    type: [{
      illustrationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Illustration',
        required: true,
      },
      columnIndex: {
        type: Number,
        required: true,
      },
      positionIndex: {
        type: Number,
        required: true,
      },
    }],
    default: [],
  },
  ads: {
    type: [{
      illustrationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Illustration',
        required: true,
      },
      slotIndex: {
        type: Number,
        required: true,
      },
    }],
    default: [],
  },
  status: {
    type: String,
    enum: ['draft', 'in_review', 'published'],
    default: 'draft',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

layoutSchema.index({ templateId: 1, issueId: 1, pageNumber: 1 });

const Layout = mongoose.model('Layout', layoutSchema);

module.exports = Layout;

