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
      <div className="workspace-header">
        <div>
          <h1>Верстка страницы</h1>
          <p>Выберите шаблон и загрузите макет из базы</p>
        </div>
        <div className="workspace-header-controls">
          <label className="template-select-label">
            Шаблон
            <select
              className="template-select"
              value={selectedTemplate?.id || ''}
              onChange={(e) => onTemplateChange(e.target.value)}
              disabled={templatesLoading || templates.length === 0}
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <button 
            type="button" 
            className="btn btn-auto" 
            onClick={onReloadTemplate} 
            disabled={!selectedTemplate || layoutsLoading}
          >
            {layoutsLoading ? 'Загрузка...' : 'Загрузить шаблон'}
          </button>
        </div>
      </div>

      <div className="auto-save-status">
        <span className="auto-save-message">Автосохранение: {autoSaveMessage}</span>
        <button 
          type="button" 
          className="btn btn-small" 
          onClick={onRefreshTemplates} 
          disabled={templatesLoading}
        >
          {templatesLoading ? 'Обновляю...' : 'Обновить'}
        </button>
      </div>
    </>
  );
};

export default LayoutHeader;

