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
      
      <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(38, 42, 54, 0.3)' }}>
        <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Иллюстрации</h3>
        {allIllustrations.length === 0 ? (
          <p className="article-empty" style={{ fontSize: 12 }}>Нет доступных иллюстраций</p>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: 8,
            maxHeight: '300px',
            overflowY: 'auto',
          }}>
            {allIllustrations.map(ill => (
              <div
                key={ill.id}
                draggable
                onDragStart={(e) => onIllustrationDragStart(e, ill.id)}
                style={{
                  cursor: 'grab',
                  border: '1px solid rgba(38, 42, 54, 0.4)',
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: 'rgba(14, 16, 22, 0.5)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(38, 42, 54, 0.4)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <img
                  src={ill.url}
                  alt={ill.caption || ''}
                  style={{
                    width: '100%',
                    height: 60,
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                {ill.caption && (
                  <div style={{
                    padding: '4px 6px',
                    fontSize: 10,
                    color: 'var(--subtext)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
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

