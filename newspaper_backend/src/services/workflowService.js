const Task = require('../models/Task');

const WORKFLOW_STAGES = [
  { stage: 1, role: 'author',          label: 'Автор' },
  { stage: 2, role: 'proofreader',     label: 'Корректор' },
  { stage: 3, role: 'illustrator',     label: 'Иллюстратор' },
  { stage: 4, role: 'chief_editor',    label: 'Главный редактор' },
  { stage: 5, role: 'layout_designer', label: 'Верстальщик' },
];

/**
 * Generates 4 subtasks for an Issue_Task.
 * chief_editor (stage 4) does NOT get a subtask — they manage the process.
 * Stages 1, 2, 3, 5 get subtasks.
 * The first subtask (author, stage=1) is created with status `in_progress`,
 * all others get status `open`.
 *
 * @param {Object} issueTask - The parent Issue_Task document
 * @returns {Promise<Array>} Array of created subtask documents
 */
async function generateSubtasks(issueTask) {
  const existingSubtasks = await Task.find({ parentTaskId: issueTask._id }).sort({ workflowStage: 1 });
  if (existingSubtasks.length > 0) {
    return existingSubtasks;
  }

  const subtaskStages = WORKFLOW_STAGES.filter(({ role }) => role !== 'chief_editor');

  const subtaskDocs = subtaskStages.map(({ stage, role, label }) => ({
    title: role === 'layout_designer'
      ? `Сформировать выпуск: ${issueTask.title}`
      : `${label}: ${issueTask.title}`,
    description: issueTask.description || '',
    deadline: issueTask.deadline,
    parentTaskId: issueTask._id,
    workflowStage: stage,
    isIssueTask: false,
    assigneeRole: role,
    issueId: issueTask.issueId,
    createdBy: issueTask.createdBy,
    status: stage === 1 ? 'in_progress' : 'open',
  }));

  const subtasks = await Task.insertMany(subtaskDocs);
  return subtasks;
}

/**
 * Validates whether a status transition is allowed for the given role.
 * For non-chief_editor roles: if the task has a parentTaskId and workflowStage > 1,
 * checks that the previous stage subtask (workflowStage - 1) has status `done`.
 * chief_editor is always allowed.
 *
 * @param {Object} task - The task document being updated
 * @param {string} newStatus - The target status
 * @param {string} userRole - The role of the user making the request
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
async function validateWorkflowTransition(task, newStatus, userRole) {
  if (userRole === 'chief_editor') {
    return { allowed: true };
  }

  // layout_designer is not blocked by workflow — they work independently
  if (userRole === 'layout_designer') {
    return { allowed: true };
  }

  if (task.parentTaskId && task.workflowStage > 1) {
    const siblings = await Task.find({ parentTaskId: task.parentTaskId });
    const prevSubtask = siblings
      .filter(s => s.workflowStage < task.workflowStage)
      .sort((a, b) => b.workflowStage - a.workflowStage)[0];

    if (!prevSubtask || prevSubtask.status !== 'done') {
      return { allowed: false, reason: 'Previous workflow stage is not completed' };
    }
  }

  return { allowed: true };
}

/**
 * Advances the workflow after a subtask transitions to `done`.
 * Finds the next subtask (workflowStage + 1 of the done subtask) and sets it to `in_progress`.
 * Then checks if ALL subtasks of parentTaskId are `done` — if so, sets the Issue_Task to `done`.
 *
 * @param {string|Object} parentTaskId - The _id of the parent Issue_Task
 * @returns {Promise<void>}
 */
async function advanceWorkflow(parentTaskId) {
  const subtasks = await Task.find({ parentTaskId });

  if (!subtasks || subtasks.length === 0) {
    return;
  }

  // Find the subtask that was just completed (done) and has the highest stage among done tasks
  // to determine which stage to activate next
  const doneSubtasks = subtasks.filter((s) => s.status === 'done');
  const openSubtasks = subtasks.filter((s) => s.status === 'open');

  // Find the next subtask to activate: the open subtask with the lowest workflowStage
  // that comes after the highest completed stage
  if (openSubtasks.length > 0) {
    // Sort open subtasks by workflowStage ascending
    openSubtasks.sort((a, b) => a.workflowStage - b.workflowStage);

    // The next subtask to activate is the one with the lowest workflowStage among open ones
    // but only if all stages before it are done
    const nextSubtask = openSubtasks[0];

    // Check that all stages before nextSubtask are done
    const stagesBefore = subtasks.filter(
      (s) => s.workflowStage < nextSubtask.workflowStage,
    );
    const allPreviousDone = stagesBefore.every((s) => s.status === 'done');

    if (allPreviousDone && nextSubtask.status === 'open') {
      await Task.findByIdAndUpdate(nextSubtask._id, { status: 'in_progress' });
    }
  }

  // Check if ALL subtasks are done — if so, close the Issue_Task
  const allDone = subtasks.every((s) => s.status === 'done');
  if (allDone) {
    await Task.findByIdAndUpdate(parentTaskId, { status: 'done' });
  }
}

module.exports = {
  WORKFLOW_STAGES,
  generateSubtasks,
  validateWorkflowTransition,
  advanceWorkflow,
};
