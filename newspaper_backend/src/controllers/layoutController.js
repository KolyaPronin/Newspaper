const Layout = require('../models/Layout');
const Template = require('../models/Template');

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
    if (templateId) filter.templateId = templateId;
    if (issueId) filter.issueId = issueId;
    if (pageNumber) filter.pageNumber = pageNumber;

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
    if (req.body.status) layout.status = req.body.status;

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

