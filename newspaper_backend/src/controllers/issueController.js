const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const Task = require('../models/Task');
const Article = require('../models/Article');
const User = require('../models/User');
const Template = require('../models/Template');

const getNextIssueNumber = async () => {
  const latest = await Issue.findOne().sort({ number: -1 }).select('number');
  return latest ? latest.number + 1 : 1;
};

const assertObjectId = (label, value) => {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (!mongoose.isValidObjectId(str)) {
    const error = new Error(`${label} must be a valid id`);
    error.statusCode = 400;
    throw error;
  }
  return str;
};

const getIssues = async (req, res) => {
  try {
    const { status, limit = 50 } = req.query || {};
    const filter = {};
    if (status) filter.status = status;

    const issues = await Issue.find(filter)
      .populate('templateId', 'name columns')
      .populate('assignedLayoutDesignerId', 'username role')
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
    const issue = await Issue.findById(req.params.id)
      .populate('templateId', 'name columns')
      .populate('assignedLayoutDesignerId', 'username role');
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }
    return res.json({ success: true, data: issue });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const validateArticlePlan = async (plan, fieldPrefix = 'article') => {
  const title = plan?.title ? String(plan.title).trim() : '';
  if (!title) {
    const error = new Error(`${fieldPrefix}.title is required`);
    error.statusCode = 400;
    throw error;
  }

  const authorId = assertObjectId(`${fieldPrefix}.authorId`, plan?.authorId);
  const proofreaderId = assertObjectId(`${fieldPrefix}.proofreaderId`, plan?.proofreaderId);
  const illustratorId = assertObjectId(`${fieldPrefix}.illustratorId`, plan?.illustratorId);
  if (!authorId || !proofreaderId || !illustratorId) {
    const error = new Error(`${fieldPrefix} requires authorId, proofreaderId and illustratorId`);
    error.statusCode = 400;
    throw error;
  }

  const [author, proofreader, illustrator] = await Promise.all([
    User.findById(authorId).select('role'),
    User.findById(proofreaderId).select('role'),
    User.findById(illustratorId).select('role'),
  ]);

  if (!author || author.role !== 'author') {
    const error = new Error(`${fieldPrefix}.authorId must reference a user with role author`);
    error.statusCode = 400;
    throw error;
  }
  if (!proofreader || proofreader.role !== 'proofreader') {
    const error = new Error(`${fieldPrefix}.proofreaderId must reference a user with role proofreader`);
    error.statusCode = 400;
    throw error;
  }
  if (!illustrator || illustrator.role !== 'illustrator') {
    const error = new Error(`${fieldPrefix}.illustratorId must reference a user with role illustrator`);
    error.statusCode = 400;
    throw error;
  }

  let articleDeadline = null;
  if (plan?.deadline) {
    articleDeadline = new Date(plan.deadline);
    if (Number.isNaN(articleDeadline.getTime())) {
      const error = new Error(`${fieldPrefix}.deadline is invalid`);
      error.statusCode = 400;
      throw error;
    }
  }

  return {
    title,
    authorId,
    proofreaderId,
    illustratorId,
    description: plan?.description ? String(plan.description).trim() : '',
    deadline: articleDeadline,
  };
};

const validateLayoutDesignerId = async (layoutDesignerId) => {
  const safeId = layoutDesignerId ? assertObjectId('layoutDesignerId', layoutDesignerId) : null;
  if (!safeId) return null;

  const user = await User.findById(safeId).select('role');
  if (!user || user.role !== 'layout_designer') {
    const error = new Error('layoutDesignerId must reference a user with role layout_designer');
    error.statusCode = 400;
    throw error;
  }
  return safeId;
};

const findActiveIssueTask = async (issueId) => Task.findOne({
  issueId,
  isIssueTask: true,
  status: { $nin: ['done', 'cancelled'] },
});

const uploadIssuePdf = async (req, res) => {
  try {
    const issueId = assertObjectId('id', req.params.id);
    if (!issueId) {
      return res.status(400).json({ success: false, error: 'Invalid issue id' });
    }

    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'PDF file is required' });
    }

    const relativePath = `exports/${req.file.filename}`;
    issue.pdfPath = relativePath;
    await issue.save();

    return res.json({
      success: true,
      data: {
        issueId: issue._id,
        pdfPath: issue.pdfPath,
        pdfUrl: `/uploads/${issue.pdfPath}`,
      },
    });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({ success: false, error: error.message });
  }
};

const createAuthorArticleTask = async ({ issue, issueTask, plan, createdBy }) => {
  const article = await Article.create({
    title: plan.title,
    content: '<p></p>',
    status: 'draft',
    authorId: plan.authorId,
    issueId: issue._id,
  });

  const authorTask = await Task.create({
    title: `Написать: ${plan.title}`,
    description: plan.description,
    deadline: plan.deadline || issueTask.deadline || null,
    issueId: issue._id,
    parentTaskId: issueTask._id,
    articleId: article._id,
    assignedProofreaderId: plan.proofreaderId,
    assignedIllustratorId: plan.illustratorId,
    createdBy,
    assigneeUserId: plan.authorId,
    assigneeRole: 'author',
    status: 'in_progress',
    isIssueTask: false,
    isAutoGenerated: false,
  });

  return { article, authorTask };
};

const populateAuthorTask = (taskId) => Task.findById(taskId)
  .populate('assigneeUserId', 'username email role')
  .populate('assignedProofreaderId', 'username email role')
  .populate('assignedIllustratorId', 'username email role')
  .populate('articleId', 'title status');

/**
 * Creates Issue + parent issue task + article author tasks from the editorial plan.
 */
const startIssueWorkflow = async (req, res) => {
  try {
    const {
      title,
      description,
      deadline,
      publicationDate,
      number,
      templateId,
      pageCount,
      layoutNotes,
      layoutDesignerId,
      articles,
    } = req.body || {};

    const issueTitle = title ? String(title).trim() : '';
    if (!issueTitle) {
      return res.status(400).json({ success: false, error: 'title is required' });
    }

    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'articles must be a non-empty array',
      });
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

    let issueDeadline = null;
    if (deadline) {
      issueDeadline = new Date(deadline);
      if (Number.isNaN(issueDeadline.getTime())) {
        return res.status(400).json({ success: false, error: 'deadline is invalid' });
      }
    }

    const safeTemplateId = templateId ? assertObjectId('templateId', templateId) : null;
    if (safeTemplateId) {
      const template = await Template.findById(safeTemplateId);
      if (!template) {
        return res.status(400).json({ success: false, error: 'templateId not found' });
      }
    }

    const parsedPageCount = pageCount !== undefined && pageCount !== null && pageCount !== ''
      ? Number(pageCount)
      : null;
    if (parsedPageCount !== null && (!Number.isFinite(parsedPageCount) || parsedPageCount < 1)) {
      return res.status(400).json({ success: false, error: 'pageCount must be a positive integer' });
    }

    const safeLayoutDesignerId = await validateLayoutDesignerId(layoutDesignerId);
    const articlePlans = await Promise.all(
      articles.map((plan, index) => validateArticlePlan(plan, `articles[${index}]`)),
    );

    const issue = await Issue.create({
      number: issueNumber,
      publicationDate: pubDate,
      title: issueTitle,
      status: 'in_progress',
      templateId: safeTemplateId,
      pageCount: parsedPageCount,
      layoutNotes: layoutNotes ? String(layoutNotes).trim() : '',
      assignedLayoutDesignerId: safeLayoutDesignerId,
    });

    const issueTaskTitle = `Выпуск №${issue.number}${issue.title ? ` — ${issue.title}` : ''}`;

    const issueTask = await Task.create({
      title: issueTaskTitle,
      description: description || '',
      deadline: issueDeadline,
      issueId: issue._id,
      createdBy: req.user.id,
      assigneeUserId: null,
      assigneeRole: null,
      status: 'in_progress',
      isIssueTask: true,
    });

    const authorTasks = [];
    for (const plan of articlePlans) {
      const { authorTask } = await createAuthorArticleTask({
        issue,
        issueTask,
        plan,
        createdBy: req.user.id,
      });
      authorTasks.push(authorTask);
    }

    const populatedIssueTask = await Task.findById(issueTask._id)
      .populate('issueId', 'number publicationDate title templateId pageCount layoutNotes assignedLayoutDesignerId');

    const populatedAuthorTasks = await Task.find({
      _id: { $in: authorTasks.map((t) => t._id) },
    })
      .populate('assigneeUserId', 'username email role')
      .populate('assignedProofreaderId', 'username email role')
      .populate('assignedIllustratorId', 'username email role')
      .populate('articleId', 'title status');

    return res.status(201).json({
      success: true,
      data: {
        issue,
        issueTask: populatedIssueTask,
        subtasks: populatedAuthorTasks,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, error: 'Issue number already exists' });
    }
    const statusCode = error?.statusCode || (error?.name === 'ValidationError' ? 400 : 500);
    return res.status(statusCode).json({ success: false, error: error.message });
  }
};

/**
 * Adds an article draft + author task to an existing issue.
 */
const addIssueArticle = async (req, res) => {
  try {
    const issueId = assertObjectId('id', req.params.id);
    if (!issueId) {
      return res.status(400).json({ success: false, error: 'Invalid issue id' });
    }

    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }

    const issueTask = await findActiveIssueTask(issueId);
    if (!issueTask) {
      return res.status(404).json({ success: false, error: 'Active issue task not found for this issue' });
    }

    const plan = await validateArticlePlan(req.body, 'article');
    const { article, authorTask } = await createAuthorArticleTask({
      issue,
      issueTask,
      plan,
      createdBy: req.user.id,
    });

    const populatedTask = await populateAuthorTask(authorTask._id);

    return res.status(201).json({
      success: true,
      data: {
        article,
        task: populatedTask,
      },
    });
  } catch (error) {
    const statusCode = error?.statusCode || (error?.name === 'ValidationError' ? 400 : 500);
    return res.status(statusCode).json({ success: false, error: error.message });
  }
};

module.exports = {
  getIssues,
  getIssueById,
  startIssueWorkflow,
  addIssueArticle,
  uploadIssuePdf,
};
