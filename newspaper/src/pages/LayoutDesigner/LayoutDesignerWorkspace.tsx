import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useArticles } from '../../contexts/ArticleContext';
import { PageTemplate, ColumnContainer } from '../../types/PageTemplate';
import { defaultPageTemplate, coverPageTemplate, TOTAL_PAGES } from '../../data/templates';
import PageLayout from './PageLayout';
import CoverPage from './CoverPage';
import LayoutHeader from '../../components/LayoutDesigner/LayoutHeader';
import LayoutArticlesSidebar from '../../components/LayoutDesigner/LayoutArticlesSidebar';
import PageNavigation from '../../components/LayoutDesigner/PageNavigation';
import { PageData, FlowItem } from './workspace/types';
import { buildEmptyColumns as buildEmptyColumnsPure, initPageData as initPageDataPure } from './workspace/columns';
import { buildArticleTextIndex, inferArticleIdFromHtml as inferArticleIdFromHtmlPure } from './workspace/text';
import { reflowFromPosition as reflowFromPositionPure } from './workspace/reflow/reflowFromPosition';
import { useIllustrationsAssets } from './workspace/useIllustrationsAssets';
import { useTemplatesAndLayouts } from './workspace/useTemplatesAndLayouts';
import { useLayoutAutoSave } from './workspace/useLayoutAutoSave';
import { useLayoutDesignerBulkActions } from './workspace/useLayoutDesignerBulkActions';
import { useLayoutDesignerSlotActions } from './workspace/useLayoutDesignerSlotActions';
import { useLayoutDesignerDragStart } from './workspace/useLayoutDesignerDragStart';
import { useLayoutDesignerColumnActions } from './workspace/useLayoutDesignerColumnActions';
import { useGlobalFirstOccurrenceByArticleId } from './workspace/useGlobalFirstOccurrence';

const LayoutDesignerWorkspace: React.FC = () => {
  const { articles } = useArticles();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [newspaperTitle, setNewspaperTitle] = useState<string>('XPress');
  const [inlineIllustrationSpan, setInlineIllustrationSpan] = useState<1 | 2>(1);
  
  // Данные для всех страниц
  const [pagesData, setPagesData] = useState<Record<number, PageData>>({});
  
  const [autoSaveMessage, setAutoSaveMessage] = useState<string | null>('Нет изменений');
  const [saveError, setSaveError] = useState<string | null>(null);
  const skipAutoSaveRef = useRef<boolean>(false);

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

  const globalFirstOccurrenceByArticleId = useGlobalFirstOccurrenceByArticleId(getTemplateForPage, pagesData);

  const articleTextIndex = useMemo(() => {
    return buildArticleTextIndex(articles);
  }, [articles]);

  const approvedArticles = useMemo(
    () => articles.filter(a => a.status === 'approved'),
    [articles]
  );

  const { allIllustrations, allAds } = useIllustrationsAssets(approvedArticles);

  const inferArticleIdFromHtml = useCallback((html: string): string | undefined => {
    return inferArticleIdFromHtmlPure(html, articleTextIndex);
  }, [articleTextIndex]);

  const initPageData = useCallback((pageNum: number, template: PageTemplate): PageData => {
    return initPageDataPure(pageNum, template);
  }, []);

  const reflowFromPosition = useCallback((
    prev: Record<number, PageData>,
    startPage: number,
    startColIndex: number,
    startContainerIndex: number,
    prepend: FlowItem[],
    skipArticleId?: string
  ): Record<number, PageData> => {
    return reflowFromPositionPure(
      prev,
      startPage,
      startColIndex,
      startContainerIndex,
      prepend,
      inferArticleIdFromHtml,
      getTemplateForPage,
      allIllustrations,
      skipArticleId
    );
  }, [allIllustrations, getTemplateForPage, inferArticleIdFromHtml]);

  useLayoutAutoSave({
    selectedTemplate,
    currentPage,
    pagesData,
    getTemplateForPage,
    layoutsLoading,
    templatesLoading,
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

  const { handleDeleteContainer, handleDropArticle, handleDropInlineIllustration, handleDeleteInlineIllustration } = useLayoutDesignerColumnActions({
    articles,
    allIllustrations,
    currentPage,
    getTemplateForPage,
    initPageData,
    buildEmptyColumns,
    inferArticleIdFromHtml,
    reflowFromPosition,
    setPagesData,
  });

  const handleHeaderChange = useCallback((content: string) => {
    void content;
  }, [currentPage, updateCurrentPageData]);

  const currentTemplate = getTemplateForPage(currentPage);

  return (
    <div className="layout-designer-workspace">
      <LayoutHeader
        selectedTemplate={selectedTemplate}
        templates={templates}
        templatesLoading={templatesLoading}
        layoutsLoading={layoutsLoading}
        currentPage={currentPage}
        inlineIllustrationSpan={inlineIllustrationSpan}
        bulkActionLoading={bulkActionLoading}
        onTemplateChange={handleTemplateChange}
        onReloadTemplate={handleReloadTemplate}
        onRefreshTemplates={fetchTemplates}
        onClearCurrentPage={handleClearCurrentPage}
        onClearAllPages={handleClearAllPages}
        onInlineIllustrationSpanChange={setInlineIllustrationSpan}
        autoSaveMessage={autoSaveMessage}
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
                    globalFirstOccurrenceByArticleId={globalFirstOccurrenceByArticleId}
                    interactionDisabled={layoutsLoading || templatesLoading}
                    inlineIllustrationSpan={inlineIllustrationSpan}
                    onDropArticle={handleDropArticle}
                    onDropInlineIllustration={handleDropInlineIllustration}
                    onDeleteContainer={handleDeleteContainer}
                    onDeleteInlineIllustration={handleDeleteInlineIllustration}
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
    </div>
  );
};

export default LayoutDesignerWorkspace;
