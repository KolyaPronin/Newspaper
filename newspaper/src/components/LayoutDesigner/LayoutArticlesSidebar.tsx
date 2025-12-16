import React from 'react';
import { Article } from '../../types/Article';
import { Illustration } from '../../utils/api';

interface LayoutArticlesSidebarProps {
  approvedArticles: Article[];
  allIllustrations: Illustration[];
  onArticleDragStart: (e: React.DragEvent, articleId: string) => void;
  onIllustrationDragStart: (e: React.DragEvent, illustrationId: string) => void;
}

const LayoutArticlesSidebar: React.FC<LayoutArticlesSidebarProps> = ({
  approvedArticles,
  allIllustrations,
  onArticleDragStart,
  onIllustrationDragStart,
}) => {
  return (
    <div className="layout-articles-sidebar">
      <h3>Одобренные статьи</h3>
      {approvedArticles.length === 0 ? (
        <p className="article-empty">Нет одобренных статей для размещения</p>
      ) : (
        <div className="layout-articles-list">
          {approvedArticles.map(article => (
            <div
              key={article.id}
              className="layout-article-item"
              draggable
              onDragStart={(e) => onArticleDragStart(e, article.id)}
            >
              <div className="layout-article-title">{article.title}</div>
              <div className="layout-article-meta">
                <span>{new Date(article.updatedAt).toLocaleDateString('ru-RU')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="illustrations-section">
        <h3 className="illustrations-section-title">Иллюстрации</h3>
        {allIllustrations.length === 0 ? (
          <p className="article-empty">Нет доступных иллюстраций</p>
        ) : (
          <div className="illustrations-grid">
            {allIllustrations.map(ill => (
              <div
                key={ill.id}
                className="illustration-item"
                draggable
                onDragStart={(e) => onIllustrationDragStart(e, ill.id)}
              >
                <img
                  src={ill.url}
                  alt={ill.caption || ''}
                  className="illustration-image"
                />
                {ill.caption && (
                  <div className="illustration-caption">
                    {ill.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LayoutArticlesSidebar;

