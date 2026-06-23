import React, { RefObject } from 'react';
import { Article } from '../../types/Article';

interface IllustrationUploadPanelProps {
  selectedArticle: Article;
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const IllustrationUploadPanel: React.FC<IllustrationUploadPanelProps> = ({
  selectedArticle,
  uploading,
  fileInputRef,
  onFileSelect,
}) => {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 600 }}>
        {selectedArticle.title}
      </h2>
      <div style={{ fontSize: 14, color: 'var(--subtext)', marginBottom: 16 }}>
        {new Date(selectedArticle.updatedAt).toLocaleDateString('ru-RU')}
      </div>

      <div
        style={{
          border: '2px dashed var(--border)',
          borderRadius: 8,
          padding: '20px',
          textAlign: 'center',
          background: uploading ? 'rgba(6, 191, 204, 0.15)' : 'rgba(6, 191, 204, 0.05)',
          marginBottom: 16,
          cursor: uploading ? 'wait' : 'pointer',
          transition: 'all 0.2s ease',
          borderColor: uploading ? 'var(--accent)' : 'var(--border)',
        }}
        onMouseEnter={e => {
          if (!uploading) {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.background = 'rgba(6, 191, 204, 0.1)';
          }
        }}
        onMouseLeave={e => {
          if (!uploading) {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.background = 'rgba(6, 191, 204, 0.05)';
          }
        }}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <div style={{ fontSize: 14, color: 'var(--accent)' }}>⏳ Загрузка изображения...</div>
        ) : (
          <>
            <div style={{ fontSize: 14, color: 'var(--subtext)', marginBottom: 8 }}>
              📎 Нажмите для выбора файла или вставьте изображение (Ctrl+V)
            </div>
            <div style={{ fontSize: 12, color: 'var(--subtext)' }}>
              JPEG, PNG, GIF, WebP (до 10MB) — загрузка автоматическая
            </div>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileSelect}
        style={{ display: 'none' }}
        disabled={uploading}
      />

      <div
        style={{
          background: 'rgba(14, 16, 22, 0.3)',
          border: '1px solid rgba(38, 42, 54, 0.3)',
          borderRadius: 8,
          padding: 16,
          marginTop: 20,
          fontSize: 14,
          lineHeight: 1.6,
        }}
        dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
      />
    </div>
  );
};

export default IllustrationUploadPanel;


