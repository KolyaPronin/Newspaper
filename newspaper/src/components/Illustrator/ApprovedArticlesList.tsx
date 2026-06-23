import React from 'react';
import { Article } from '../../types/Article';

interface ApprovedArticlesListProps {
  approvedArticles: Article[];
  selectedArticle: Article | null;
  onSelect: (article: Article) => void;
}

const ApprovedArticlesList: React.FC<ApprovedArticlesListProps> = ({
  approvedArticles,
  selectedArticle,
  onSelect,
}) => {
  return (
    <div
      style={{
        position: 'sticky',
        top: 24,
        maxHeight: 'calc(100vh - 100px)',
        overflowY: 'auto',
        background: 'rgba(21, 24, 33, 0.3)',
        border: '1px solid rgba(38, 42, 54, 0.3)',
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>Одобренные статьи</h3>
      {approvedArticles.length === 0 ? (
        <p style={{ color: 'var(--subtext)', fontSize: 14, margin: '8px 0' }}>
          Нет одобренных статей
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {approvedArticles.map(article => (
            <div
              key={article.id}
              onClick={() => onSelect(article)}
              style={{
                background:
                  selectedArticle?.id === article.id
                    ? 'rgba(6, 191, 204, 0.15)'
                    : 'rgba(14, 16, 22, 0.5)',
                border: `1px solid ${
                  selectedArticle?.id === article.id ? 'var(--accent)' : 'rgba(38, 42, 54, 0.4)'
                }`,
                borderRadius: 8,
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                if (selectedArticle?.id !== article.id) {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.background = 'rgba(14, 16, 22, 0.7)';
                }
              }}
              onMouseLeave={e => {
                if (selectedArticle?.id !== article.id) {
                  e.currentTarget.style.borderColor = 'rgba(38, 42, 54, 0.4)';
                  e.currentTarget.style.background = 'rgba(14, 16, 22, 0.5)';
                }
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                {article.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--subtext)' }}>
                {new Date(article.updatedAt).toLocaleDateString('ru-RU')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApprovedArticlesList;


