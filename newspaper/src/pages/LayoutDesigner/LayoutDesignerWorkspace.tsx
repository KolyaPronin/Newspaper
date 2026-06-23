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
import { getColumnHtml, setColumnHtmlInPageColumns, EMPTY_COLUMN_HTML, columnHtmlToContainers, isEmptyPlaceholderElement } from './workspace/columnHtml/columnHtmlModel';
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
import { issueAPI } from '../../api/issues';

// ─── Paragraph-level block splitting for pagination ──────────────────────────

/**
 * Collects HTML tokens from a paragraph element.
 * Text nodes are split at word boundaries; inline elements are kept whole.
 */
function extractParagraphTokens(p: HTMLElement): string[] {
  const tokens: string[] = [];
  p.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      const parts = text.match(/\S+\s*|\s+/g);
      if (parts) {
        for (const part of parts) {
          tokens.push(
            part
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;'),
          );
        }
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      tokens.push((child as Element).outerHTML);
    }
  });
  return tokens;
}

/**
 * Tries to split a `.flow-object` block at a word boundary so that the first
 * part fills the remaining column space and the rest goes to the next column.
 * Returns null if the block cannot or should not be split.
 *
 * @param block      – the overflow block from allBlocks
 * @param body       – measurement div that already contains the preceding blocks
 * @param colHeightPx – available column height
 */
function trySplitFlowBlock(
  block: HTMLElement,
  body: HTMLElement,
  colHeightPx: number,
): { first: HTMLElement; rest: HTMLElement } | null {
  const usedHeight = body.scrollHeight;
  const remaining = colHeightPx + 4 - usedHeight;
  if (remaining < 20) return null; // not enough room for even one line

  if (block.classList.contains('flow-anchor-block')) return null;

  const innerP = block.querySelector<HTMLElement>(':scope > p');
  if (!innerP) return null; // headings, etc. — don't split

  const tokens = extractParagraphTokens(innerP);
  if (tokens.length < 2) return null;

  const restContent = tokens.join('').trim();
  if (!restContent) return null;

  // Binary search: find max prefix of tokens that fits within colHeightPx
  let lo = 1, hi = tokens.length - 1, bestSplit = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const testEl = block.cloneNode(false) as HTMLElement;
    const testP = document.createElement('p');
    testP.innerHTML = tokens.slice(0, mid).join('');
    testEl.appendChild(testP);
    body.appendChild(testEl);
    const fits = body.scrollHeight <= colHeightPx + 4;
    body.removeChild(testEl);
    if (fits) { bestSplit = mid; lo = mid + 1; }
    else        { hi = mid - 1; }
  }

  if (bestSplit === 0 || bestSplit >= tokens.length) return null;

  const firstContent = tokens.slice(0, bestSplit).join('').trim();
  const remainContent = tokens.slice(bestSplit).join('').trim();
  if (!firstContent || !remainContent) return null;

  // First part: keep delete buttons from the original block
  const firstWrapper = block.cloneNode(false) as HTMLElement;
  block.querySelectorAll<HTMLElement>(':scope > .flow-delete-btn').forEach(btn => {
    firstWrapper.appendChild(btn.cloneNode(true) as HTMLElement);
  });
  const firstP = document.createElement('p');
  firstP.innerHTML = tokens.slice(0, bestSplit).join('');
  firstWrapper.appendChild(firstP);

  // Rest part: same attributes (data-article-id etc.) but no delete buttons
  const restWrapper = block.cloneNode(false) as HTMLElement;
  const restP = document.createElement('p');
  restP.innerHTML = tokens.slice(bestSplit).join('');
  restWrapper.appendChild(restP);

  return { first: firstWrapper, rest: restWrapper };
}

const LayoutDesignerWorkspace: React.FC = () => {
  const { user } = useAuth();
  const { articles } = useArticles();
  const [layoutIssueId, setLayoutIssueId] = useState<string | null>(null);
  const [issuePageCount, setIssuePageCount] = useState<number | null>(null);
  const totalPages = issuePageCount ?? TOTAL_PAGES;
  const [activeView, setActiveView] = useState<'layout' | 'tasks'>('layout');
  const { unreadCount, markAllSeen } = useUnreadTasks();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [newspaperTitle, setNewspaperTitle] = useState<string>('XPress');
  const [pagesData, setPagesData] = useState<Record<number, PageData>>({});
  
  const [autoSaveMessage, setAutoSaveMessage] = useState<string | null>('Нет изменений');
  const [saveError, setSaveError] = useState<string | null>(null);
  const skipAutoSaveRef = useRef<boolean>(false);
  const [submitForReviewLoading, setSubmitForReviewLoading] = useState(false);

  const buildEmptyColumns = useCallback((template: PageTemplate): ColumnContainer[][] => {
    return buildEmptyColumnsPure(template);
  }, []);

  const { templates, selectedTemplate, templatesLoading, templatesError, layoutsLoading, fetchTemplates, handleTemplateChange, handleReloadTemplate, loadLayoutsForAllPages } = useTemplatesAndLayouts({
    buildEmptyColumns,
    setPagesData,
    setAutoSaveMessage,
    setSaveError,
    issueId: layoutIssueId,
    totalPages,
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

  const illustrationUrlToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const ill of allIllustrations) {
      if (ill.kind !== 'ad') {
        map.set(ill.url, ill.id);
      }
    }
    return map;
  }, [allIllustrations]);

  // Collect all articleIds placed in any column on any page by scanning HTML content
  const placedArticleIds = useMemo(() => {
    const ids = new Set<string>();
    const re = /data-article-id="([^"]+)"/g;
    for (const pageData of Object.values(pagesData)) {
      for (const colContainers of pageData.columns) {
        for (const cont of colContainers) {
          if (!cont.content || !cont.isFilled) continue;
          re.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = re.exec(cont.content)) !== null) {
            ids.add(m[1]);
          }
        }
      }
    }
    return ids;
  }, [pagesData]);

  // Collect illustrationIds placed on any page via slots, column containers, or column HTML
  const placedIllustrationIds = useMemo(() => {
    const ids = new Set<string>();
    const reDataId = /data-illustration-id="([^"]+)"/g;
    const reInlineImgSrc = /src="([^"]+)"[^>]*class="column-inline-img"/g;

    for (const pageData of Object.values(pagesData)) {
      for (const li of pageData.layoutIllustrations) {
        ids.add(li.illustrationId);
      }
      for (const colContainers of pageData.columns) {
        for (const cont of colContainers) {
          if (cont.isFilled && cont.kind === 'illustration' && cont.illustrationId) {
            ids.add(cont.illustrationId);
          }
          if (!cont.content) continue;

          reDataId.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = reDataId.exec(cont.content)) !== null) {
            ids.add(m[1]);
          }

          reInlineImgSrc.lastIndex = 0;
          while ((m = reInlineImgSrc.exec(cont.content)) !== null) {
            const id = illustrationUrlToId.get(m[1]);
            if (id) ids.add(id);
          }
        }
      }
    }
    return ids;
  }, [pagesData, illustrationUrlToId]);

  const placedAdIds = useMemo(() => {
    const ids = new Set<string>();
    for (const pageData of Object.values(pagesData)) {
      for (const la of pageData.layoutAds) {
        ids.add(la.illustrationId);
      }
    }
    return ids;
  }, [pagesData]);

  // Articles not yet placed on any layout page
  const sidebarArticles = useMemo(
    () => approvedArticles.filter(a => !placedArticleIds.has(a.id)),
    [approvedArticles, placedArticleIds]
  );

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

    for (let p = startPage; p <= totalPages; p++) {
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
          } else if (!isEmptyPlaceholderElement(child)) {
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

    for (let p = startPage; p <= totalPages; p++) {
      const t = getTemplateForPage(p);
      const colCount = t.columns;
      const base = next[p] || initPageData(p, t);
      let cols = (base.columns?.length ? base.columns : buildEmptyColumns(t))
        .map(col => col.map(c => ({ ...c })));

      const cStart = (p === startPage) ? startColIndex : 0;
      for (let c = cStart; c < colCount; c++) {
        host.innerHTML = '';
        const body = document.createElement('div');
        // Apply real column class so CSS rules (paragraph margins, hyphens, justify)
        // match the actual rendering. Override layout-blocking properties.
        body.className = 'col-flow-body';
        body.style.position = 'static';
        body.style.height = 'auto';
        body.style.overflow = 'visible';
        body.style.width = `${colWidthPx}px`;
        body.style.minHeight = '0';
        host.appendChild(body);

        while (blockIdx < allBlocks.length) {
          const node = allBlocks[blockIdx].cloneNode(true) as HTMLElement;
          body.appendChild(node);
          if (body.scrollHeight > colHeightPx + 4) {
            body.removeChild(node);
            // Try word-level split so remaining column space is used
            const split = trySplitFlowBlock(allBlocks[blockIdx], body, colHeightPx);
            if (split) {
              body.appendChild(split.first);
              allBlocks[blockIdx] = split.rest; // rest goes to next column
            }
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
  }, [buildEmptyColumns, getTemplateForPage, initPageData, totalPages]);

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
        const issueId = layoutTask?.issueId ?? null;
        setLayoutIssueId(issueId);

        if (issueId) {
          try {
            const issue = await issueAPI.getIssueById(issueId);
            if (issue.pageCount && issue.pageCount > 0) {
              setIssuePageCount(issue.pageCount);
            }
          } catch {
            // pageCount remains null, falls back to TOTAL_PAGES
          }
        }
      } catch {
        setLayoutIssueId(null);
      }
    })();
  }, [user]);

  // Reload layouts when issueId becomes known (initial load runs without issueId)
  const prevIssueIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevIssueIdRef.current === undefined) {
      prevIssueIdRef.current = layoutIssueId;
      return;
    }
    if (prevIssueIdRef.current === layoutIssueId) return;
    prevIssueIdRef.current = layoutIssueId;
    if (selectedTemplate && layoutIssueId) {
      skipAutoSaveRef.current = true;
      void loadLayoutsForAllPages(selectedTemplate, layoutIssueId);
    }
  }, [layoutIssueId, selectedTemplate, loadLayoutsForAllPages]);

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

  // Delete an article from ALL columns on ALL pages
  const handleDeleteArticle = useCallback((articleId: string) => {
    const escaped = articleId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    setPagesData(prev => {
      const next = { ...prev };
      for (const pageNumStr of Object.keys(next)) {
        const pageNum = Number(pageNumStr);
        const pageData = next[pageNum];
        const newCols = pageData.columns.map((colContainers, colIdx) => {
          const currentHtml = getColumnHtml(pageData.columns, colIdx);
          const div = document.createElement('div');
          div.innerHTML = currentHtml;
          div.querySelectorAll(`[data-article-id="${escaped}"]`).forEach(n => n.remove());
          const newHtml = div.innerHTML.trim() || EMPTY_COLUMN_HTML;
          return columnHtmlToContainers(newHtml, colIdx);
        });
        next[pageNum] = { ...pageData, columns: newCols };
      }
      return next;
    });
  }, [setPagesData]);

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
    for (let p = 1; p <= totalPages; p++) {
      const c = pagesData[p]?.reviewComment;
      if (c) return c;
    }
    return null;
  }, [pagesData, totalPages]);

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
          layoutAPI.updateLayout(layoutId, {
            status: 'in_review',
            ...(layoutIssueId ? { issueId: layoutIssueId } : {}),
          }),
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
      setAutoSaveMessage('Весь выпуск отправлен главному редактору на проверку');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Ошибка отправки на проверку');
    } finally {
      setSubmitForReviewLoading(false);
    }
  }, [layoutIssueId, pagesData, setAutoSaveMessage, setSaveError]);

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
              approvedArticles={sidebarArticles}
              allIllustrations={allIllustrations.filter(i => i.kind !== 'ad' && !placedIllustrationIds.has(i.id))}
              allAds={allAds.filter(a => !placedAdIds.has(a.id))}
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
                    interactionDisabled={
                      layoutsLoading || templatesLoading ||
                      currentPageData.layoutStatus === 'in_review' ||
                      currentPageData.layoutStatus === 'published'
                    }
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
                    interactionDisabled={
                      layoutsLoading || templatesLoading ||
                      currentPageData.layoutStatus === 'in_review' ||
                      currentPageData.layoutStatus === 'published'
                    }
                    onColumnHtmlChange={handleColumnHtmlChange}
                    onDeleteArticle={handleDeleteArticle}
                    headerContent={currentPageData.headerContent}
                    onHeaderChange={handleHeaderChange}
                    illustrations={allIllustrations}
                    layoutIllustrations={currentPageData.layoutIllustrations}
                    onDropIllustration={handleDropIllustration}
                    onDeleteIllustration={handleDeleteIllustration}
                    ads={allAds}
                    layoutAds={currentPageData.layoutAds}
                    onDropAd={handleDropAd}
                    onDeleteAd={handleDeleteAd}
                  />
                )}
                <PageNavigation
                  currentPage={currentPage}
                  totalPages={totalPages}
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
