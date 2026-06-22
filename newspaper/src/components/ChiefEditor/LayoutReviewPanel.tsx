import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { layoutAPI } from '../../utils/api';
import { Layout, PageTemplate } from '../../types/PageTemplate';
import PageLayout from '../../pages/LayoutDesigner/PageLayout';
import { templateAPI } from '../../api/layouts';
import { coverPageTemplate } from '../../data/templates';
import CoverPage from '../../pages/LayoutDesigner/CoverPage';

// Group layouts by templateId (= one "issue" = all pages sharing the same template)
interface IssueGroup {
  templateId: string;
  pages: Layout[]; // sorted by pageNumber
}

const LayoutReviewPanel: React.FC = () => {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [templates, setTemplates] = useState<Map<string, PageTemplate>>(new Map());
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected issue + current preview page
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState<number>(1);

  // Reject modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [rejectCommentError, setRejectCommentError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await layoutAPI.getLayouts({ status: 'in_review', limit: 100 });
      setLayouts(data);

      // Load templates for all unique templateIds
      const uniqueTemplateIds = Array.from(new Set(data.map(l => l.templateId)));
      const tmplEntries = await Promise.all(
        uniqueTemplateIds.map(async id => {
          try {
            const t = await templateAPI.getTemplateById(id);
            return [id, t] as [string, PageTemplate];
          } catch {
            return null;
          }
        })
      );
      const tmplMap = new Map<string, PageTemplate>();
      tmplEntries.forEach(e => { if (e) tmplMap.set(e[0], e[1]); });
      setTemplates(tmplMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить макеты');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Group by templateId → one group = one issue
  const issueGroups = useMemo((): IssueGroup[] => {
    const map = new Map<string, Layout[]>();
    layouts.forEach(l => {
      const key = l.templateId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    });
    return Array.from(map.entries()).map(([templateId, pages]) => ({
      templateId,
      pages: [...pages].sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0)),
    }));
  }, [layouts]);

  const selectedGroup = useMemo(
    () => issueGroups.find(g => g.templateId === selectedTemplateId) ?? null,
    [issueGroups, selectedTemplateId]
  );

  const currentPreviewLayout = useMemo(
    () => selectedGroup?.pages.find(p => p.pageNumber === previewPage) ?? selectedGroup?.pages[0] ?? null,
    [selectedGroup, previewPage]
  );

  const handleSelectGroup = (group: IssueGroup) => {
    setSelectedTemplateId(group.templateId);
    setPreviewPage(group.pages[0]?.pageNumber ?? 1);
  };

  const handleApprove = async () => {
    if (!selectedGroup) return;
    setActionLoading(true);
    setError(null);
    try {
      await Promise.all(
        selectedGroup.pages.map(p => layoutAPI.updateLayout(p.id, { status: 'published' }))
      );
      setSelectedTemplateId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось одобрить макет');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOpen = () => {
    setRejectComment('');
    setRejectCommentError(null);
    setRejectModalOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectComment.trim()) {
      setRejectCommentError('Замечания обязательны');
      return;
    }
    if (!selectedGroup) return;
    setActionLoading(true);
    setError(null);
    try {
      await Promise.all(
        selectedGroup.pages.map(p =>
          layoutAPI.updateLayout(p.id, { status: 'draft', reviewComment: rejectComment.trim() })
        )
      );
      setRejectModalOpen(false);
      setSelectedTemplateId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось вернуть макет');
    } finally {
      setActionLoading(false);
    }
  };

  const getTemplate = (layout: Layout | null): PageTemplate | null => {
    if (!layout) return null;
    if (layout.pageNumber === 1) return coverPageTemplate;
    return templates.get(layout.templateId) ?? null;
  };

  return (
    <div className="layout-review-panel">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button type="button" className="btn btn-auto" onClick={() => void refresh()} disabled={loading}>
          Обновить
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="layout-review-content">
        {/* Left: list of issues */}
        <div className="layout-review-list">
          {loading ? (
            <div className="empty-state"><p className="empty-state-title">Загрузка...</p></div>
          ) : issueGroups.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">Нет макетов на проверке</p>
              <p className="empty-state-text">Верстальщик ещё не отправил выпуск.</p>
            </div>
          ) : issueGroups.map(group => (
            <button
              key={group.templateId}
              type="button"
              className={`layout-review-item ${selectedTemplateId === group.templateId ? 'selected' : ''}`}
              onClick={() => handleSelectGroup(group)}
            >
              <div className="layout-review-item-title">
                {templates.get(group.templateId)?.name ?? 'Выпуск'}
              </div>
              <div className="layout-review-item-meta">
                {group.pages.length} стр. · {new Date(group.pages[0]?.updatedAt).toLocaleDateString('ru-RU')}
              </div>
            </button>
          ))}
        </div>

        {/* Right: preview */}
        <div className="layout-review-preview">
          {!selectedGroup ? (
            <div className="empty-state">
              <p className="empty-state-title">Выберите выпуск</p>
              <p className="empty-state-text">Нажмите на выпуск слева для просмотра</p>
            </div>
          ) : (
            <>
              {/* Actions */}
              <div className="layout-review-actions">
                <button
                  type="button"
                  className="btn btn-auto layout-review-approve"
                  onClick={() => void handleApprove()}
                  disabled={actionLoading}
                >
                  ✅ Одобрить выпуск
                </button>
                <button
                  type="button"
                  className="btn btn-auto task-danger"
                  onClick={handleRejectOpen}
                  disabled={actionLoading}
                >
                  ↩ На доработку
                </button>
              </div>

              {/* Page navigation */}
              <div className="layout-review-page-nav">
                {selectedGroup.pages.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`layout-review-page-btn ${previewPage === p.pageNumber ? 'active' : ''}`}
                    onClick={() => setPreviewPage(p.pageNumber ?? 1)}
                  >
                    {p.pageNumber === 1 ? 'Обложка' : `Стр. ${p.pageNumber}`}
                  </button>
                ))}
              </div>

              {/* Page preview */}
              {currentPreviewLayout && getTemplate(currentPreviewLayout) ? (
                currentPreviewLayout.pageNumber === 1 ? (
                  <CoverPage
                    template={coverPageTemplate}
                    newspaperTitle="XPress"
                    onNewspaperTitleChange={() => {}}
                    interactionDisabled={true}
                    illustrations={[]}
                    layoutIllustrations={currentPreviewLayout.illustrations ?? []}
                    onDropIllustration={() => {}}
                    onDeleteIllustration={() => {}}
                    ads={[]}
                    layoutAds={currentPreviewLayout.ads ?? []}
                    onDropAd={() => {}}
                    onDeleteAd={() => {}}
                  />
                ) : (
                  <PageLayout
                    template={getTemplate(currentPreviewLayout)!}
                    pageNumber={currentPreviewLayout.pageNumber ?? 1}
                    columns={currentPreviewLayout.columns}
                    articles={[]}
                    interactionDisabled={true}
                    onColumnHtmlChange={() => {}}
                    headerContent={currentPreviewLayout.headerContent ?? ''}
                    onHeaderChange={() => {}}
                  />
                )
              ) : (
                <div className="empty-state"><p>Загрузка шаблона...</p></div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Reject modal */}
      {rejectModalOpen && (
        <div className="task-modal-backdrop" onClick={() => !actionLoading && setRejectModalOpen(false)}>
          <div className="task-modal" onClick={e => e.stopPropagation()}>
            <div className="task-modal-header">
              <h3>Вернуть на доработку</h3>
            </div>
            <div className="task-form">
              {rejectCommentError && <div className="error-message">{rejectCommentError}</div>}
              <label className="template-select-label">
                Замечания *
                <textarea
                  className="template-select task-textarea"
                  value={rejectComment}
                  onChange={e => setRejectComment(e.target.value)}
                  disabled={actionLoading}
                  placeholder="Опишите что нужно исправить..."
                  rows={5}
                />
              </label>
            </div>
            <div className="task-modal-footer">
              <button type="button" className="btn btn-auto" onClick={() => setRejectModalOpen(false)} disabled={actionLoading}>
                Отмена
              </button>
              <button type="button" className="btn btn-auto task-danger" onClick={() => void handleRejectConfirm()} disabled={actionLoading}>
                {actionLoading ? 'Отправка...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LayoutReviewPanel;
