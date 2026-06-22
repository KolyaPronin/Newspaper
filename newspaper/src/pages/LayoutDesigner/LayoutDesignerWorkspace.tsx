import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useArticles } from '../../contexts/ArticleContext';
import { PageTemplate, ColumnContainer } from '../../types/PageTemplate';
import { defaultPageTemplate, coverPageTemplate, TOTAL_PAGES } from '../../data/templates';
import PageLayout from './PageLayout';
import CoverPage from './CoverPage';
import LayoutHeader from '../../components/LayoutDesigner/LayoutHeader';
import LayoutArticlesSidebar from '../../components/LayoutDesigner/LayoutArticlesSidebar';
import PageNavigation from '../../components/LayoutDesigner/PageNavigation';
import { PageData } from './workspace/types';
import { buildEmptyColumns as buildEmptyColumnsPure, initPageData as initPageDataPure } from './workspace/columns';
import { getColumnHtml, setColumnHtmlInPageColumns, EMPTY_COLUMN_HTML } from './workspace/columnHtml/columnHtmlModel';
import { useIllustrationsAssets } from './workspace/useIllustrationsAssets';
import { useTemplatesAndLayouts } from './workspace/useTemplatesAndLayouts';
import { useLayoutAutoSave } from './workspace/useLayoutAutoSave';
import { useLayoutDesignerBulkActions } from './workspace/useLayoutDesignerBulkActions';
import { useLayoutDesignerSlotActions } from './workspace/useLayoutDesignerSlotActions';
import { useLayoutDesignerDragStart } from './workspace/useLayoutDesignerDragStart';
import MyTasksPage from '../Tasks/MyTasksPage';
import { useUnreadTasks } from '../../hooks/useUnreadTasks';
import { layoutAPI, taskAPI, transformTask } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContexts';

const LayoutDesignerWorkspace: React.FC = () => {
  const { user } = useAuth();
  const { articles } = useArticles();
  const [layoutIssueId, setLayoutIssueId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'layout' | 'tasks'>('layout');
  const { unreadCount, markAllSeen } = useUnreadTasks();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [newspaperTitle, setNewspaperTitle] = useState<string>('XPress');
  // Данные для всех страниц
  const [pagesData, setPagesData] = useState<Record<number, PageData>>({});
  
  const [autoSaveMessage, setAutoSaveMessage] = useState<string | null>('Нет изменений');
  const [saveError, setSaveError] = useState<string | null>(null);
  const skipAutoSaveRef = useRef<boolean>(false);
  const [submitForReviewLoading, setSubmitForReviewLoading] = useState(false);

  const buildEmptyColumns = useCallback((template: PageTemplate): ColumnContainer[][] => {
    return buildEmptyColumnsPure(template);
  }, []);

  const { templates, selectedTemplate, templatesLoading, templatesError, layoutsLoading, fetchTemplates, handleTemplateChange, handleReloadTemplate } = useTemplatesAndLayouts({
    buildEmptyColumns,
    setPagesData,
    setAutoSaveMessage,
    setSaveError,
  });

  const getTemplateForPage = useCallback((pageNumber: number): PageTemplate => {
    if (pageNumber === 1) {
      return coverPageTemplate;
    }
    return selectedTemplate || defaultPageTemplate;
  }, [selectedTemplate]);

  // Получить данные текущей страницы
  const currentPageData = useMemo(() => {
    return pagesData[currentPage] || {
      columns: [],
      headerContent: currentPage === 1 ? '' : 'Заголовок газеты',
      layoutTitle: currentPage === 1 ? 'Обложка' : `Страница ${currentPage}`,
      layoutId: null,
      layoutIllustrations: [],
      layoutAds: [],
    };
  }, [pagesData, currentPage]);

  const approvedArticles = useMemo(
    () => articles.filter(a => a.status === 'approved'),
    [articles]
  );

  const { allIllustrations, allAds } = useIllustrationsAssets(approvedArticles);

  const initPageData = useCallback((pageNum: number, template: PageTemplate): PageData => {
    return initPageDataPure(pageNum, template);
  }, []);

  // Measurement host: a real DOM element attached once, reused for all pagination measurements.
  const measureHostRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.top      = '0';
    host.style.left     = '-10000px';
    host.style.visibility   = 'hidden';
    host.style.pointerEvents = 'none';
    host.style.overflow = 'visible';
    document.body.appendChild(host);
    measureHostRef.current = host;
    return () => { host.remove(); };
  }, []);

  /**
   * Distribute text blocks linearly across all columns of all pages starting from
   * (startPage, startColIndex). Text flows: col0 → col1 → col2 → page+1 col0 → …
   * Anchor blocks (.flow-anchor-block) are kept on their original (page, col) slot.
   */
  const paginateFromPoint = useCallback((
    pagesDataSnapshot: Record<number, PageData>,
    startPage: number,
    startColIndex: number,
    startHtml: string,
    colWidthPx: number,
    colHeightPx: number,
  ): Record<number, PageData> => {
    const next = { ...pagesDataSnapshot };

    // 1. Collect all pageable blocks + per-slot anchor blocks
    const allBlocks: HTMLElement[] = [];
    const anchorsBySlot = new Map<string, HTMLElement[]>();

    for (let p = startPage; p <= TOTAL_PAGES; p++) {
      const t = getTemplateForPage(p);
      const colCount = t.columns;
      const base = next[p] || initPageData(p, t);
      const cols = base.columns?.length ? base.columns : buildEmptyColumns(t);

      const cStart = (p === startPage) ? startColIndex : 0;
      for (let c = cStart; c < colCount; c++) {
        const htmlStr = (p === startPage && c === startColIndex)
          ? startHtml
          : getColumnHtml(cols, c);

        const tmpRoot = document.createElement('div');
        tmpRoot.innerHTML = htmlStr;
        const anchors: HTMLElement[] = [];
        tmpRoot.childNodes.forEach(child => {
          if (!(child instanceof HTMLElement)) return;
          if (child.classList.contains('flow-anchor-block')) {
            anchors.push(child.cloneNode(true) as HTMLElement);
          } else {
            allBlocks.push(child);
          }
        });
        anchorsBySlot.set(`${p},${c}`, anchors);
      }
    }

    const host = measureHostRef.current;
    if (!host) return next;
    host.style.width = `${colWidthPx}px`;

    // 2. Distribute blocks across (page, col) slots in linear order
    let blockIdx = 0;

    for (let p = startPage; p <= TOTAL_PAGES; p++) {
      const t = getTemplateForPage(p);
      const colCount = t.columns;
      const base = next[p] || initPageData(p, t);
      let cols = (base.columns?.length ? base.columns : buildEmptyColumns(t))
        .map(col => col.map(c => ({ ...c })));

      const cStart = (p === startPage) ? startColIndex : 0;
      for (let c = cStart; c < colCount; c++) {
        host.innerHTML = '';
        const body = document.createElement('div');
        body.style.minHeight = '0';
        body.style.lineHeight = '1.45';
        body.style.fontSize = '14px';
        body.style.wordBreak = 'break-word';
        body.style.overflowWrap = 'break-word';
        host.appendChild(body);

        while (blockIdx < allBlocks.length) {
          const node = allBlocks[blockIdx].cloneNode(true) as HTMLElement;
          body.appendChild(node);
          if (body.scrollHeight > colHeightPx + 4) {
            body.removeChild(node);
            break;
          }
          blockIdx++;
        }

        // Re-attach anchor blocks for this slot (they don't move)
        (anchorsBySlot.get(`${p},${c}`) || []).forEach(ab => body.appendChild(ab));

        const htmlForCol = body.innerHTML.trim() || EMPTY_COLUMN_HTML;
        cols = setColumnHtmlInPageColumns(cols, c, htmlForCol);
      }

      next[p] = { ...base, columns: cols };
    }

    return next;
  }, [buildEmptyColumns, getTemplateForPage, initPageData]);

  const handleColumnHtmlChange = useCallback((colIndex: number, html: string) => {
    const livePageEl = document.querySelector<HTMLElement>('.page-layout');
    const colEl      = document.querySelector<HTMLElement>(`.col-flow-body[data-column-index="${colIndex}"]`);

    const pageW    = livePageEl ? livePageEl.clientWidth  : 794;
    const colH     = colEl      ? colEl.clientHeight       : 900;
    const colCount = getTemplateForPage(currentPage).columns;
    const colW     = Math.max(80, Math.floor((pageW - 32 - (colCount - 1) * 16) / colCount));

    setPagesData(prev => paginateFromPoint(prev, currentPage, colIndex, html, colW, colH));
  }, [currentPage, getTemplateForPage, paginateFromPoint, setPagesData]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const raw = await taskAPI.getTasks({ limit: 100 });
        const mine = raw.map(transformTask).filter((t) => !t.isIssueTask);
        const layoutTask = mine.find(
          (t) =>
            t.assigneeRole === 'layout_designer' &&
            t.issueId &&
            t.status !== 'done' &&
            t.status !== 'cancelled'
        );
        setLayoutIssueId(layoutTask?.issueId ?? null);
      } catch {
        setLayoutIssueId(null);
      }
    })();
  }, [user]);

  useLayoutAutoSave({
    selectedTemplate,
    currentPage,
    pagesData,
    getTemplateForPage,
    layoutsLoading,
    templatesLoading,
    issueId: layoutIssueId,
    skipAutoSaveRef,
    setPagesData,
    setAutoSaveMessage,
    setSaveError,
  });

  const handlePageChange = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber);
    skipAutoSaveRef.current = true;
  }, []);

  const updateCurrentPageData = useCallback((updates: Partial<PageData>) => {
    setPagesData(prev => {
      const template = getTemplateForPage(currentPage);
      const base = prev[currentPage] || initPageData(currentPage, template);
      return {
        ...prev,
        [currentPage]: {
          ...base,
          ...updates,
        },
      };
    });
  }, [currentPage, getTemplateForPage, initPageData]);

  const { bulkActionLoading: bulkActionLoadingFromHook, handleClearCurrentPage, handleClearAllPages } = useLayoutDesignerBulkActions({
    currentPage,
    pagesData,
    getTemplateForPage,
    initPageData,
    buildEmptyColumns,
    setPagesData,
    setSaveError,
    setAutoSaveMessage,
    skipAutoSaveRef,
  });

  const bulkActionLoading = bulkActionLoadingFromHook;

  const { handleDropIllustration, handleDeleteIllustration, handleDropAd, handleDeleteAd } = useLayoutDesignerSlotActions({
    allIllustrations,
    allAds,
    currentPage,
    currentPageData,
    getTemplateForPage,
    updateCurrentPageData,
  });

  const { handleArticleDragStart, handleIllustrationDragStart, handleAdDragStart } = useLayoutDesignerDragStart();

  const handleHeaderChange = useCallback((content: string) => {
    void content;
  }, []);

  // Compute issue-level status: in_review if any page is in_review, published if all are published
  const issueStatus = useMemo((): 'draft' | 'in_review' | 'published' | undefined => {
    const statuses = Object.values(pagesData)
      .map(p => p.layoutStatus)
      .filter(Boolean) as Array<'draft' | 'in_review' | 'published'>;
    if (statuses.length === 0) return undefined;
    if (statuses.some(s => s === 'in_review')) return 'in_review';
    if (statuses.every(s => s === 'published')) return 'published';
    return 'draft';
  }, [pagesData]);

  // reviewComment from any page that has one (most recent)
  const issueReviewComment = useMemo((): string | null => {
    for (let p = 1; p <= TOTAL_PAGES; p++) {
      const c = pagesData[p]?.reviewComment;
      if (c) return c;
    }
    return null;
  }, [pagesData]);

  const hasDraftPages = useMemo(
    () => Object.values(pagesData).some(
      (p) => p.layoutId && (p.layoutStatus === 'draft' || !p.layoutStatus),
    ),
    [pagesData],
  );

  const handleSubmitForReview = useCallback(async () => {
    const savedPages = Object.entries(pagesData)
      .filter(([, data]) => data.layoutId && (data.layoutStatus === 'draft' || !data.layoutStatus))
      .map(([pageNum, data]) => ({ pageNum: Number(pageNum), layoutId: data.layoutId! }));

    if (savedPages.length === 0) {
      setSaveError('Сначала сохраните хотя бы одну страницу макета');
      return;
    }
    setSubmitForReviewLoading(true);
    setSaveError(null);
    try {
      await Promise.all(
        savedPages.map(({ layoutId }) =>
          layoutAPI.updateLayout(layoutId, { status: 'in_review' }),
        ),
      );
      setPagesData((prev) => {
        const next = { ...prev };
        savedPages.forEach(({ pageNum }) => {
          if (next[pageNum]) {
            next[pageNum] = { ...next[pageNum], layoutStatus: 'in_review', reviewComment: null };
          }
        });
        return next;
      });
      setAutoSaveMessage('Весь выпуск отправлен главреду на проверку');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Ошибка отправки на проверку');
    } finally {
      setSubmitForReviewLoading(false);
    }
  }, [pagesData, setAutoSaveMessage, setSaveError]);

  const currentTemplate = getTemplateForPage(currentPage);

  return (
    <div className="layout-designer-workspace">
      <div className="workspace-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>{activeView === 'layout' ? 'Верстка страницы' : 'Мои задачи'}</h1>
          <p>{activeView === 'layout' ? 'Выберите шаблон и загрузите макет из базы' : 'Задачи, назначенные на вашу роль.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn-auto ${activeView === 'layout' ? 'active' : ''}`}
            onClick={() => setActiveView('layout')}
          >
            Макет
          </button>
          <button
            type="button"
            className={`btn btn-auto ${activeView === 'tasks' ? 'active' : ''}`}
            onClick={() => { setActiveView('tasks'); void markAllSeen(); }}
            style={{ position: 'relative' }}
          >
            Задачи
            {unreadCount > 0 && <span className="tasks-badge">{unreadCount}</span>}
          </button>
        </div>
      </div>

      {activeView === 'tasks' ? (
        <MyTasksPage variant="layout" />
      ) : (
        <>
      <LayoutHeader
        selectedTemplate={selectedTemplate}
        templates={templates}
        templatesLoading={templatesLoading}
        layoutsLoading={layoutsLoading}
        currentPage={currentPage}
        bulkActionLoading={bulkActionLoading}
        onTemplateChange={handleTemplateChange}
        onReloadTemplate={handleReloadTemplate}
        onRefreshTemplates={fetchTemplates}
        onClearCurrentPage={handleClearCurrentPage}
        onClearAllPages={handleClearAllPages}
        autoSaveMessage={autoSaveMessage}
        layoutId={hasDraftPages ? 'has-draft' : null}
        hasDraftLayouts={hasDraftPages}
        layoutStatus={issueStatus}
        reviewComment={issueReviewComment}
        onSubmitForReview={handleSubmitForReview}
        submitForReviewLoading={submitForReviewLoading}
      />

      {templatesError && (
        <div className="error-message">
          {templatesError}. Используется локальный шаблон по умолчанию.
        </div>
      )}

      {saveError && (
        <div className="error-message">
          {saveError}
        </div>
      )}

      {!selectedTemplate ? (
        <div className="empty-state">
          <p className="empty-state-title">Шаблоны не найдены</p>
          <p className="empty-state-text">Добавьте шаблон через API или используйте локальный.</p>
        </div>
      ) : (
        <>
          <div className="layout-workspace-content">
            <LayoutArticlesSidebar
              approvedArticles={approvedArticles}
              allIllustrations={allIllustrations.filter(i => i.kind !== 'ad')}
              allAds={allAds}
              onArticleDragStart={handleArticleDragStart}
              onIllustrationDragStart={handleIllustrationDragStart}
              onAdDragStart={handleAdDragStart}
            />
            <div className="layout-page-area">
              <div className="page-layout-wrapper">
                {currentPage === 1 ? (
                  <CoverPage
                    template={currentTemplate}
                    newspaperTitle={newspaperTitle}
                    onNewspaperTitleChange={setNewspaperTitle}
                    interactionDisabled={layoutsLoading || templatesLoading}
                    illustrations={allIllustrations}
                    layoutIllustrations={currentPageData.layoutIllustrations}
                    onDropIllustration={handleDropIllustration}
                    onDeleteIllustration={handleDeleteIllustration}
                    ads={allAds}
                    layoutAds={currentPageData.layoutAds}
                    onDropAd={handleDropAd}
                    onDeleteAd={handleDeleteAd}
                  />
                ) : (
                  <PageLayout
                    template={currentTemplate}
                    pageNumber={currentPage}
                    columns={currentPageData.columns}
                    articles={approvedArticles}
                    interactionDisabled={layoutsLoading || templatesLoading}
                    onColumnHtmlChange={handleColumnHtmlChange}
                    headerContent={currentPageData.headerContent}
                    onHeaderChange={handleHeaderChange}
                    illustrations={allIllustrations}
                    layoutIllustrations={currentPageData.layoutIllustrations}
                    onDropIllustration={handleDropIllustration}
                    onDeleteIllustration={handleDeleteIllustration}
                  />
                )}
                <PageNavigation
                  currentPage={currentPage}
                  totalPages={TOTAL_PAGES}
                  onPageChange={handlePageChange}
                />
              </div>
            </div>
          </div>
        </>
      )}
        </>
      )}
    </div>
  );
};

export default LayoutDesignerWorkspace;
