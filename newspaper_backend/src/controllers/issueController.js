const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const Task = require('../models/Task');

const getNextIssueNumber = async () => {
  const latest = await Issue.findOne().sort({ number: -1 }).select('number');
  return latest ? latest.number + 1 : 1;
};

const getIssues = async (req, res) => {
  try {
    const { status, limit = 50 } = req.query || {};
    const filter = {};
    if (status) filter.status = status;

    const issues = await Issue.find(filter)
      .sort({ number: -1 })
      .limit(Math.min(Number(limit) || 50, 200));

    return res.json({ success: true, count: issues.length, data: issues });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const getIssueById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid issue id' });
    }
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }
    return res.json({ success: true, data: issue });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Creates Issue + parent issue task. Subtasks are added manually by chief editor;
 * proofreader/layout tasks are created automatically when materials are ready.
 */
const startIssueWorkflow = async (req, res) => {
  try {
    const {
      title,
      description,
      deadline,
      publicationDate,
      number,
      issueTitle,
    } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, error: 'title is required' });
    }

    const issueNumber = number !== undefined && number !== null && number !== ''
      ? Number(number)
      : await getNextIssueNumber();

    if (!Number.isFinite(issueNumber) || issueNumber < 1) {
      return res.status(400).json({ success: false, error: 'number must be a positive integer' });
    }

    const pubDate = publicationDate ? new Date(publicationDate) : new Date();
    if (Number.isNaN(pubDate.getTime())) {
      return res.status(400).json({ success: false, error: 'publicationDate is invalid' });
    }

    const issue = await Issue.create({
      number: issueNumber,
      publicationDate: pubDate,
      title: issueTitle || String(title).trim(),
      status: 'in_progress',
    });

    const existingIssueTask = await Task.findOne({
      issueId: issue._id,
      isIssueTask: true,
      status: { $nin: ['done', 'cancelled'] },
    });
    if (existingIssueTask) {
      return res.status(409).json({
        success: false,
        error: 'An active issue task already exists for this issue',
      });
    }

    const issueTask = await Task.create({
      title: String(title).trim(),
      description: description || '',
      deadline: deadline ? new Date(deadline) : null,
      issueId: issue._id,
      createdBy: req.user.id,
      assigneeUserId: null,
      assigneeRole: null,
      status: 'in_progress',
      isIssueTask: true,
    });

    const populatedIssueTask = await Task.findById(issueTask._id)
      .populate('issueId', 'number publicationDate title');

    return res.status(201).json({
      success: true,
      data: {
        issue,
        issueTask: populatedIssueTask,
        subtasks: [],
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, error: 'Issue number already exists' });
    }
    const statusCode = error?.name === 'ValidationError' ? 400 : 500;
    return res.status(statusCode).json({ success: false, error: error.message });
  }
};

module.exports = {
  getIssues,
  getIssueById,
  startIssueWorkflow,
};
