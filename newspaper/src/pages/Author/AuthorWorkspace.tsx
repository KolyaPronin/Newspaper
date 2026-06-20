import React, { useMemo, useState } from 'react';
import AuthorEditor from './AuthorEditor';
import { useArticles } from '../../contexts/ArticleContext';
import { useAuth } from '../../contexts/AuthContexts';
import { Article } from '../../types/Article';
import MyTasksPage from '../Tasks/MyTasksPage';
import { useUnreadTasks } from '../../hooks/useUnreadTasks';

const formatStatus = (status: Article['status']) => {
  switch (status) {
    case 'draft':
      return 'Черновик';
    case 'under_review':
      return 'На проверке';
    case 'needs_revision':
      return 'Нужна доработка';
    case 'approved':
      return 'Одобрено';
    case 'published':
      return 'Опубликовано';
    default:
      return status;
  }
};

const AuthorWorkspace: React.FC = () => {
  const { user } = useAuth();
  const { articles, currentArticle, setCurrentArticle, loading, error } = useArticles();
  const [activeView, setActiveView] = useState<'articles' | 'tasks'>('articles');
  const { unreadCount, markAllSeen } = useUnreadTasks();

  const drafts = useMemo(
    () => articles.filter(a => a.authorId === user?.id && a.status === 'draft'),
    [articles, user?.id]
  );

  const needsRevision = useMemo(() => {
    return articles.filter(a => a.authorId === user?.id && a.status === 'needs_revision');
  }, [articles, user?.id]);

  const inReview = useMemo(
    () => articles.filter(a => a.authorId === user?.id && a.status === 'under_review'),
    [articles, user?.id]
  );

  const approved = useMemo(
    () => articles.filter(a => a.authorId === user?.id && a.status === 'approved'),
    [articles, user?.id]
  );

  const handleCreateNew = () => {
    if (!user) return;
    setCurrentArticle({
      id: '',
      title: '',
      content: '',
      status: 'draft',
      authorId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  const handleSelectArticle = (article: Article) => {
    setCurrentArticle(article);
  };

  const renderSection = (title: string, list: Article[], emptyMessage: string, selectable = true) => (
    <section className="article-section-compact">
      <div className="article-section-header">
        <h3>{title}</h3>
        <span className="article-count">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <p className="article-empty">{emptyMessage}</p>
      ) : (
        <div className="article-list-compact">
          {list.map(article => {
            const isSelected = currentArticle?.id === article.id;
            return (
              <button
                key={article.id}
                type="button"
                className={`article-card-compact ${isSelected ? 'selected' : ''} ${!selectable ? 'disabled' : ''}`}
                onClick={() => selectable && handleSelectArticle(article)}
                disabled={!selectable}
              >
                <div className="article-card-title">{article.title || 'Без названия'}</div>
                <div className="article-card-meta">
                  <span className="article-status-badge">{formatStatus(article.status)}</span>
                  <span className="article-date-small">{new Date(article.updatedAt).toLocaleDateString('ru-RU')}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="author-workspace">
      <div className="workspace-header">
        <div>
          <h1>{activeView === 'articles' ? 'Мои статьи' : 'Мои задачи'}</h1>
          <p>{activeView === 'articles'
            ? 'Создавайте новые материалы или дорабатывайте возвращенные черновики.'
            : 'Задачи, назначенные на вашу роль.'
          }</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn-auto ${activeView === 'articles' ? 'active' : ''}`}
            onClick={() => setActiveView('articles')}
          >
            Статьи
          </button>
          <button
            type="button"
            className={`btn btn-auto ${activeView === 'tasks' ? 'active' : ''}`}
            onClick={() => { setActiveView('tasks'); void markAllSeen(); }}
            style={{ position: 'relative' }}
          >
            Задачи
            {unreadCount > 0 && (
              <span className="tasks-badge">{unreadCount}</span>
            )}
          </button>
          {activeView === 'articles' && (
            <button type="button" className="btn-create" onClick={handleCreateNew}>
              <span>+</span> Новая статья
            </button>
          )}
        </div>
      </div>

      {activeView === 'tasks' ? (
        <MyTasksPage />
      ) : (
        <>
          {error && (
            <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 16, color: '#991b1b' }}>
              Ошибка загрузки статей: {error}
            </div>
          )}
          {loading && articles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p>Загрузка статей...</p>
            </div>
          ) : (
            <div className="articles-layout">
              <div className="articles-sidebar">
                {renderSection('Черновики', drafts, 'Нет черновиков')}
                {renderSection('На доработке', needsRevision, 'Нет статей на доработке')}
                {renderSection('На проверке', inReview, 'Нет статей на проверке', false)}
                {renderSection('Одобрено', approved, 'Нет одобренных', false)}
              </div>
              <div className="articles-editor">
                <AuthorEditor />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuthorWorkspace;
