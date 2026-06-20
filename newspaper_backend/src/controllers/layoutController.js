const Layout = require('../models/Layout');
const Template = require('../models/Template');
const mongoose = require('mongoose');

const validateLayoutPayload = (body) => {
  if (!body.templateId) {
    return 'templateId is required';
  }
  if (!body.title) {
    return 'title is required';
  }
  if (!Array.isArray(body.columns)) {
    return 'columns must be an array';
  }
  return null;
};

const populateLayout = (query) => query.populate('templateId', 'name columns headers footers textFlowRules');

const getLayouts = async (req, res) => {
  try {
    const { templateId, issueId, pageNumber, limit = 20 } = req.query;
    const filter = {};
    // Avoid Mongoose casting errors when clients pass placeholder IDs like "default_3col".
    if (templateId) {
      if (!mongoose.isValidObjectId(templateId)) {
        return res.status(400).json({
          success: false,
          error: 'templateId must be a valid Mongo ObjectId',
        });
      }
      filter.templateId = templateId;
    }
    if (issueId) {
      if (!mongoose.isValidObjectId(issueId)) {
        return res.status(400).json({
          success: false,
          error: 'issueId must be a valid Mongo ObjectId',
        });
      }
      filter.issueId = issueId;
    }
    if (pageNumber) filter.pageNumber = pageNumber;
    if (req.query.status) filter.status = req.query.status;

    const layouts = await populateLayout(
      Layout.find(filter)
        .sort({ updatedAt: -1 })
        .limit(Math.min(Number(limit) || 20, 100)),
    );

    res.json({
      success: true,
      count: layouts.length,
      data: layouts,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getLayoutById = async (req, res) => {
  try {
    const layout = await populateLayout(Layout.findById(req.params.id));
    if (!layout) {
      return res.status(404).json({ success: false, error: 'Layout not found' });
    }
    return res.json({ success: true, data: layout });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const createLayout = async (req, res) => {
  try {
    const validationError = validateLayoutPayload(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const template = await Template.findById(req.body.templateId);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const layout = await Layout.create({
      title: req.body.title,
      templateId: req.body.templateId,
      issueId: req.body.issueId || null,
      pageNumber: req.body.pageNumber || null,
      headerContent: req.body.headerContent || template.headers?.content || '',
      footerContent: req.body.footerContent || template.footers?.content || '',
      columns: req.body.columns,
      illustrations: req.body.illustrations || [],
      ads: req.body.ads || [],
      status: req.body.status || 'draft',
      createdBy: req.user.id,
    });

    const populated = await populateLayout(Layout.findById(layout._id));

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const updateLayout = async (req, res) => {
  try {
    const layout = await Layout.findById(req.params.id);
    if (!layout) {
      return res.status(404).json({ success: false, error: 'Layout not found' });
    }

    if (req.body.templateId) {
      const templateExists = await Template.exists({ _id: req.body.templateId });
      if (!templateExists) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      layout.templateId = req.body.templateId;
    }

    if (req.body.title) layout.title = req.body.title;
    if (req.body.issueId !== undefined) layout.issueId = req.body.issueId;
    if (req.body.pageNumber !== undefined) layout.pageNumber = req.body.pageNumber;
    if (req.body.headerContent !== undefined) layout.headerContent = req.body.headerContent;
    if (req.body.footerContent !== undefined) layout.footerContent = req.body.footerContent;
    if (req.body.columns) layout.columns = req.body.columns;
    if (req.body.illustrations !== undefined) layout.illustrations = req.body.illustrations;
    if (req.body.ads !== undefined) layout.ads = req.body.ads;

    // Handle status transitions with role-based validation
    if (req.body.status !== undefined) {
      const newStatus = req.body.status;
      const userRole = req.user.role;

      if (newStatus === 'in_review') {
        if (userRole !== 'layout_designer') {
          return res.status(403).json({ success: false, error: 'Только верстальщик может отправить макет на проверку' });
        }
        if (layout.status !== 'draft') {
          return res.status(400).json({ success: false, error: 'Можно отправить на проверку только макет в статусе draft' });
        }
        layout.status = 'in_review';
        layout.reviewComment = null;
      } else if (newStatus === 'published') {
        if (userRole !== 'chief_editor') {
          return res.status(403).json({ success: false, error: 'Только главред может одобрить макет' });
        }
        if (layout.status !== 'in_review') {
          return res.status(400).json({ success: false, error: 'Можно одобрить только макет в статусе in_review' });
        }
        layout.status = 'published';
        layout.reviewComment = null;
      } else if (newStatus === 'draft' && req.body.reviewComment !== undefined) {
        if (userRole !== 'chief_editor') {
          return res.status(403).json({ success: false, error: 'Только главред может вернуть макет на доработку' });
        }
        if (layout.status !== 'in_review') {
          return res.status(400).json({ success: false, error: 'Можно вернуть на доработку только макет в статусе in_review' });
        }
        if (!req.body.reviewComment || !req.body.reviewComment.trim()) {
          return res.status(400).json({ success: false, error: 'Замечания обязательны при возврате на доработку' });
        }
        layout.status = 'draft';
        layout.reviewComment = req.body.reviewComment.trim();
      } else {
        // Regular status update (e.g. autosave keeping draft status)
        layout.status = newStatus;
      }
    }

    // Handle reviewComment update separately (for non-status-transition updates)
    if (req.body.reviewComment !== undefined && req.body.status === undefined) {
      layout.reviewComment = req.body.reviewComment;
    }

    await layout.save();

    const populated = await populateLayout(Layout.findById(layout._id));

    return res.json({ success: true, data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const deleteLayout = async (req, res) => {
  try {
    const layout = await Layout.findById(req.params.id);
    if (!layout) {
      return res.status(404).json({ success: false, error: 'Layout not found' });
    }
    await layout.deleteOne();
    return res.json({ success: true, data: {} });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getLayouts,
  getLayoutById,
  createLayout,
  updateLayout,
  deleteLayout,
};

