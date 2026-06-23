import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { taskAPI, transformTask } from '../../utils/api';
import type { Task, TaskStatus } from '../../types/Task';

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Новая',
  in_progress: 'В работе',
  done: 'Готово',
  cancelled: 'Отменена',
};

const STATUS_ORDER: TaskStatus[] = ['open', 'in_progress', 'done', 'cancelled'];

const toDateDisplay = (d: Date | null): string => {
  if (!d) return '';
  try { return d.toLocaleDateString('ru-RU'); } catch { return ''; }
};

const isOverdue = (d: Date | null): boolean => {
  if (!d) return false;
  return d < new Date();
};

interface IssueTaskGroup {
  issueId: string;
  label: string;
  parentTitle: string | null;
  tasks: Task[];
}

interface MyTasksPageProps {
  onTasksLoaded?: (count: number) => void;
  onOpenArticle?: (articleId: string) => void | Promise<void>;
  variant?: 'default' | 'layout';
}

const MyTasksPage: React.FC<MyTasksPageProps> = ({ onTasksLoaded, onOpenArticle, variant = 'default' }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [openingArticle, setOpeningArticle] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await taskAPI.getTasks({ limit: 200 });
      const loaded = raw
        .map(transformTask)
        .filter((task) => !task.isIssueTask);
      setTasks(loaded);
      onTasksLoaded?.(loaded.filter(t => t.status !== 'done' && t.status !== 'cancelled').length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить задачи');
    } finally {
      setLoading(false);
    }
  }, [onTasksLoaded]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const interval = setInterval(() => { void refresh(); }, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!selectedTask) return;
    const updated = tasks.find((t) => t.id === selectedTask.id);
    if (!updated) {
      setSelectedTask(null);
      return;
    }
    if (updated.updatedAt.getTime() !== selectedTask.updatedAt.getTime()
      || updated.status !== selectedTask.status
      || updated.description !== selectedTask.description) {
      setSelectedTask(updated);
    }
  }, [tasks, selectedTask]);

  useEffect(() => {
    if (!selectedTask) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selectedTask]);

  const onStatusChange = async (taskId: string, next: TaskStatus) => {
    setSavingId(taskId);
    setError(null);
    try {
      await taskAPI.updateTask(taskId, { status: next });
      await refresh();
      setSelectedTask((prev) => (prev && prev.id === taskId ? { ...prev, status: next } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить задачу');
    } finally {
      setSavingId(null);
    }
  };

  const handleOpenArticle = async () => {
    if (!selectedTask?.articleId || !onOpenArticle) return;
    setOpeningArticle(true);
    setError(null);
    try {
      await onOpenArticle(selectedTask.articleId);
      setSelectedTask(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть статью');
    } finally {
      setOpeningArticle(false);
    }
  };

  const formatIssueLabel = (task: Task): string | null => {
    if (!task.issueInfo) return null;
    const num = task.issueInfo.number;
    const title = task.issueInfo.title;
    if (num !== undefined) {
      return `Выпуск №${num}${title ? ` · ${title}` : ''}`;
    }
    return title || null;
  };

  const { issueGroups, orphanTasks } = useMemo(() => {
    const map = new Map<string, IssueTaskGroup>();
    const orphans: Task[] = [];

    tasks.forEach((task) => {
      if (!task.issueId) {
        orphans.push(task);
        return;
      }

      const key = task.issueId;
      if (!map.has(key)) {
        const num = task.issueInfo?.number;
        const issueTitle = task.issueInfo?.title;
        const label = num !== undefined
          ? `Выпуск №${num}${issueTitle ? ` · ${issueTitle}` : ''}`
          : (issueTitle || 'Выпуск');
        map.set(key, {
          issueId: key,
          label,
          parentTitle: task.parentTaskInfo?.title ?? null,
          tasks: [],
        });
      }
      map.get(key)!.tasks.push(task);
    });

    const groups = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    groups.forEach((g) => {
      g.tasks.sort((a, b) => {
        const order = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
        if (order !== 0) return order;
        return a.title.localeCompare(b.title, 'ru');
      });
    });

    return { issueGroups: groups, orphanTasks: orphans };
  }, [tasks]);

  if (loading) {
    return (
      <div className="my-tasks-page">
        <div className="empty-state"><p className="empty-state-title">Загрузка...</p></div>
      </div>
    );
  }

  const renderTaskCard = (t: Task) => (
    <div
      key={t.id}
      role="button"
      tabIndex={0}
      className={`task-card task-card--issue-linked task-card-clickable ${isOverdue(t.deadline) && t.status !== 'done' && t.status !== 'cancelled' ? 'task-card-overdue' : ''}`}
      onClick={() => setSelectedTask(t)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSelectedTask(t);
        }
      }}
    >
      <div className="task-card-top">
        <div className="task-card-title">{t.title}</div>
        {t.isAutoGenerated && <span className="task-pill task-pill-auto">Авто</span>}
      </div>
      {t.description && <div className="task-card-desc task-card-desc-preview">{t.description}</div>}
      {t.deadline && (
        <div className={`task-card-deadline ${isOverdue(t.deadline) && t.status !== 'done' ? 'overdue' : ''}`}>
          Дедлайн: {toDateDisplay(t.deadline)}
          {isOverdue(t.deadline) && t.status !== 'done' && t.status !== 'cancelled' && (
            <span className="overdue-label"> · просрочено</span>
          )}
        </div>
      )}
      <div className="task-card-footer" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <span className={`task-status task-status-${t.status}`}>{STATUS_LABEL[t.status]}</span>
        <select
          className="task-card-status-select"
          value={t.status}
          onChange={e => void onStatusChange(t.id, e.target.value as TaskStatus)}
          disabled={savingId === t.id}
          aria-label={`Статус: ${t.title}`}
        >
          {STATUS_ORDER.map(s => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>
    </div>
  );

  const taskDetailModal = selectedTask ? createPortal(
    <div className="task-modal-backdrop" onClick={() => !openingArticle && setSelectedTask(null)}>
      <div
        className="task-modal task-modal-detail"
        role="dialog"
        aria-modal
        aria-labelledby="task-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="task-modal-header">
          <h3 id="task-detail-title">{selectedTask.title}</h3>
          <button
            type="button"
            className="task-modal-close"
            onClick={() => setSelectedTask(null)}
            disabled={openingArticle}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <div className="task-detail-body">
          {formatIssueLabel(selectedTask) && (
            <span className="issue-tasks-badge task-detail-issue">{formatIssueLabel(selectedTask)}</span>
          )}

          <div className="task-detail-meta">
            <span className={`task-status task-status-${selectedTask.status}`}>
              {STATUS_LABEL[selectedTask.status]}
            </span>
            {selectedTask.isAutoGenerated && <span className="task-pill task-pill-auto">Авто</span>}
            {selectedTask.deadline && (
              <span className={`task-deadline ${isOverdue(selectedTask.deadline) && selectedTask.status !== 'done' ? 'task-deadline-overdue' : ''}`}>
                Дедлайн: {toDateDisplay(selectedTask.deadline)}
                {isOverdue(selectedTask.deadline) && selectedTask.status !== 'done' && selectedTask.status !== 'cancelled' && ' · просрочено'}
              </span>
            )}
          </div>

          {selectedTask.articleTitle && (
            <p className="task-detail-article">
              Статья: <strong>{selectedTask.articleTitle}</strong>
            </p>
          )}

          <div className="task-detail-section">
            <p className="task-detail-label">Описание</p>
            <p className="task-detail-description">
              {selectedTask.description?.trim() || 'Описание не указано.'}
            </p>
          </div>
        </div>

        <div className="task-modal-footer task-detail-footer">
          <div className="task-detail-footer-status" onClick={(e) => e.stopPropagation()}>
            <label className="template-select-label task-detail-status-label">
              Статус
              <select
                className="template-select task-detail-status-select"
                value={selectedTask.status}
                onChange={(e) => void onStatusChange(selectedTask.id, e.target.value as TaskStatus)}
                disabled={savingId === selectedTask.id || openingArticle}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="task-detail-footer-actions">
            {selectedTask.articleId && onOpenArticle && (
              <button
                type="button"
                className="btn btn-auto task-detail-article-btn"
                onClick={() => void handleOpenArticle()}
                disabled={openingArticle || savingId === selectedTask.id}
              >
                {openingArticle ? 'Открываем...' : 'Перейти к статье'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-auto"
              onClick={() => setSelectedTask(null)}
              disabled={openingArticle}
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className={`my-tasks-page${variant === 'layout' ? ' my-tasks-page--layout' : ''}`}>
      {error && <div className="error-message">{error}</div>}

      {tasks.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">Нет задач</p>
          <p className="empty-state-text">Когда главный редактор назначит задачу по выпуску, она появится здесь.</p>
        </div>
      ) : (
        <div className="my-tasks-groups">
          {issueGroups.map((group) => (
            <section className="issue-tasks-group" key={group.issueId}>
              <header className="issue-tasks-group-header">
                <div className="issue-tasks-group-title">
                  <span className="issue-tasks-badge">{group.label}</span>
                  {group.parentTitle && (
                    <span className="issue-tasks-parent">{group.parentTitle}</span>
                  )}
                </div>
                <span className="issue-tasks-count">{group.tasks.length} задач</span>
              </header>
              <div className="issue-tasks-grid">
                {group.tasks.map(renderTaskCard)}
              </div>
            </section>
          ))}

          {orphanTasks.length > 0 && (
            <section className="issue-tasks-group issue-tasks-group--orphan">
              <header className="issue-tasks-group-header">
                <span className="issue-tasks-badge issue-tasks-badge--muted">Без выпуска</span>
              </header>
              <div className="issue-tasks-grid">
                {orphanTasks.map(renderTaskCard)}
              </div>
            </section>
          )}
        </div>
      )}
      {taskDetailModal}
    </div>
  );
};

export default MyTasksPage;
