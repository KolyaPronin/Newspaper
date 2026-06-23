import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { issueAPI, taskAPI, userAPI, transformTask, templateAPI } from '../../utils/api';
import type { Task, TaskStatus } from '../../types/Task';
import type { PageTemplate } from '../../types/PageTemplate';
import { UserRole } from '../../types/User';

const ROLE_LABEL: Record<string, string> = {
  author: 'Автор',
  proofreader: 'Корректор',
  illustrator: 'Иллюстратор',
  layout_designer: 'Верстальщик',
  chief_editor: 'Главный редактор',
};

const ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.AUTHOR,
  UserRole.PROOFREADER,
  UserRole.ILLUSTRATOR,
  UserRole.LAYOUT_DESIGNER,
];

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Новая',
  in_progress: 'В работе',
  done: 'Готово',
  cancelled: 'Отменена',
};

const STATUS_ORDER: TaskStatus[] = ['open', 'in_progress', 'done', 'cancelled'];

type CreateIssueTab = 'config' | 'issueTasks';

const CREATE_ISSUE_TABS: { id: CreateIssueTab; label: string }[] = [
  { id: 'config', label: 'Конфигурация выпуска' },
  { id: 'issueTasks', label: 'Статьи выпуска' },
];

interface ArticleRow {
  key: string;
  title: string;
  authorId: string;
  proofreaderId: string;
  illustratorId: string;
  description: string;
}

const newArticleRow = (): ArticleRow => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: '',
  authorId: '',
  proofreaderId: '',
  illustratorId: '',
  description: '',
});

const toDateInputValue = (d: Date | null): string => {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const fromDateInputValue = (value: string): string | null => {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
};

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

const validateArticleRows = (rows: ArticleRow[]): string | null => {
  const filled = rows.filter(
    (row) => row.title.trim() && row.authorId && row.proofreaderId && row.illustratorId,
  );
  if (filled.length === 0) {
    return 'Добавьте хотя бы одну статью с автором, корректором и иллюстратором';
  }
  const partial = rows.some(
    (row) => (row.title.trim() || row.authorId || row.proofreaderId || row.illustratorId)
      && (!row.title.trim() || !row.authorId || !row.proofreaderId || !row.illustratorId),
  );
  if (partial) {
    return 'Заполните все поля для каждой статьи';
  }
  return null;
};

const TaskBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; username: string; role: string }>>([]);
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedIssueTaskId, setSelectedIssueTaskId] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formPublicationDate, setFormPublicationDate] = useState('');
  const [formIssueNumber, setFormIssueNumber] = useState('');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formPageCount, setFormPageCount] = useState('');
  const [formLayoutNotes, setFormLayoutNotes] = useState('');
  const [formLayoutDesignerId, setFormLayoutDesignerId] = useState('');
  const [createIssueTab, setCreateIssueTab] = useState<CreateIssueTab>('config');
  const [articleRows, setArticleRows] = useState<ArticleRow[]>([newArticleRow()]);
  const [formError, setFormError] = useState<string | null>(null);

  const [articleIssueId, setArticleIssueId] = useState<string | null>(null);
  const [articleIssueTaskId, setArticleIssueTaskId] = useState<string | null>(null);
  const [articleTitle, setArticleTitle] = useState('');
  const [articleAuthorId, setArticleAuthorId] = useState('');
  const [articleProofreaderId, setArticleProofreaderId] = useState('');
  const [articleIllustratorId, setArticleIllustratorId] = useState('');
  const [articleDescription, setArticleDescription] = useState('');
  const [articleError, setArticleError] = useState<string | null>(null);

  const [subtaskParentId, setSubtaskParentId] = useState<string | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskDescription, setSubtaskDescription] = useState('');
  const [subtaskDeadline, setSubtaskDeadline] = useState('');
  const [subtaskRole, setSubtaskRole] = useState<UserRole>(UserRole.AUTHOR);
  const [subtaskUserId, setSubtaskUserId] = useState('');
  const [subtaskProofreaderId, setSubtaskProofreaderId] = useState('');
  const [subtaskIllustratorId, setSubtaskIllustratorId] = useState('');
  const [subtaskError, setSubtaskError] = useState<string | null>(null);

  useBodyScrollLock(isCreateOpen || Boolean(articleIssueId) || Boolean(subtaskParentId) || Boolean(selectedIssueTaskId));

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawTasks, rawUsers] = await Promise.all([
        taskAPI.getTasks({ limit: 300 }),
        userAPI.getUsers(),
      ]);
      setTasks(rawTasks.map(transformTask));
      setUsers(rawUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить задачи');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const issueTasks = useMemo(
    () => tasks.filter((task) => task.isIssueTask),
    [tasks],
  );

  const subtasksByParentId = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks
      .filter((task) => !task.isIssueTask && task.parentTaskId)
      .forEach((task) => {
        const parentId = task.parentTaskId as string;
        const list = map.get(parentId) || [];
        list.push(task);
        map.set(parentId, list);
      });
    map.forEach((list) => {
      list.sort((a, b) => {
        if (a.isAutoGenerated !== b.isAutoGenerated) {
          return a.isAutoGenerated ? 1 : -1;
        }
        return a.title.localeCompare(b.title, 'ru');
      });
    });
    return map;
  }, [tasks]);

  const authors = useMemo(() => users.filter((u) => u.role === UserRole.AUTHOR), [users]);
  const proofreaders = useMemo(() => users.filter((u) => u.role === UserRole.PROOFREADER), [users]);
  const illustrators = useMemo(() => users.filter((u) => u.role === UserRole.ILLUSTRATOR), [users]);
  const layoutDesigners = useMemo(() => users.filter((u) => u.role === UserRole.LAYOUT_DESIGNER), [users]);
  const usersForRole = useMemo(
    () => users.filter((u) => u.role === subtaskRole),
    [users, subtaskRole],
  );

  const selectedIssueTask = useMemo(
    () => issueTasks.find((task) => task.id === selectedIssueTaskId) ?? null,
    [issueTasks, selectedIssueTaskId],
  );

  const selectedIssueSubtasks = useMemo(() => {
    if (!selectedIssueTask) return [];
    return subtasksByParentId.get(selectedIssueTask.id) || [];
  }, [selectedIssueTask, subtasksByParentId]);

  useEffect(() => {
    if (selectedIssueTaskId && !selectedIssueTask) {
      setSelectedIssueTaskId(null);
    }
  }, [selectedIssueTaskId, selectedIssueTask]);

  const openCreate = async () => {
    setFormTitle('');
    setFormDescription('');
    setFormDeadline('');
    setFormPublicationDate(toDateInputValue(new Date()));
    setFormIssueNumber('');
    setFormTemplateId('');
    setFormPageCount('');
    setFormLayoutNotes('');
    setFormLayoutDesignerId('');
    setCreateIssueTab('config');
    setArticleRows([newArticleRow()]);
    setFormError(null);
    setIsCreateOpen(true);

    try {
      const list = await templateAPI.getTemplates();
      setTemplates(list);
      if (list.length === 1) setFormTemplateId(list[0].id);
    } catch {
      setTemplates([]);
    }
  };

  const updateArticleRow = (key: string, patch: Partial<ArticleRow>) => {
    setArticleRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const submitCreateIssue = async () => {
    setFormError(null);
    if (!formTitle.trim()) {
      setFormError('Введите название выпуска');
      return;
    }
    const rowError = validateArticleRows(articleRows);
    if (rowError) {
      setFormError(rowError);
      setCreateIssueTab('issueTasks');
      return;
    }

    setSaving(true);
    try {
      const number = formIssueNumber.trim() ? Number(formIssueNumber) : undefined;
      if (number !== undefined && (!Number.isFinite(number) || number < 1)) {
        setFormError('Номер выпуска должен быть положительным числом');
        setSaving(false);
        return;
      }
      const pageCount = formPageCount.trim() ? Number(formPageCount) : undefined;
      if (pageCount !== undefined && (!Number.isFinite(pageCount) || pageCount < 1)) {
        setFormError('Количество страниц должно быть положительным числом');
        setSaving(false);
        return;
      }

      const validArticles = articleRows.filter(
        (row) => row.title.trim() && row.authorId && row.proofreaderId && row.illustratorId,
      );

      const result = await issueAPI.startIssueWorkflow({
        title: formTitle.trim(),
        description: formDescription,
        deadline: fromDateInputValue(formDeadline),
        publicationDate: fromDateInputValue(formPublicationDate),
        number,
        templateId: formTemplateId || null,
        pageCount: pageCount ?? null,
        layoutNotes: formLayoutNotes,
        layoutDesignerId: formLayoutDesignerId || null,
        articles: validArticles.map((row) => ({
          title: row.title.trim(),
          authorId: row.authorId,
          proofreaderId: row.proofreaderId,
          illustratorId: row.illustratorId,
          description: row.description.trim(),
        })),
      });
      setIsCreateOpen(false);
      const issueTaskId = (result.issueTask as { _id?: string })?._id;
      if (issueTaskId) setSelectedIssueTaskId(issueTaskId);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Не удалось создать выпуск');
    } finally {
      setSaving(false);
    }
  };

  const openArticleCreate = (issueTask: Task) => {
    if (!issueTask.issueId) return;
    setArticleIssueId(issueTask.issueId);
    setArticleIssueTaskId(issueTask.id);
    setArticleTitle('');
    setArticleAuthorId('');
    setArticleProofreaderId('');
    setArticleIllustratorId('');
    setArticleDescription('');
    setArticleError(null);
    setSelectedIssueTaskId(issueTask.id);
  };

  const closeArticleCreate = () => {
    setArticleIssueId(null);
    setArticleIssueTaskId(null);
  };

  const submitArticle = async () => {
    if (!articleIssueId) return;
    setArticleError(null);
    if (!articleTitle.trim()) { setArticleError('Введите название статьи'); return; }
    if (!articleAuthorId) { setArticleError('Выберите автора'); return; }
    if (!articleProofreaderId) { setArticleError('Выберите корректора'); return; }
    if (!articleIllustratorId) { setArticleError('Выберите иллюстратора'); return; }

    setSaving(true);
    try {
      await issueAPI.createIssueArticle(articleIssueId, {
        title: articleTitle.trim(),
        authorId: articleAuthorId,
        proofreaderId: articleProofreaderId,
        illustratorId: articleIllustratorId,
        description: articleDescription.trim(),
      });
      closeArticleCreate();
      if (articleIssueTaskId) setSelectedIssueTaskId(articleIssueTaskId);
      await refresh();
    } catch (err) {
      setArticleError(err instanceof Error ? err.message : 'Не удалось добавить статью');
    } finally {
      setSaving(false);
    }
  };

  const openSubtaskCreate = (parentTaskId: string) => {
    setSubtaskParentId(parentTaskId);
    setSubtaskTitle('');
    setSubtaskDescription('');
    setSubtaskDeadline('');
    setSubtaskRole(UserRole.AUTHOR);
    setSubtaskUserId('');
    setSubtaskProofreaderId('');
    setSubtaskIllustratorId('');
    setSubtaskError(null);
  };

  const submitSubtask = async () => {
    if (!subtaskParentId) return;
    setSubtaskError(null);
    if (!subtaskTitle.trim()) { setSubtaskError('Введите название задачи'); return; }
    if (subtaskRole === UserRole.AUTHOR) {
      if (!subtaskProofreaderId) { setSubtaskError('Выберите корректора'); return; }
      if (!subtaskIllustratorId) { setSubtaskError('Выберите иллюстратора'); return; }
    }
    setSaving(true);
    try {
      await taskAPI.createTask({
        title: subtaskTitle.trim(),
        description: subtaskDescription,
        deadline: fromDateInputValue(subtaskDeadline),
        parentTaskId: subtaskParentId,
        assigneeRole: subtaskRole,
        assigneeUserId: subtaskUserId || null,
        assignedProofreaderId: subtaskRole === UserRole.AUTHOR ? subtaskProofreaderId : null,
        assignedIllustratorId: subtaskRole === UserRole.AUTHOR ? subtaskIllustratorId : null,
        status: subtaskRole === UserRole.AUTHOR ? 'in_progress' : 'open',
      });
      setSubtaskParentId(null);
      await refresh();
    } catch (err) {
      setSubtaskError(err instanceof Error ? err.message : 'Не удалось создать задачу');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    setSaving(true);
    setError(null);
    try {
      await taskAPI.updateTask(taskId, { status });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить статус');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteIssueTask = async (taskId: string) => {
    if (!window.confirm('Удалить выпуск и все связанные задачи?')) return;
    setSaving(true);
    try {
      await taskAPI.deleteTask(taskId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubtask = async (task: Task) => {
    if (task.isAutoGenerated) return;
    const isArticle = task.assigneeRole === UserRole.AUTHOR && !task.isAutoGenerated;
    if (!window.confirm(isArticle ? 'Удалить статью?' : 'Удалить задачу?')) return;
    setSaving(true);
    try {
      await taskAPI.deleteTask(task.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить');
    } finally {
      setSaving(false);
    }
  };

  const renderUserSelect = (
    value: string,
    onChange: (id: string) => void,
    list: Array<{ id: string; username: string }>,
    placeholder: string,
  ) => (
    <select className="template-select" value={value} onChange={(e) => onChange(e.target.value)} disabled={saving}>
      <option value="">{placeholder}</option>
      {list.map((u) => (
        <option key={u.id} value={u.id}>{u.username}</option>
      ))}
    </select>
  );

  const createIssueModal = isCreateOpen ? createPortal(
    <div className="task-modal-backdrop" onClick={() => !saving && setIsCreateOpen(false)}>
      <div className="task-modal task-modal-wide task-modal-create-issue" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <div className="task-modal-header">
          <h3>Новый выпуск</h3>
          <button type="button" className="task-modal-close" onClick={() => !saving && setIsCreateOpen(false)} aria-label="Закрыть">✕</button>
        </div>
        <div className="task-form">
          {formError && <div className="error-message">{formError}</div>}

          <div className="task-modal-tabs" role="tablist" aria-label="Разделы создания выпуска">
            {CREATE_ISSUE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={createIssueTab === tab.id}
                className={`task-modal-tab${createIssueTab === tab.id ? ' task-modal-tab-active' : ''}`}
                onClick={() => setCreateIssueTab(tab.id)}
                disabled={saving}
              >
                {tab.label}
                {tab.id === 'issueTasks' ? ` (${articleRows.length})` : ''}
              </button>
            ))}
          </div>

          {createIssueTab === 'config' && (
            <div className="task-modal-tab-panel task-modal-tab-panel-fit" role="tabpanel">
              <div className="task-form-grid task-form-grid-compact task-form-grid-cols-3">
                <label className="template-select-label">
                  Название выпуска *
                  <input className="template-select" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} disabled={saving} />
                </label>
                <label className="template-select-label">
                  Номер выпуска
                  <input type="number" min={1} className="template-select" value={formIssueNumber} onChange={(e) => setFormIssueNumber(e.target.value)} disabled={saving} placeholder="Авто" />
                </label>
                <label className="template-select-label">
                  Страниц
                  <input type="number" min={1} className="template-select" value={formPageCount} onChange={(e) => setFormPageCount(e.target.value)} disabled={saving} placeholder="Напр. 8" />
                </label>
              </div>
              <div className="task-form-grid task-form-grid-compact task-form-grid-cols-2">
                <label className="template-select-label">
                  Дата выхода
                  <input type="date" className="template-select" value={formPublicationDate} onChange={(e) => setFormPublicationDate(e.target.value)} disabled={saving} />
                </label>
                <label className="template-select-label">
                  Дедлайн
                  <input type="date" className="template-select" value={formDeadline} onChange={(e) => setFormDeadline(e.target.value)} disabled={saving} />
                </label>
              </div>
              <div className="task-form-grid task-form-grid-compact task-form-grid-cols-2">
                <label className="template-select-label">
                  Шаблон
                  <select className="template-select" value={formTemplateId} onChange={(e) => setFormTemplateId(e.target.value)} disabled={saving}>
                    <option value="">Не выбран</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
                <label className="template-select-label">
                  Верстальщик
                  {renderUserSelect(formLayoutDesignerId, setFormLayoutDesignerId, layoutDesigners, 'Любой верстальщик')}
                </label>
              </div>
              <div className="task-form-grid task-form-grid-wide">
                <label className="template-select-label">
                  Заметки для верстальщика
                  <textarea className="template-select task-textarea task-textarea-compact" value={formLayoutNotes} onChange={(e) => setFormLayoutNotes(e.target.value)} disabled={saving} rows={1} />
                </label>
                <label className="template-select-label">
                  Описание выпуска
                  <textarea className="template-select task-textarea task-textarea-compact" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} disabled={saving} rows={1} />
                </label>
              </div>
            </div>
          )}

          {createIssueTab === 'issueTasks' && (
            <div className="task-modal-tab-panel task-modal-tab-panel-fit" role="tabpanel">
              <div className="task-form-section-header">
                <p className="task-form-section-title">Статьи выпуска</p>
                <button type="button" className="btn btn-small btn-auto" onClick={() => setArticleRows((rows) => [...rows, newArticleRow()])} disabled={saving}>+ Статья</button>
              </div>

              <div className="issue-articles-list issue-articles-list-compact">
                {articleRows.map((row) => (
                  <div className="issue-article-block issue-article-block-stacked" key={row.key}>
                    <div className="issue-article-title-row">
                      <input
                        className="template-select issue-article-title"
                        value={row.title}
                        onChange={(e) => updateArticleRow(row.key, { title: e.target.value })}
                        disabled={saving}
                        placeholder="Название статьи"
                      />
                      <button
                        type="button"
                        className="btn btn-small task-danger issue-article-remove"
                        onClick={() => setArticleRows((rows) => rows.length <= 1 ? rows : rows.filter((r) => r.key !== row.key))}
                        disabled={saving || articleRows.length <= 1}
                        aria-label="Удалить"
                      >
                        ✕
                      </button>
                    </div>
                    <label className="template-select-label issue-article-desc-wrap">
                      Описание статьи
                      <textarea
                        className="template-select task-textarea task-textarea-desc"
                        value={row.description}
                        onChange={(e) => updateArticleRow(row.key, { description: e.target.value })}
                        disabled={saving}
                        rows={2}
                        placeholder="Тема, объём, пожелания автору..."
                      />
                    </label>
                    <div className="issue-article-assignees">
                      {renderUserSelect(row.authorId, (id) => updateArticleRow(row.key, { authorId: id }), authors, 'Автор')}
                      {renderUserSelect(row.proofreaderId, (id) => updateArticleRow(row.key, { proofreaderId: id }), proofreaders, 'Корректор')}
                      {renderUserSelect(row.illustratorId, (id) => updateArticleRow(row.key, { illustratorId: id }), illustrators, 'Иллюстратор')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="task-modal-footer">
          <button type="button" className="btn btn-auto" onClick={() => setIsCreateOpen(false)} disabled={saving}>Отмена</button>
          {createIssueTab === 'config' ? (
            <button type="button" className="btn btn-auto" onClick={() => setCreateIssueTab('issueTasks')} disabled={saving}>
              Далее: статьи выпуска
            </button>
          ) : (
            <button type="button" className="btn btn-auto" onClick={() => setCreateIssueTab('config')} disabled={saving}>
              Назад
            </button>
          )}
          <button type="button" className="btn btn-auto" onClick={() => void submitCreateIssue()} disabled={saving}>
            {saving ? 'Создание...' : 'Создать выпуск'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  const articleModal = articleIssueId ? createPortal(
    <div className="task-modal-backdrop" onClick={() => !saving && closeArticleCreate()}>
      <div className="task-modal task-modal-wide" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <div className="task-modal-header">
          <h3>Статья выпуска</h3>
          <button type="button" className="task-modal-close" onClick={() => !saving && closeArticleCreate()} aria-label="Закрыть">✕</button>
        </div>
        <div className="task-form">
          {articleError && <div className="error-message">{articleError}</div>}
          <div className="issue-article-block issue-article-block-stacked issue-article-block-modal">
            <div className="issue-article-title-row">
              <input
                className="template-select issue-article-title"
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                disabled={saving}
                placeholder="Название статьи *"
              />
            </div>
            <label className="template-select-label issue-article-desc-wrap">
              Описание статьи
              <textarea
                className="template-select task-textarea task-textarea-desc"
                value={articleDescription}
                onChange={(e) => setArticleDescription(e.target.value)}
                disabled={saving}
                rows={2}
                placeholder="Тема, объём, пожелания автору..."
              />
            </label>
            <div className="issue-article-assignees">
              {renderUserSelect(articleAuthorId, setArticleAuthorId, authors, 'Автор *')}
              {renderUserSelect(articleProofreaderId, setArticleProofreaderId, proofreaders, 'Корректор *')}
              {renderUserSelect(articleIllustratorId, setArticleIllustratorId, illustrators, 'Иллюстратор *')}
            </div>
          </div>
        </div>
        <div className="task-modal-footer">
          <button type="button" className="btn btn-auto" onClick={closeArticleCreate} disabled={saving}>Отмена</button>
          <button type="button" className="btn btn-auto" onClick={() => void submitArticle()} disabled={saving}>{saving ? 'Сохранение...' : 'Добавить статью'}</button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  const subtaskModal = subtaskParentId ? createPortal(
    <div className="task-modal-backdrop" onClick={() => !saving && setSubtaskParentId(null)}>
      <div className="task-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <div className="task-modal-header">
          <h3>Дополнительная задача</h3>
          <button type="button" className="task-modal-close" onClick={() => !saving && setSubtaskParentId(null)} aria-label="Закрыть">✕</button>
        </div>
        <div className="task-form">
          {subtaskError && <div className="error-message">{subtaskError}</div>}
          <label className="template-select-label">
            Название *
            <input className="template-select" value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)} disabled={saving} />
          </label>
          <div className="task-form-grid">
            <label className="template-select-label">
              Роль *
              <select className="template-select" value={subtaskRole} onChange={(e) => { setSubtaskRole(e.target.value as UserRole); setSubtaskUserId(''); setSubtaskProofreaderId(''); setSubtaskIllustratorId(''); }} disabled={saving}>
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>{ROLE_LABEL[role] || role}</option>
                ))}
              </select>
            </label>
            <label className="template-select-label">
              Исполнитель
              {renderUserSelect(subtaskUserId, setSubtaskUserId, usersForRole, 'Любой с ролью')}
            </label>
          </div>
          {subtaskRole === UserRole.AUTHOR && (
            <div className="task-form-grid">
              <label className="template-select-label">Корректор *{renderUserSelect(subtaskProofreaderId, setSubtaskProofreaderId, proofreaders, 'Выберите')}</label>
              <label className="template-select-label">Иллюстратор *{renderUserSelect(subtaskIllustratorId, setSubtaskIllustratorId, illustrators, 'Выберите')}</label>
            </div>
          )}
          <label className="template-select-label">
            Дедлайн
            <input type="date" className="template-select" value={subtaskDeadline} onChange={(e) => setSubtaskDeadline(e.target.value)} disabled={saving} />
          </label>
          <label className="template-select-label">
            Описание
            <input className="template-select task-field-wide" value={subtaskDescription} onChange={(e) => setSubtaskDescription(e.target.value)} disabled={saving} placeholder="Необязательно" />
          </label>
        </div>
        <div className="task-modal-footer">
          <button type="button" className="btn btn-auto" onClick={() => setSubtaskParentId(null)} disabled={saving}>Отмена</button>
          <button type="button" className="btn btn-auto" onClick={() => void submitSubtask()} disabled={saving}>{saving ? 'Сохранение...' : 'Создать'}</button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  const resolveIllustratorName = (subtask: Task) => {
    if (subtask.assignedIllustratorUsername) return subtask.assignedIllustratorUsername;
    if (subtask.assigneeRole === UserRole.ILLUSTRATOR && subtask.assigneeUsername) return subtask.assigneeUsername;
    return '—';
  };

  const renderSubtaskBlock = (subtask: Task) => {
    const roleLabel = subtask.assigneeRole ? ROLE_LABEL[subtask.assigneeRole] : 'Задача';
    const isAuthorArticle = !subtask.isAutoGenerated && subtask.assigneeRole === UserRole.AUTHOR;

    return (
      <div className="issue-subtask-block" key={subtask.id}>
        <div className="issue-subtask-block-top">
          <span className="issue-subtask-block-title">{subtask.articleTitle || subtask.title}</span>
          <div className="issue-subtask-block-badges">
            {subtask.isAutoGenerated && <span className="task-pill task-pill-auto">авто</span>}
            <span className="task-role-badge">{roleLabel}</span>
          </div>
        </div>
        {subtask.description && (
          <p className="issue-subtask-block-desc">{subtask.description}</p>
        )}
        {isAuthorArticle ? (
          <div className="issue-subtask-block-people">
            <span>Автор: {subtask.assigneeUsername || '—'}</span>
            <span>Корр.: {subtask.assignedProofreaderUsername || '—'}</span>
            <span>Илл.: {resolveIllustratorName(subtask)}</span>
          </div>
        ) : subtask.assigneeUsername ? (
          <div className="issue-subtask-block-people">
            <span>{subtask.assigneeUsername}</span>
          </div>
        ) : null}
        <div className="issue-subtask-block-footer">
          <select
            className="template-select subtask-status-select"
            value={subtask.status}
            onChange={(e) => void handleStatusChange(subtask.id, e.target.value as TaskStatus)}
            disabled={saving}
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>{STATUS_LABEL[status]}</option>
            ))}
          </select>
          {!subtask.isAutoGenerated && (
            <button
              type="button"
              className="btn btn-small task-danger"
              onClick={() => void handleDeleteSubtask(subtask)}
              disabled={saving}
              aria-label="Удалить"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  };

  const issueDetailModal = selectedIssueTask ? createPortal(
    <div className="task-modal-backdrop" onClick={() => !saving && setSelectedIssueTaskId(null)}>
      <div
        className="task-modal task-modal-wide task-modal-issue-detail"
        role="dialog"
        aria-modal
        aria-labelledby="issue-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="task-modal-header">
          <div>
            {selectedIssueTask.issueInfo && (
              <span className="issue-tasks-badge issue-detail-badge">
                Выпуск №{selectedIssueTask.issueInfo.number}
                {selectedIssueTask.issueInfo.title ? ` · ${selectedIssueTask.issueInfo.title}` : ''}
              </span>
            )}
            <h3 id="issue-detail-title">{selectedIssueTask.title}</h3>
          </div>
          <button
            type="button"
            className="task-modal-close"
            onClick={() => !saving && setSelectedIssueTaskId(null)}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <div className="issue-detail-body">
          {selectedIssueTask.description && (
            <p className="issue-detail-description">{selectedIssueTask.description}</p>
          )}

          <p className="issue-task-progress issue-detail-progress">
            Задач: {selectedIssueSubtasks.filter((t) => t.status === 'done').length}/{selectedIssueSubtasks.length} выполнено
          </p>

          <div className="issue-detail-toolbar">
            <button
              type="button"
              className="btn btn-small btn-auto"
              onClick={() => openArticleCreate(selectedIssueTask)}
              disabled={saving}
            >
              + Статья
            </button>
            <button
              type="button"
              className="btn btn-small btn-auto"
              onClick={() => openSubtaskCreate(selectedIssueTask.id)}
              disabled={saving}
            >
              + Задача
            </button>
          </div>

          {selectedIssueSubtasks.length === 0 ? (
            <p className="issue-task-empty-hint">
              Статьи не заданы — добавьте статью при создании выпуска или кнопкой «+ Статья».
            </p>
          ) : (
            <div className="issue-subtasks-grid">
              {selectedIssueSubtasks.map(renderSubtaskBlock)}
            </div>
          )}
        </div>

        <div className="task-modal-footer issue-detail-footer">
          <label className="template-select-label issue-detail-status-label">
            Статус выпуска
            <select
              className="template-select issue-task-status-select"
              value={selectedIssueTask.status}
              onChange={(e) => void handleStatusChange(selectedIssueTask.id, e.target.value as TaskStatus)}
              disabled={saving}
            >
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>{STATUS_LABEL[status]}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-small task-danger"
            onClick={() => void handleDeleteIssueTask(selectedIssueTask.id)}
            disabled={saving}
          >
            Удалить выпуск
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="task-board-panel">
    <div className="task-board">
      <div className="task-board-bar">
        <div>
          <h2 className="task-board-heading">Выпуски</h2>
          <p className="task-board-sub">Создайте выпуск: сначала конфигурация, затем статьи с назначениями. Цепочка: автор → корректор → иллюстратор → верстальщик.</p>
        </div>
        <div className="task-board-actions">
          <button type="button" className="btn btn-auto" onClick={() => void refresh()} disabled={loading || saving}>Обновить</button>
          <button type="button" className="btn btn-auto" onClick={() => void openCreate()} disabled={loading || saving}>+ Новый выпуск</button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="task-board-scroll">
        {loading ? (
          <div className="empty-state"><p className="empty-state-title">Загрузка...</p></div>
        ) : issueTasks.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">Нет выпусков</p>
            <p className="empty-state-text">Создайте выпуск: конфигурация и статьи выпуска.</p>
          </div>
        ) : (
          <div className="issue-summary-list">
            {issueTasks.map((issueTask) => {
              const subtasks = subtasksByParentId.get(issueTask.id) || [];
              const doneCount = subtasks.filter((t) => t.status === 'done').length;

              return (
                <button
                  type="button"
                  key={issueTask.id}
                  className="issue-summary-card"
                  onClick={() => setSelectedIssueTaskId(issueTask.id)}
                  disabled={saving}
                >
                  {issueTask.issueInfo && (
                    <span className="issue-tasks-badge">
                      Выпуск №{issueTask.issueInfo.number}
                    </span>
                  )}
                  <span className="issue-summary-card-title">{issueTask.title}</span>
                  {issueTask.description && (
                    <span className="issue-summary-card-desc">{issueTask.description}</span>
                  )}
                  <div className="issue-summary-card-footer">
                    <span className={`task-status task-status-${issueTask.status}`}>
                      {STATUS_LABEL[issueTask.status]}
                    </span>
                    <span className="issue-summary-card-meta">
                      {doneCount}/{subtasks.length} задач
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {createIssueModal}
      {issueDetailModal}
      {articleModal}
      {subtaskModal}
    </div>
    </div>
  );
};

export default TaskBoard;
