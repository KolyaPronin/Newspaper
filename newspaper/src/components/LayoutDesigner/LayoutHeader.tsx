import React from 'react';
import { PageTemplate } from '../../types/PageTemplate';

interface LayoutHeaderProps {
  selectedTemplate: PageTemplate | null;
  templates: PageTemplate[];
  templatesLoading: boolean;
  layoutsLoading: boolean;
  onTemplateChange: (templateId: string) => void;
  onReloadTemplate: () => void;
  onRefreshTemplates: () => void;
  autoSaveMessage: string | null;
}

const LayoutHeader: React.FC<LayoutHeaderProps> = ({
  selectedTemplate,
  templates,
  templatesLoading,
  layoutsLoading,
  onTemplateChange,
  onReloadTemplate,
  onRefreshTemplates,
  autoSaveMessage,
}) => {
  return (
    <>
      <div className="workspace-header" style={{ flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <div>
          <h1>Верстка страницы</h1>
          <p>Выберите шаблон и загрузите макет из базы</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: 'var(--subtext)' }}>
            Шаблон
            <select
              value={selectedTemplate?.id || ''}
              onChange={(e) => onTemplateChange(e.target.value)}
              disabled={templatesLoading || templates.length === 0}
              style={{ 
                minWidth: 220, 
                padding: '6px 10px', 
                borderRadius: 6, 
                border: '1px solid var(--border)',
                background: '#0e1016',
                color: 'var(--text)',
                fontSize: 14
              }}
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn" onClick={onReloadTemplate} disabled={!selectedTemplate || layoutsLoading} style={{ width: 'auto' }}>
            {layoutsLoading ? 'Загрузка...' : 'Загрузить шаблон'}
          </button>
        </div>
      </div>

      <div style={{ 
        marginBottom: 16, 
        padding: '8px 12px', 
        border: '1px solid var(--border)', 
        borderRadius: 8, 
        background: 'rgba(21, 24, 33, 0.3)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        fontSize: 13 
      }}>
        <span style={{ color: 'var(--subtext)' }}>Автосохранение: {autoSaveMessage}</span>
        <button type="button" className="btn" onClick={onRefreshTemplates} disabled={templatesLoading} style={{ padding: '6px 12px', fontSize: 13, width: 'auto' }}>
          {templatesLoading ? 'Обновляю...' : 'Обновить'}
        </button>
      </div>
    </>
  );
};

export default LayoutHeader;

