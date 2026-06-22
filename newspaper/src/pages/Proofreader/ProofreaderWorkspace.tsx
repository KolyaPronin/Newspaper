import React, { useMemo, useState } from 'react';
import { useArticles } from '../../contexts/ArticleContext';
import { Article } from '../../types/Article';
import ProofreaderEditor from './ProofreaderEditor';
import MyTasksPage from '../Tasks/MyTasksPage';
import { useUnreadTasks } from '../../hooks/useUnreadTasks';

const ProofreaderWorkspace: React.FC = () => {
  const { articles, currentArticle, setCurrentArticle, loadArticle, loading, error } = useArticles();
  const [activeView, setActiveView] = useState<'articles' | 'tasks'>('articles');
  const { unreadCount, markAllSeen } = useUnreadTasks();

  const underReview = useMemo(
    () => articles.filter((article) => article.status === 'under_review'),
    [articles],
  );

  const handleSelect = (article: Article) => {
    setCurrentArticle(article);
  };

  const handleOpenArticleFromTask = async (articleId: string) => {
    const cached = articles.find((a) => a.id === articleId);
    if (cached) {
      setCurrentArticle(cached);
      setActiveView('articles');
      return;
    }
    const article = await loadArticle(articleId);
    if (!article) {
      throw new Error('Статья не найдена');
    }
    setCurrentArticle(article);
    setActiveView('articles');
  };

  return (
    <div className="proofreader-workspace author-workspace">
      <div className="workspace-header">
        <div>
          <h1>{activeView === 'articles' ? 'Очередь на проверку' : 'Мои задачи'}</h1>
          <p>{activeView === 'articles'
            ? 'Выберите статью из списка, чтобы внести правки и принять решение.'
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
            {unreadCount > 0 && <span className="tasks-badge">{unreadCount}</span>}
          </button>
        </div>
      </div>

      {activeView === 'tasks' ? (
        <MyTasksPage onOpenArticle={handleOpenArticleFromTask} />
      ) : (
        <>
          {error && (
            <div className="error-message" style={{ marginBottom: 16 }}>
              Ошибка загрузки статей: {error}
            </div>
          )}
          {loading && articles.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">Загрузка статей...</p>
            </div>
          ) : (
            <div className="articles-layout">
              <div className="articles-sidebar">
                <section className="article-section-compact">
                  <div className="article-section-header">
                    <h3>На проверке</h3>
                    <span className="article-count">{underReview.length}</span>
                  </div>
                  {underReview.length === 0 ? (
                    <p className="article-empty">Пока нет статей в статусе «На проверке».</p>
                  ) : (
                    <div className="article-list-compact">
                      {underReview.map((article) => {
                        const isSelected = currentArticle?.id === article.id;
                        return (
                          <button
                            key={article.id}
                            type="button"
                            className={`article-card-compact ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSelect(article)}
                          >
                            <div className="article-card-title">{article.title || 'Без названия'}</div>
                            <div className="article-card-meta">
                              <span className="article-status-badge">На проверке</span>
                              <span className="article-date-small">
                                {new Date(article.updatedAt).toLocaleDateString('ru-RU')}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
              <div className="articles-editor">
                <ProofreaderEditor />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProofreaderWorkspace;
