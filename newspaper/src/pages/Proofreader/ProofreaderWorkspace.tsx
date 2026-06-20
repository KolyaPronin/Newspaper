import React, { useMemo, useState } from 'react';
import { useArticles } from '../../contexts/ArticleContext';
import { Article } from '../../types/Article';
import ProofreaderEditor from './ProofreaderEditor';
import MyTasksPage from '../Tasks/MyTasksPage';
import { useUnreadTasks } from '../../hooks/useUnreadTasks';

const ProofreaderWorkspace: React.FC = () => {
  const { articles, currentArticle, setCurrentArticle, loading, error } = useArticles();
  const [activeView, setActiveView] = useState<'articles' | 'tasks'>('articles');
  const { unreadCount, markAllSeen } = useUnreadTasks();

  const underReview = useMemo(
    () => articles.filter(article => article.status === 'under_review'),
    [articles]
  );

  const handleSelect = (article: Article) => {
    setCurrentArticle(article);
  };

  return (
    <div className="proofreader-workspace">
      <div className="workspace-header">
        <div>
          <h1>{activeView === 'articles' ? 'Очередь на проверку' : 'Мои задачи'}</h1>
          <p>{activeView === 'articles'
            ? 'Выберите статью из списка, чтобы внести правки и принять решение.'
            : 'Задачи, назначенные на вашу роль.'
          }</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
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
        <MyTasksPage />
      ) : (
        <>
          {error && (
            <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 16, color: '#991b1b' }}>
              Ошибка загрузки статей: {error}
            </div>
          )}
          <section className="article-section">
            <div className="article-section-header">
              <h3>Статьи на проверке</h3>
              <span>{underReview.length}</span>
            </div>
            {loading && articles.length === 0 ? (
              <p className="article-empty">Загрузка статей...</p>
            ) : underReview.length === 0 ? (
              <p className="article-empty">Пока нет статей в статусе «На проверке».</p>
            ) : (
              <div className="article-grid">
                {underReview.map(article => (
                  <button
                    key={article.id}
                    type="button"
                    className={`article-card ${currentArticle?.id === article.id ? 'selected' : ''}`}
                    onClick={() => handleSelect(article)}
                  >
                    <h4>{article.title}</h4>
                    <p className="article-status">Автор: {article.authorId}</p>
                    <p className="article-date">{new Date(article.updatedAt).toLocaleString('ru-RU')}</p>
                  </button>
                ))}
              </div>
            )}
          </section>
          <ProofreaderEditor />
        </>
      )}
    </div>
  );
};

export default ProofreaderWorkspace;
