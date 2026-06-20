const express = require('express');
const {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
} = require('../controllers/taskController');
const { authenticate, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);

router.route('/')
  .get(getTasks)
  .post(requireRoles('chief_editor'), createTask);

router.route('/:id')
  .get(getTaskById)
  .put(updateTask)
  .delete(requireRoles('chief_editor'), deleteTask);

module.exports = router;
