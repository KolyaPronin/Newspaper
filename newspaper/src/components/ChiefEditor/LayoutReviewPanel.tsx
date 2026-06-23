import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { layoutAPI, illustrationAPI, Illustration } from '../../utils/api';
import { issueAPI } from '../../api/issues';
import { getStaticAssetUrl } from '../../api/client';
import { Layout, PageTemplate } from '../../types/PageTemplate';
import PageLayout from '../../pages/LayoutDesigner/PageLayout';
import PageNavigation from '../LayoutDesigner/PageNavigation';
import { templateAPI } from '../../api/layouts';
import { coverPageTemplate } from '../../data/templates';
import CoverPage from '../../pages/LayoutDesigner/CoverPage';
import { useArticles } from '../../contexts/ArticleContext';
import { exportPagesToPdf, findLayoutPageElement } from '../../utils/exportIssuePdf';

interface IssueGroup {
  key: string;
  issueId: string | null;
  templateId: string;
  pages: Layout[];
}

const getGroupStatus = (group: IssueGroup): 'in_review' | 'published' => {
  if (group.pages.length > 0 && group.pages.every(p => p.status === 'published')) {
    return 'published';
  }
  return 'in_review';
};

const LayoutReviewPanel: React.FC = () => {
  const { articles } = useArticles();
  const pageWrapperRef = useRef<HTMLDivElement>(null);

  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [templates, setTemplates] = useState<Map<string, PageTemplate>>(new Map());
  const [illustrations, setIllustrations] = useState<Illustration[]>([]);
  const [ads, setAds] = useState<Illustration[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [pdfUrlByIssue, setPdfUrlByIssue] = useState<Record<string, string>>({});

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [rejectCommentError, setRejectCommentError] = useState<string | null>(null);

  const approvedArticles = useMemo(
    () => articles.filter(a => a.status === 'approved'),
    [articles],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, ills, adList] = await Promise.all([
        layoutAPI.getLayouts({ status: 'in_review,published', limit: 100 }),
        illustrationAPI.getAll({ kind: 'illustration', global: true }),
        illustrationAPI.getAll({ kind: 'ad', global: true }),
      ]);

      const articleIlls = await Promise.all(
        approvedArticles.map(async (article) => {
          try {
            return await illustrationAPI.getByArticle(article.id);
          } catch {
            return [];
          }
        }),
      );

      const mergedIllustrations = [...ills];
      const seenIllIds = new Set(ills.map(i => i.id));
      for (const list of articleIlls) {
        for (const ill of list) {
          if (!seenIllIds.has(ill.id)) {
            seenIllIds.add(ill.id);
            mergedIllustrations.push(ill);
          }
        }
      }

      setLayouts(data);
      setIllustrations(mergedIllustrations);
      setAds(adList);

      const uniqueTemplateIds = Array.from(new Set(data.map(l => l.templateId)));
      const tmplEntries = await Promise.all(
        uniqueTemplateIds.map(async id => {
          try {
            const t = await templateAPI.getTemplateById(id);
            return [id, t] as [string, PageTemplate];
          } catch {
            return null;
          }
        }),
      );
      const tmplMap = new Map<string, PageTemplate>();
      tmplEntries.forEach(e => { if (e) tmplMap.set(e[0], e[1]); });
      setTemplates(tmplMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить макеты');
    } finally {
      setLoading(false);
    }
  }, [approvedArticles]);

  useEffect(() => { void refresh(); }, [refresh]);

  const issueGroups = useMemo((): IssueGroup[] => {
    const map = new Map<string, IssueGroup>();
    layouts.forEach(l => {
      const key = l.issueId ? `issue:${l.issueId}` : `layout:${l.id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          issueId: l.issueId ?? null,
          templateId: l.templateId,
          pages: [],
        });
      }
      map.get(key)!.pages.push(l);
    });
    return Array.from(map.values()).map(group => ({
      ...group,
      pages: [...group.pages].sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0)),
    }));
  }, [layouts]);

  const selectedGroup = useMemo(
    () => issueGroups.find(g => g.key === selectedGroupKey) ?? null,
    [issueGroups, selectedGroupKey],
  );

  const selectedGroupStatus = selectedGroup ? getGroupStatus(selectedGroup) : null;

  useEffect(() => {
    if (!selectedGroup?.issueId) return;
    const issueId = selectedGroup.issueId;
    if (pdfUrlByIssue[issueId]) return;

    void issueAPI.getIssueById(issueId)
      .then((issue) => {
        if (issue.pdfPath) {
          setPdfUrlByIssue(prev => ({
            ...prev,
            [issueId]: getStaticAssetUrl(`/uploads/${issue.pdfPath}`),
          }));
        }
      })
      .catch(() => {});
  }, [selectedGroup?.issueId, pdfUrlByIssue]);

  const currentPreviewLayout = useMemo(
    () => selectedGroup?.pages.find(p => p.pageNumber === previewPage) ?? selectedGroup?.pages[0] ?? null,
    [selectedGroup, previewPage],
  );

  const reviewPageNumbers = useMemo(
    () => selectedGroup?.pages
      .map(p => p.pageNumber ?? 0)
      .filter(n => n > 0)
      .sort((a, b) => a - b) ?? [],
    [selectedGroup],
  );

  const reviewTotalPages = reviewPageNumbers.length > 0
    ? Math.max(...reviewPageNumbers)
    : 1;

  const handleSelectGroup = (group: IssueGroup) => {
    setSelectedGroupKey(group.key);
    setPreviewPage(group.pages[0]?.pageNumber ?? 1);
    setSuccessMessage(null);
    setError(null);
  };

  const generateAndSavePdf = async (group: IssueGroup, downloadName: string) => {
    setPdfGenerating(true);
    try {
      const pageNumbers = [...group.pages]
        .map(p => p.pageNumber ?? 0)
        .filter(n => n > 0)
        .sort((a, b) => a - b);

      const originalPage = previewPage;
      const pdf = await exportPagesToPdf(
        () => findLayoutPageElement(pageWrapperRef.current),
        pageNumbers.length,
        (index) => setPreviewPage(pageNumbers[index]),
      );

      setPreviewPage(originalPage);
      pdf.save(downloadName);

      if (group.issueId) {
        const blob = pdf.output('blob');
        const uploaded = await issueAPI.uploadPdf(group.issueId, blob, downloadName);
        setPdfUrlByIssue(prev => ({
          ...prev,
          [group.issueId!]: getStaticAssetUrl(uploaded.pdfUrl),
        }));
      }

      return true;
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedGroup) return;
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const approvedPages = await Promise.all(
        selectedGroup.pages.map(p => layoutAPI.updateLayout(p.id, { status: 'published' })),
      );

      const approvedIds = new Set(approvedPages.map(p => p.id));
      setLayouts(prev => prev.map(layout => (
        approvedIds.has(layout.id)
          ? { ...layout, status: 'published' as const, reviewComment: null }
          : layout
      )));

      const downloadName = `vypusk-${selectedGroup.issueId ?? selectedGroup.key}-${Date.now()}.pdf`;
      await generateAndSavePdf(
        { ...selectedGroup, pages: approvedPages },
        downloadName,
      );

      setSuccessMessage('Выпуск одобрен, статус «Готово». PDF сформирован и сохранён.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось одобрить макет');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedGroup) return;
    const issueId = selectedGroup.issueId;
    const cachedUrl = issueId ? pdfUrlByIssue[issueId] : null;

    if (cachedUrl) {
      window.open(cachedUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setError(null);
    try {
      const downloadName = `vypusk-${issueId ?? selectedGroup.key}.pdf`;
      await generateAndSavePdf(selectedGroup, downloadName);
      setSuccessMessage('PDF сформирован.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сформировать PDF');
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
          layoutAPI.updateLayout(p.id, { status: 'draft', reviewComment: rejectComment.trim() }),
        ),
      );
      setRejectModalOpen(false);
      setSelectedGroupKey(null);
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

  const getGroupLabel = (group: IssueGroup): string => {
    const tmplName = templates.get(group.templateId)?.name;
    const pageNums = group.pages.map(p => p.pageNumber).filter(Boolean).sort((a, b) => (a ?? 0) - (b ?? 0));
    const range = pageNums.length > 0
      ? pageNums.length === 1
        ? `стр. ${pageNums[0]}`
        : `стр. ${pageNums[0]}–${pageNums[pageNums.length - 1]}`
      : '';
    if (group.issueId) {
      return tmplName ? `${tmplName} (${range})` : `Выпуск (${range})`;
    }
    return tmplName ? `${tmplName} · ${range}` : `Макет · ${range}`;
  };

  const busy = actionLoading || pdfGenerating;
  const selectedPdfUrl = selectedGroup?.issueId ? pdfUrlByIssue[selectedGroup.issueId] : null;

  return (
    <div className="layout-review-panel">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button type="button" className="btn btn-auto" onClick={() => void refresh()} disabled={loading}>
          Обновить
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="layout-review-success">{successMessage}</div>}

      <div className="layout-workspace-content">
        <div className="layout-review-list">
          {loading ? (
            <div className="empty-state"><p className="empty-state-title">Загрузка...</p></div>
          ) : issueGroups.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">Нет макетов</p>
              <p className="empty-state-text">Верстальщик ещё не отправил выпуск на проверку.</p>
            </div>
          ) : issueGroups.map(group => {
            const status = getGroupStatus(group);
            return (
              <button
                key={group.key}
                type="button"
                className={`layout-review-item ${selectedGroupKey === group.key ? 'selected' : ''}`}
                onClick={() => handleSelectGroup(group)}
              >
                <div className="layout-review-item-title">
                  {getGroupLabel(group)}
                </div>
                <div className="layout-review-item-meta">
                  <span className={`layout-review-status layout-review-status-${status}`}>
                    {status === 'published' ? 'Готово' : 'На проверке'}
                  </span>
                  {' · '}
                  {group.pages.length} стр. · {new Date(group.pages[0]?.updatedAt).toLocaleDateString('ru-RU')}
                </div>
              </button>
            );
          })}
        </div>

        <div className="layout-review-preview">
          {!selectedGroup ? (
            <div className="empty-state">
              <p className="empty-state-title">Выберите выпуск</p>
              <p className="empty-state-text">Нажмите на выпуск слева для просмотра</p>
            </div>
          ) : (
            <>
              <div className="layout-review-actions">
                {selectedGroupStatus === 'published' ? (
                  <>
                    <span className="layout-status-badge layout-status-published">
                      ✅ Готово
                    </span>
                    <button
                      type="button"
                      className="btn btn-auto"
                      onClick={() => void handleDownloadPdf()}
                      disabled={busy}
                    >
                      {pdfGenerating ? 'Формирование PDF...' : selectedPdfUrl ? 'Скачать PDF' : 'Сформировать PDF'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-auto layout-review-approve"
                      onClick={() => void handleApprove()}
                      disabled={busy}
                    >
                      {actionLoading ? 'Одобрение...' : pdfGenerating ? 'Формирование PDF...' : '✅ Одобрить выпуск'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-auto task-danger"
                      onClick={handleRejectOpen}
                      disabled={busy}
                    >
                      ↩ На доработку
                    </button>
                  </>
                )}
              </div>

              <div className="layout-page-area">
                <div className="page-layout-wrapper" ref={pageWrapperRef}>
                  {currentPreviewLayout && getTemplate(currentPreviewLayout) ? (
                    previewPage === 1 ? (
                      <CoverPage
                        template={coverPageTemplate}
                        newspaperTitle="XPress"
                        onNewspaperTitleChange={() => {}}
                        interactionDisabled={true}
                        illustrations={illustrations}
                        layoutIllustrations={currentPreviewLayout.illustrations ?? []}
                        ads={ads}
                        layoutAds={currentPreviewLayout.ads ?? []}
                      />
                    ) : (
                      <PageLayout
                        template={getTemplate(currentPreviewLayout)!}
                        pageNumber={currentPreviewLayout.pageNumber ?? 1}
                        columns={currentPreviewLayout.columns}
                        articles={approvedArticles}
                        interactionDisabled={true}
                        onColumnHtmlChange={() => {}}
                        headerContent={currentPreviewLayout.headerContent ?? ''}
                        onHeaderChange={() => {}}
                        illustrations={illustrations}
                        layoutIllustrations={currentPreviewLayout.illustrations ?? []}
                        ads={ads}
                        layoutAds={currentPreviewLayout.ads ?? []}
                      />
                    )
                  ) : (
                    <div className="empty-state"><p>Загрузка шаблона...</p></div>
                  )}
                  <PageNavigation
                    currentPage={previewPage}
                    totalPages={reviewTotalPages}
                    availablePages={reviewPageNumbers}
                    onPageChange={setPreviewPage}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

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
