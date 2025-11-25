const Template = require('../models/Template');

const buildTemplatePayload = (body, userId) => ({
  name: body.name,
  description: body.description,
  columns: body.columns,
  adSlots: body.adSlots || [],
  illustrationPositions: body.illustrationPositions || [],
  margins: body.margins,
  headers: body.headers,
  footers: body.footers,
  textFlowRules: body.textFlowRules,
  createdBy: userId || null,
});

const getTemplates = async (_req, res) => {
  try {
    const templates = await Template.find().sort({ updatedAt: -1 });
    res.json({
      success: true,
      count: templates.length,
      data: templates,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getTemplateById = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    return res.json({ success: true, data: template });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const createTemplate = async (req, res) => {
  try {
    if (!req.body?.name || !req.body?.columns || !req.body?.margins || !req.body?.headers || !req.body?.footers || !req.body?.textFlowRules) {
      return res.status(400).json({
        success: false,
        error: 'name, columns, margins, headers, footers and textFlowRules are required',
      });
    }
    const template = await Template.create(buildTemplatePayload(req.body, req.user?.id));
    return res.status(201).json({ success: true, data: template });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    Object.assign(template, buildTemplatePayload({
      ...template.toObject(),
      ...req.body,
    }, template.createdBy));

    await template.save();

    return res.json({ success: true, data: template });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    await template.deleteOne();
    return res.json({ success: true, data: {} });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
};

