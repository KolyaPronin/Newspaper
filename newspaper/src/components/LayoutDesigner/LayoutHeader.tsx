import React from 'react';
import { PageTemplate } from '../../types/PageTemplate';

interface LayoutHeaderProps {
  selectedTemplate: PageTemplate | null;
  templates: PageTemplate[];
  templatesLoading: boolean;
  layoutsLoading: boolean;
  currentPage: number;
  inlineIllustrationSpan: 1 | 2;
  bulkActionLoading?: boolean;
  onTemplateChange: (templateId: string) => void;
  onReloadTemplate: () => void;
  onRefreshTemplates: () => void;
  onClearCurrentPage: () => void;
  onClearAllPages: () => void;
  onInlineIllustrationSpanChange: (span: 1 | 2) => void;
  autoSaveMessage: string | null;
}

const LayoutHeader: React.FC<LayoutHeaderProps> = ({
  selectedTemplate,
  templates,
  templatesLoading,
  layoutsLoading,
  currentPage,
  inlineIllustrationSpan,
  bulkActionLoading,
  onTemplateChange,
  onReloadTemplate,
  onRefreshTemplates,
  onClearCurrentPage,
  onClearAllPages,
  onInlineIllustrationSpanChange,
  autoSaveMessage,
}) => {
  const actionsDisabled = templatesLoading || layoutsLoading || !!bulkActionLoading;
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
              disabled={actionsDisabled || templates.length === 0}
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="template-select-label">
            Inline-иллюстрация
            <select
              className="template-select"
              value={String(inlineIllustrationSpan)}
              onChange={(e) => onInlineIllustrationSpanChange((e.target.value === '2' ? 2 : 1))}
              disabled={actionsDisabled}
            >
              <option value="1">1 колонка</option>
              <option value="2">2 колонки</option>
            </select>
          </label>
          <button 
            type="button" 
            className="btn btn-auto" 
            onClick={onReloadTemplate} 
            disabled={!selectedTemplate || actionsDisabled}
          >
            {layoutsLoading ? 'Загрузка...' : 'Загрузить шаблон'}
          </button>
          <button
            type="button"
            className="btn btn-auto"
            onClick={onClearCurrentPage}
            disabled={actionsDisabled}
          >
            Очистить страницу {currentPage}
          </button>
          <button
            type="button"
            className="btn btn-auto"
            onClick={onClearAllPages}
            disabled={actionsDisabled}
          >
            Очистить выпуск
          </button>
        </div>
      </div>

      <div className="auto-save-status">
        <span className="auto-save-message">Автосохранение: {autoSaveMessage}</span>
        <button 
          type="button" 
          className="btn btn-small" 
          onClick={onRefreshTemplates} 
          disabled={actionsDisabled}
        >
          {templatesLoading ? 'Обновляю...' : 'Обновить'}
        </button>
      </div>
    </>
  );
};

export default LayoutHeader;

