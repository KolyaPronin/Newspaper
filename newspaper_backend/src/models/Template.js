const mongoose = require('mongoose');

const adSlotSchema = new mongoose.Schema({
  id: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  allowedContentTypes: [{ type: String }],
}, { _id: false });

const illustrationPositionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  allowedColumns: [{ type: Number, required: true }],
  maxWidth: { type: Number, required: true },
  maxHeight: { type: Number, required: true },
  textWrapping: {
    type: String,
    enum: ['none', 'around', 'below'],
    default: 'none',
  },
}, { _id: false });

const headerFooterSchema = new mongoose.Schema({
  content: { type: String, default: '' },
  height: { type: Number, required: true },
}, { _id: false });

const marginsSchema = new mongoose.Schema({
  top: { type: Number, required: true },
  bottom: { type: Number, required: true },
  left: { type: Number, required: true },
  right: { type: Number, required: true },
}, { _id: false });

const textFlowRulesSchema = new mongoose.Schema({
  wrapAroundIllustrations: { type: Boolean, default: true },
  wrapAroundAds: { type: Boolean, default: false },
  multiColumnContinuation: { type: Boolean, default: true },
}, { _id: false });

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  columns: {
    type: Number,
    min: 1,
    max: 8,
    required: true,
  },
  adSlots: {
    type: [adSlotSchema],
    default: [],
  },
  illustrationPositions: {
    type: [illustrationPositionSchema],
    default: [],
  },
  margins: {
    type: marginsSchema,
    required: true,
  },
  headers: {
    type: headerFooterSchema,
    required: true,
  },
  footers: {
    type: headerFooterSchema,
    required: true,
  },
  textFlowRules: {
    type: textFlowRulesSchema,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

templateSchema.index({ name: 1 });

const Template = mongoose.model('Template', templateSchema);

module.exports = Template;

