import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { taskAPI, transformTask } from '../../utils/api';
import type { Task, TaskStatus } from '../../types/Task';

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Новая',
  in_progress: 'В работе',
  done: 'Готово',
  cancelled: 'Отменена',
};

const STATUS_ICONS: Record<TaskStatus, string> = {
  open: '⬜',
  in_progress: '▶',
  done: '✅',
  cancelled: '❌',
};

const STATUS_ORDER: TaskStatus[] = ['open', 'in_progress', 'done', 'cancelled'];

const toDateDisplay = (d: Date | null): string => {
  if (!d) return '-';
  try {
    return d.toLocaleDateString('ru-RU');
  } catch {
    return '-';
  }
};

const MyTasksPanel: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await taskAPI.getTasks({ limit: 200 });
      setTasks(raw.map(transformTask));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tasks';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Auto-refresh every 30s so deletions/updates by chief editor are reflected
  useEffect(() => {
    const interval = setInterval(() => { void refresh(); }, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [tasks]);

  const onStatusChange = async (taskId: string, next: TaskStatus) => {
    setSavingId(taskId);
    setError(null);
    try {
      await taskAPI.updateTask(taskId, { status: next });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update task';
      setError(message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="my-tasks-panel">
      <div className="my-tasks-header">
        <div>
          <h2>Мои задачи</h2>
          <p>Здесь отображаются задачи, назначенные на вас или вашу роль.</p>
        </div>
        <button type="button" className="btn btn-auto" onClick={() => void refresh()} disabled={loading || !!savingId}>
          Обновить
        </button>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      <div className="layout-page-area">
        {loading ? (
          <div className="empty-state">
            <p className="empty-state-title">Загрузка...</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">Нет задач</p>
            <p className="empty-state-text">Когда главный редактор назначит задачу вашей роли, она появится здесь.</p>
          </div>
        ) : (
          <div className="task-table">
            <div className="task-table-header my-tasks-row">
              <div>Название</div>
              <div>Дедлайн</div>
              <div>Статус</div>
            </div>
            {sorted.map(t => (
              <div className="task-table-row my-tasks-row" key={t.id}>
                <div className="task-cell-title">
                  <div className="task-title">{t.title}</div>
                  {t.description ? <div className="task-desc">{t.description}</div> : null}
                  {t.assigneeUsername && (
                    <div className="task-card-assignee">👤 {t.assigneeUsername}</div>
                  )}
                </div>
                <div>{toDateDisplay(t.deadline)}</div>
                <div className="my-tasks-status-cell">
                  <select
                    className="template-select my-tasks-status-select"
                    value={t.status}
                    onChange={e => void onStatusChange(t.id, e.target.value as TaskStatus)}
                    disabled={savingId === t.id}
                  >
                    {STATUS_ORDER.map(s => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTasksPanel;
