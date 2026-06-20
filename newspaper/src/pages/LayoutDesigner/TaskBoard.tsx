import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { taskAPI, transformTask } from '../../utils/api';
import { Task, TaskStatus } from '../../types/Task';
import { UserRole } from '../../types/User';

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.AUTHOR]: 'Авторы',
  [UserRole.PROOFREADER]: 'Корректоры',
  [UserRole.ILLUSTRATOR]: 'Иллюстраторы',
  [UserRole.LAYOUT_DESIGNER]: 'Верстальщики',
  [UserRole.CHIEF_EDITOR]: 'Главный редактор',
};

const toDateInputValue = (d: Date | null): string => {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const fromDateInputValue = (value: string): string | null => {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
};

const TaskBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formDeadline, setFormDeadline] = useState<string>('');
  const [formAssigneeRole, setFormAssigneeRole] = useState<UserRole | ''>('');
  const [formStatus, setFormStatus] = useState<TaskStatus>('open');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rawTasks = await taskAPI.getTasks({ limit: 200 });
      setTasks(rawTasks.map(transformTask));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const openCreate = () => {
    setEditing(null);
    setFormTitle('');
    setFormDescription('');
    setFormDeadline('');
    setFormAssigneeRole('');
    setFormStatus('open');
    setIsModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormDeadline(toDateInputValue(task.deadline));
    setFormAssigneeRole(task.assigneeRole || '');
    setFormStatus(task.status);
    setIsModalOpen(true);
  };

  const closeModal = () => { if (!saving) setIsModalOpen(false); };

  const submit = async () => {
    if (!formTitle.trim()) { setError('Введите название задачи'); return; }
    if (!formAssigneeRole) { setError('Выберите роль исполнителя'); return; }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription,
        deadline: fromDateInputValue(formDeadline),
        assigneeUserId: null,
        assigneeRole: formAssigneeRole as UserRole,
        status: formStatus,
      };
      if (editing) {
        await taskAPI.updateTask(editing.id, payload);
      } else {
        await taskAPI.createTask(payload);
      }
      setIsModalOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (task: Task) => {
    if (!window.confirm(`Удалить задачу "${task.title}"?`)) return;
    setError(null);
    try {
      await taskAPI.deleteTask(task.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  // Group tasks by role for display
  const tasksByRole = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(t => {
      const key = t.assigneeRole || 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [tasks]);

  return (
    <div className="task-board">
      <div className="task-board-bar">
        <div className="task-board-title">
          <h2>Доска задач</h2>
          <p>Создавайте и назначайте задачи по ролям</p>
        </div>
        <div className="task-board-actions">
          <button type="button" className="btn btn-auto" onClick={() => void refresh()} disabled={loading || saving}>
            Обновить
          </button>
          <button type="button" className="btn btn-auto" onClick={openCreate} disabled={loading || saving}>
            + Новая задача
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="layout-page-area">
        {loading ? (
          <div className="empty-state"><p className="empty-state-title">Загрузка...</p></div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">Нет задач</p>
            <p className="empty-state-text">Создайте первую задачу для выпуска.</p>
          </div>
        ) : (
          <div className="task-table">
            <div className="task-table-header">
              <div>Задача</div>
              <div>Роль</div>
              <div>Дедлайн</div>
              <div>Статус</div>
              <div />
            </div>
            {tasks.map(t => (
              <div className="task-table-row" key={t.id}>
                <div className="task-cell-title">
                  <div className="task-title">{t.title}</div>
                  {t.description ? <div className="task-desc">{t.description}</div> : null}
                </div>
                <div className="task-role-badge">
                  {t.assigneeRole ? ROLE_LABEL[t.assigneeRole] ?? t.assigneeRole : '—'}
                </div>
                <div className="task-deadline">
                  {t.deadline ? toDateInputValue(t.deadline) : '—'}
                </div>
                <div>
                  <span className={`task-status task-status-${t.status}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
                <div className="task-row-actions">
                  <button type="button" className="btn btn-small btn-auto" onClick={() => openEdit(t)} disabled={saving}>
                    Изменить
                  </button>
                  <button type="button" className="btn btn-small btn-auto task-danger" onClick={() => void remove(t)} disabled={saving}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="task-modal-backdrop" onClick={closeModal}>
          <div className="task-modal" onClick={e => e.stopPropagation()}>
            <div className="task-modal-header">
              <h3>{editing ? 'Редактировать задачу' : 'Новая задача'}</h3>
            </div>

            <div className="task-form">
              <label className="template-select-label">
                Название
                <input
                  className="template-select"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  disabled={saving}
                  placeholder="Например: написать статью о событии"
                />
              </label>

              <label className="template-select-label">
                Описание
                <textarea
                  className="template-select task-textarea"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  disabled={saving}
                  placeholder="Подробности задачи (необязательно)"
                />
              </label>

              <div className="task-form-grid">
                <label className="template-select-label">
                  Роль исполнителя
                  <select
                    className="template-select"
                    value={formAssigneeRole}
                    onChange={e => setFormAssigneeRole((e.target.value as UserRole) || '')}
                    disabled={saving}
                  >
                    <option value="">— выберите роль —</option>
                    {Object.values(UserRole).map(role => (
                      <option key={role} value={role}>{ROLE_LABEL[role]}</option>
                    ))}
                  </select>
                </label>

                <label className="template-select-label">
                  Дедлайн
                  <input
                    type="date"
                    className="template-select"
                    value={formDeadline}
                    onChange={e => setFormDeadline(e.target.value)}
                    disabled={saving}
                  />
                </label>
              </div>

              <label className="template-select-label">
                Статус
                <select
                  className="template-select"
                  value={formStatus}
                  onChange={e => setFormStatus(e.target.value as TaskStatus)}
                  disabled={saving}
                >
                  {(Object.keys(STATUS_LABEL) as TaskStatus[]).map(k => (
                    <option key={k} value={k}>{STATUS_LABEL[k]}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="task-modal-footer">
              <button type="button" className="btn btn-auto" onClick={closeModal} disabled={saving}>
                Отмена
              </button>
              <button type="button" className="btn btn-auto" onClick={() => void submit()} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskBoard;
