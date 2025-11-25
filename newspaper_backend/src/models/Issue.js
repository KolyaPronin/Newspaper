const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: [true, 'Issue number is required'],
    unique: true,
  },
  publicationDate: {
    type: Date,
    required: [true, 'Publication date is required'],
  },
  status: {
    type: String,
    enum: ['draft', 'in_progress', 'approved', 'published'],
    default: 'draft',
  },
  title: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

issueSchema.index({ number: 1 });
issueSchema.index({ publicationDate: 1 });
issueSchema.index({ status: 1 });

const Issue = mongoose.model('Issue', issueSchema);

module.exports = Issue;

