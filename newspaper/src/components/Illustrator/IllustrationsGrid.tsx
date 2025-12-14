import React from 'react';
import { Illustration } from '../../api/illustrations';

interface IllustrationsGridProps {
  illustrations: Illustration[];
  loading: boolean;
  onCaptionChange: (id: string, caption: string) => void;
  onDelete: (id: string) => void;
}

const IllustrationsGrid: React.FC<IllustrationsGridProps> = ({
  illustrations,
  loading,
  onCaptionChange,
  onDelete,
}) => {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--subtext)' }}>
        Загрузка...
      </div>
    );
  }

  if (illustrations.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--subtext)' }}>
        Нет иллюстраций. Добавьте первую!
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: 16,
      }}
    >
      {illustrations.map(ill => (
        <div
          key={ill.id}
          style={{
            background: 'rgba(14, 16, 22, 0.5)',
            border: '1px solid rgba(38, 42, 54, 0.4)',
            borderRadius: 8,
            padding: 12,
            position: 'relative',
          }}
        >
          <img
            src={ill.url}
            alt={ill.caption || ill.originalName}
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: 6,
              marginBottom: 8,
              maxHeight: 200,
              objectFit: 'contain',
            }}
          />
          <input
            type="text"
            value={ill.caption}
            onChange={e => onCaptionChange(ill.id, e.target.value)}
            placeholder="Подпись к изображению"
            style={{
              width: '100%',
              padding: '6px 8px',
              background: '#0e1016',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 12,
              marginBottom: 8,
            }}
          />
          <button
            onClick={() => onDelete(ill.id)}
            style={{
              width: '100%',
              padding: '6px',
              background: '#DC2626',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Удалить
          </button>
        </div>
      ))}
    </div>
  );
};

export default IllustrationsGrid;


