const Task = require('../models/Task');
const mongoose = require('mongoose');
const taskService = require('../services/taskService');
const {
  validateWorkflowTransition,
  advanceWorkflow,
} = require('../services/workflowService');

const applyTaskPopulates = (query) => query
  .populate('issueId', 'number publicationDate title pageCount layoutNotes templateId assignedLayoutDesignerId')
  .populate('createdBy', 'username email role')
  .populate('assigneeUserId', 'username email role')
  .populate('assignedProofreaderId', 'username email role')
  .populate('assignedIllustratorId', 'username email role')
  .populate('articleId', 'title status')
  .populate('parentTaskId', 'title status workflowStage issueId');

const isPrivileged = (req) => req.user?.role === 'chief_editor';

const assertMongoObjectId = (label, value) => {
  if (!value) {
    return null;
  }

  const str = String(value).trim();
  if (!str) {
    return null;
  }

  if (!mongoose.isValidObjectId(str)) {
    const error = new Error(`${label} must be a Mongo ObjectId (24 hex chars)`);
    error.statusCode = 400;
    throw error;
  }

  return str;
};

const buildVisibilityFilter = (req) => {
  if (isPrivileged(req)) {
    return {};
  }

  // Non-privileged users can only see tasks assigned to them or their role.
  return {
    $or: [
      { assigneeUserId: req.user.id },
      { assigneeRole: req.user.role },
    ],
  };
};

const buildQueryFilter = (req) => {
  const visibility = buildVisibilityFilter(req);
  const andParts = [];
  const {
    issueId,
    assigneeUserId,
    assigneeRole,
    status,
    createdBy,
    isIssueTask,
    parentTaskId,
  } = req.query || {};

  if (Object.keys(visibility).length > 0) {
    andParts.push(visibility);
  }

  if (issueId) {
    const safeIssueId = assertMongoObjectId('issueId', issueId);
    andParts.push({ issueId: safeIssueId });
  }
  if (assigneeUserId) {
    const safeAssigneeUserId = assertMongoObjectId('assigneeUserId', assigneeUserId);
    andParts.push({ assigneeUserId: safeAssigneeUserId });
  }
  if (assigneeRole) andParts.push({ assigneeRole });
  if (status) andParts.push({ status });
  if (isIssueTask !== undefined) andParts.push({ isIssueTask: String(isIssueTask) === 'true' });
  if (parentTaskId) {
    const safeParentTaskId = assertMongoObjectId('parentTaskId', parentTaskId);
    andParts.push({ parentTaskId: safeParentTaskId });
  }

  if (createdBy) {
    // Only privileged users can filter by createdBy.
    if (isPrivileged(req)) {
      const safeCreatedBy = assertMongoObjectId('createdBy', createdBy);
      andParts.push({ createdBy: safeCreatedBy });
    }
  }

  if (andParts.length === 0) {
    return {};
  }
  if (andParts.length === 1) {
    return andParts[0];
  }
  return { $and: andParts };
};

const getTasks = async (req, res) => {
  try {
    let filter;
    try {
      filter = buildQueryFilter(req);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      return res.status(statusCode).json({
        success: false,
        error: error.message,
      });
    }
    const { limit = 50 } = req.query || {};

    const tasks = await applyTaskPopulates(Task.find(filter))
      .sort({ updatedAt: -1 })
      .limit(Math.min(Number(limit) || 50, 200));

    return res.json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const getTaskById = async (req, res) => {
  try {
    const baseVisibility = buildVisibilityFilter(req);
    const task = await applyTaskPopulates(Task.findOne({ _id: req.params.id, ...baseVisibility }));

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    return res.json({ success: true, data: task });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      deadline,
      issueId,
      assigneeUserId,
      assigneeRole,
      status,
      isIssueTask,
      parentTaskId,
      articleId,
      assignedProofreaderId,
      assignedIllustratorId,
    } = req.body || {};

    if (!title) {
      return res.status(400).json({ success: false, error: 'title is required' });
    }

    const safeIssueId = issueId ? assertMongoObjectId('issueId', issueId) : null;
    const safeAssigneeUserId = assigneeUserId ? assertMongoObjectId('assigneeUserId', assigneeUserId) : null;
    const safeParentTaskId = parentTaskId ? assertMongoObjectId('parentTaskId', parentTaskId) : null;
    const safeArticleId = articleId ? assertMongoObjectId('articleId', articleId) : null;
    const safeProofreaderId = assignedProofreaderId
      ? assertMongoObjectId('assignedProofreaderId', assignedProofreaderId)
      : null;
    const safeIllustratorId = assignedIllustratorId
      ? assertMongoObjectId('assignedIllustratorId', assignedIllustratorId)
      : null;
    const issueTaskFlag = Boolean(isIssueTask);

    if (safeParentTaskId) {
      if (issueTaskFlag) {
        return res.status(400).json({
          success: false,
          error: 'Issue tasks cannot have a parentTaskId',
        });
      }

      const parent = await Task.findById(safeParentTaskId);
      if (!parent || !parent.isIssueTask) {
        return res.status(400).json({
          success: false,
          error: 'parentTaskId must reference an active issue task',
        });
      }

      if (!assigneeRole && !safeAssigneeUserId) {
        return res.status(400).json({
          success: false,
          error: 'assigneeRole or assigneeUserId is required for subtasks',
        });
      }

      const task = await Task.create({
        title,
        description: description || '',
        deadline: deadline ? new Date(deadline) : null,
        issueId: parent.issueId,
        parentTaskId: parent._id,
        articleId: safeArticleId,
        assignedProofreaderId: assigneeRole === 'author' ? safeProofreaderId : null,
        assignedIllustratorId: assigneeRole === 'author' ? safeIllustratorId : null,
        createdBy: req.user.id,
        assigneeUserId: safeAssigneeUserId,
        assigneeRole: assigneeRole || null,
        status: status || 'open',
        isIssueTask: false,
        workflowStage: null,
        isAutoGenerated: false,
      });

      const populated = await applyTaskPopulates(Task.findById(task._id));
      return res.status(201).json({ success: true, data: populated });
    }

    if (issueTaskFlag && !safeIssueId) {
      return res.status(400).json({ success: false, error: 'issueId is required for issue tasks' });
    }

    if (issueTaskFlag) {
      if (safeAssigneeUserId || assigneeRole) {
        return res.status(400).json({
          success: false,
          error: 'Issue tasks must not have assigneeUserId or assigneeRole',
        });
      }
      const existingIssueTask = await Task.findOne({
        issueId: safeIssueId,
        isIssueTask: true,
        status: { $nin: ['done', 'cancelled'] },
      });
      if (existingIssueTask) {
        return res.status(409).json({
          success: false,
          error: 'An active issue task already exists for this issue',
        });
      }
    }

    const task = await Task.create({
      title,
      description: description || '',
      deadline: deadline ? new Date(deadline) : null,
      issueId: safeIssueId,
      createdBy: req.user.id,
      assigneeUserId: issueTaskFlag ? null : safeAssigneeUserId,
      assigneeRole: issueTaskFlag ? null : (assigneeRole || null),
      status: status || (issueTaskFlag ? 'in_progress' : 'open'),
      isIssueTask: issueTaskFlag,
    });

    const populated = await applyTaskPopulates(Task.findById(task._id));

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    const statusCode = error.statusCode || (error?.name === 'ValidationError' ? 400 : 500);
    return res.status(statusCode).json({ success: false, error: error.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const privileged = isPrivileged(req);
    const prevStatus = task.status;
    const requestedStatus = req.body?.status;

    if (!privileged) {
      // Non-privileged users: allow only status update on tasks visible to them.
      const visible = (
        (task.assigneeUserId && task.assigneeUserId.toString() === req.user.id) ||
        (task.assigneeRole && task.assigneeRole === req.user.role)
      );

      if (!visible) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }

      if (requestedStatus) {
        const transition = await validateWorkflowTransition(task, requestedStatus, req.user.role);
        if (!transition.allowed) {
          return res.status(400).json({
            success: false,
            error: transition.reason || 'Workflow transition is not allowed',
          });
        }
        task.status = requestedStatus;
      }
    } else {
      const {
        title,
        description,
        deadline,
        issueId,
        assigneeUserId,
        assigneeRole,
        status,
      } = req.body || {};

      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (deadline !== undefined) task.deadline = deadline ? new Date(deadline) : null;
      if (issueId !== undefined) {
        task.issueId = issueId ? assertMongoObjectId('issueId', issueId) : null;
      }
      if (assigneeUserId !== undefined) {
        task.assigneeUserId = task.isIssueTask
          ? null
          : (assigneeUserId ? assertMongoObjectId('assigneeUserId', assigneeUserId) : null);
      }
      if (assigneeRole !== undefined) task.assigneeRole = task.isIssueTask ? null : (assigneeRole || null);
      if (status !== undefined) {
        const transition = await validateWorkflowTransition(task, status, req.user.role);
        if (!transition.allowed) {
          return res.status(400).json({
            success: false,
            error: transition.reason || 'Workflow transition is not allowed',
          });
        }
        task.status = status;
      }
    }

    await task.save();

    if (prevStatus !== 'done' && task.status === 'done') {
      if (
        !task.isIssueTask &&
        !task.isAutoGenerated &&
        task.assigneeRole === 'author' &&
        task.issueId
      ) {
        await taskService.onAuthorTaskMarkedDone(task, req.user.id);
      } else if (
        task.isAutoGenerated &&
        task.assigneeRole === 'proofreader' &&
        task.issueId
      ) {
        await taskService.onProofreaderTaskMarkedDone(task, req.user.id);
      } else if (
        task.assigneeRole === 'illustrator' &&
        task.issueId
      ) {
        await taskService.onIllustratorTaskMarkedDone(task, req.user.id);
      } else if (task.parentTaskId && task.workflowStage != null) {
        await advanceWorkflow(task.parentTaskId);
      }
    }

    const populated = await applyTaskPopulates(Task.findById(task._id));

    return res.json({ success: true, data: populated });
  } catch (error) {
    const statusCode = error.statusCode || (error?.name === 'ValidationError' ? 400 : 500);
    return res.status(statusCode).json({ success: false, error: error.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    if (task.isIssueTask) {
      await Task.deleteMany({ parentTaskId: task._id });
    } else if (task.parentTaskId) {
      await Task.deleteMany({ parentTaskId: task._id });
    }

    await task.deleteOne();
    return res.json({ success: true, data: {} });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
};

