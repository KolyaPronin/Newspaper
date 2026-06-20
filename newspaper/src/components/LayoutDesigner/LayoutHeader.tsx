import React from 'react';
import { PageTemplate } from '../../types/PageTemplate';

interface LayoutHeaderProps {
  selectedTemplate: PageTemplate | null;
  templates: PageTemplate[];
  templatesLoading: boolean;
  layoutsLoading: boolean;
  currentPage: number;
  bulkActionLoading?: boolean;
  onTemplateChange: (templateId: string) => void;
  onReloadTemplate: () => void;
  onRefreshTemplates: () => void;
  onClearCurrentPage: () => void;
  onClearAllPages: () => void;
  autoSaveMessage: string | null;
  layoutId?: string | null;
  layoutStatus?: 'draft' | 'in_review' | 'published';
  reviewComment?: string | null;
  onSubmitForReview?: () => void;
  submitForReviewLoading?: boolean;
}

const LayoutHeader: React.FC<LayoutHeaderProps> = ({
  selectedTemplate,
  templates,
  templatesLoading,
  layoutsLoading,
  currentPage,
  bulkActionLoading,
  onTemplateChange,
  onReloadTemplate,
  onRefreshTemplates,
  onClearCurrentPage,
  onClearAllPages,
  autoSaveMessage,
  layoutId,
  layoutStatus,
  reviewComment,
  onSubmitForReview,
  submitForReviewLoading,
}) => {
  const actionsDisabled = templatesLoading || layoutsLoading || !!bulkActionLoading;

  const submitDisabled =
    !layoutId ||
    layoutStatus !== 'draft' ||
    !!submitForReviewLoading ||
    actionsDisabled;

  return (
    <>
      <div className="workspace-header-controls" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
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

        {/* Submit for review / status section */}
        {layoutStatus === 'in_review' ? (
          <span className="layout-status-badge layout-status-in-review">
            🔍 На проверке у главреда
          </span>
        ) : layoutStatus === 'published' ? (
          <span className="layout-status-badge layout-status-published">
            ✅ Опубликован
          </span>
        ) : (
          <button
            type="button"
            className="btn btn-auto"
            onClick={onSubmitForReview}
            disabled={submitDisabled}
          >
            {submitForReviewLoading ? 'Отправка...' : 'Отправить на проверку'}
          </button>
        )}
      </div>

      {layoutStatus === 'draft' && reviewComment && (
        <div className="review-comment-block">
          <div className="review-comment-label">Замечания главреда:</div>
          <div className="review-comment-text">{reviewComment}</div>
        </div>
      )}

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
