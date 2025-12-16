import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useArticles } from '../../contexts/ArticleContext';
import { PageTemplate, ColumnContainer, Layout, LayoutIllustration } from '../../types/PageTemplate';
import { defaultPageTemplate, coverPageTemplate, TOTAL_PAGES } from '../../data/templates';
import PageLayout from './PageLayout';
import CoverPage from './CoverPage';
import LayoutHeader from '../../components/LayoutDesigner/LayoutHeader';
import LayoutArticlesSidebar from '../../components/LayoutDesigner/LayoutArticlesSidebar';
import PageNavigation from '../../components/LayoutDesigner/PageNavigation';
import { layoutAPI, templateAPI, illustrationAPI, Illustration } from '../../utils/api';
import { CHARS_PER_COLUMN, LINES_PER_COLUMN, getTextLength, getTextLines, splitContentToFitContainer } from '../../hooks/useContentSplitting';

interface PageData {
  columns: ColumnContainer[][];
  headerContent: string;
  layoutTitle: string;
  layoutId: string | null;
  layoutIllustrations: LayoutIllustration[];
}

const LayoutDesignerWorkspace: React.FC = () => {
  const { articles } = useArticles();
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PageTemplate | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [newspaperTitle, setNewspaperTitle] = useState<string>('Название газеты');
  
  // Данные для всех страниц
  const [pagesData, setPagesData] = useState<Record<number, PageData>>({});
  
  const [templatesLoading, setTemplatesLoading] = useState<boolean>(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [layoutsLoading, setLayoutsLoading] = useState<boolean>(false);
  const [autoSaveMessage, setAutoSaveMessage] = useState<string | null>('Нет изменений');
  const [saveError, setSaveError] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const skipAutoSaveRef = useRef<boolean>(false);
  const [articleIllustrations, setArticleIllustrations] = useState<Record<string, Illustration[]>>({});
  const [allIllustrations, setAllIllustrations] = useState<Illustration[]>([]);

  // Получить шаблон для текущей страницы
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
    };
  }, [pagesData, currentPage]);

  const buildEmptyColumns = useCallback((template: PageTemplate): ColumnContainer[][] => {
    const initialColumns: ColumnContainer[][] = [];
    for (let i = 0; i < template.columns; i++) {
      initialColumns.push([
        {
          id: `col_${i}_container_0`,
          columnIndex: i,
          content: '',
          height: 0,
          isFilled: false,
        },
      ]);
    }
    return initialColumns;
  }, []);

  const resetPageData = useCallback((pageNumber: number, template: PageTemplate) => {
    const newPagesData = { ...pagesData };
    newPagesData[pageNumber] = {
      columns: buildEmptyColumns(template),
      headerContent: pageNumber === 1 ? '' : (template.headers?.content || 'Заголовок газеты'),
      layoutTitle: pageNumber === 1 ? 'Обложка' : `${template.name} макет`,
      layoutId: null,
      layoutIllustrations: [],
    };
    setPagesData(newPagesData);
  }, [pagesData, buildEmptyColumns]);

  const applyLayoutToPage = useCallback((pageNumber: number, layout: Layout, fallbackTemplate?: PageTemplate | null) => {
    const newPagesData = { ...pagesData };
    newPagesData[pageNumber] = {
      columns: layout.columns || [],
      headerContent: layout.headerContent || (pageNumber === 1 ? '' : (fallbackTemplate?.headers?.content || 'Заголовок газеты')),
      layoutTitle: layout.title,
      layoutId: layout.id,
      layoutIllustrations: layout.illustrations || [],
    };
    setPagesData(newPagesData);
  }, [pagesData]);

  const approvedArticles = useMemo(
    () => articles.filter(a => a.status === 'approved'),
    [articles]
  );

  useEffect(() => {
    const loadIllustrations = async () => {
      const illustrationsMap: Record<string, Illustration[]> = {};
      const allIlls: Illustration[] = [];
      
      for (const article of approvedArticles) {
        try {
          const illustrations = await illustrationAPI.getByArticle(article.id);
          illustrationsMap[article.id] = illustrations;
          allIlls.push(...illustrations);
        } catch (error) {
          illustrationsMap[article.id] = [];
        }
      }
      
      setArticleIllustrations(illustrationsMap);
      setAllIllustrations(allIlls);
    };

    if (approvedArticles.length > 0) {
      loadIllustrations();
    } else {
      setAllIllustrations([]);
      setArticleIllustrations({});
    }
  }, [approvedArticles]);

  const loadLayoutsForAllPages = useCallback(async (template: PageTemplate) => {
    setLayoutsLoading(true);
    setSaveError(null);
    try {
      // Загружаем все макеты для всех страниц (и для обложки, и для обычных страниц)
      const [coverLayouts, regularLayouts] = await Promise.all([
        // Для обложки ищем макеты только по номеру страницы, без templateId,
        // чтобы не передавать несуществующий ObjectId
        layoutAPI.getLayouts({ pageNumber: 1 }),
        layoutAPI.getLayouts({ templateId: template.id }),
      ]);
      
      const allLayouts = [...coverLayouts, ...regularLayouts];
      
      const newPagesData: Record<number, PageData> = {};
      
      // Инициализируем все страницы
      for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
        const pageLayout = allLayouts.find(l => l.pageNumber === pageNum);
        const pageTemplate = pageNum === 1 ? coverPageTemplate : template;
        
        if (pageLayout) {
          newPagesData[pageNum] = {
            columns: pageLayout.columns || [],
            headerContent: pageLayout.headerContent || (pageNum === 1 ? '' : (pageTemplate.headers?.content || 'Заголовок газеты')),
            layoutTitle: pageLayout.title,
            layoutId: pageLayout.id,
            layoutIllustrations: pageLayout.illustrations || [],
          };
          
          // Если это первая страница и есть headerContent, используем его как название газеты
          if (pageNum === 1 && pageLayout.headerContent) {
            setNewspaperTitle(pageLayout.headerContent);
          }
        } else {
          newPagesData[pageNum] = {
            columns: buildEmptyColumns(pageTemplate),
            headerContent: pageNum === 1 ? '' : (pageTemplate.headers?.content || 'Заголовок газеты'),
            layoutTitle: pageNum === 1 ? 'Обложка' : `Страница ${pageNum}`,
            layoutId: null,
            layoutIllustrations: [],
          };
        }
      }
      
      setPagesData(newPagesData);
      setAutoSaveMessage('Макеты загружены');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Не удалось загрузить макеты';
      setSaveError(errorMessage);
      setAutoSaveMessage(errorMessage);
      
      // Инициализируем пустые страницы при ошибке
      const newPagesData: Record<number, PageData> = {};
      for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
        const pageTemplate = pageNum === 1 ? coverPageTemplate : template;
        newPagesData[pageNum] = {
          columns: buildEmptyColumns(pageTemplate),
          headerContent: pageNum === 1 ? '' : (pageTemplate.headers?.content || 'Заголовок газеты'),
          layoutTitle: pageNum === 1 ? 'Обложка' : `Страница ${pageNum}`,
          layoutId: null,
          layoutIllustrations: [],
        };
      }
      setPagesData(newPagesData);
    } finally {
      setLayoutsLoading(false);
    }
  }, [buildEmptyColumns]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const fetchedTemplates = await templateAPI.getTemplates();
      if (fetchedTemplates.length === 0) {
        setTemplates([defaultPageTemplate]);
        setSelectedTemplate(defaultPageTemplate);
        await loadLayoutsForAllPages(defaultPageTemplate);
      } else {
        setTemplates(fetchedTemplates);
        const template = fetchedTemplates[0];
        setSelectedTemplate(template);
        await loadLayoutsForAllPages(template);
      }
    } catch (error) {
      const fallbackTemplate = defaultPageTemplate;
      setTemplates([fallbackTemplate]);
      setSelectedTemplate(fallbackTemplate);
      await loadLayoutsForAllPages(fallbackTemplate);
      setTemplatesError(error instanceof Error ? error.message : 'Не удалось загрузить шаблоны');
    } finally {
      setTemplatesLoading(false);
    }
  }, [loadLayoutsForAllPages]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Автосохранение текущей страницы
  useEffect(() => {
    if (!selectedTemplate) return;
    if (layoutsLoading || templatesLoading) return;
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }

    const pageData = pagesData[currentPage];
    if (!pageData) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const pageTemplate = getTemplateForPage(currentPage);
        const templateIdForSave = selectedTemplate ? selectedTemplate.id : pageTemplate.id;
        const payload = {
          // Для сохранения всегда используем реальный templateId из базы (selectedTemplate),
          // чтобы не отправлять локальный id обложки (`cover_page`)
          templateId: templateIdForSave,
          title: pageData.layoutTitle || (currentPage === 1 ? 'Обложка' : `Страница ${currentPage}`),
          columns: pageData.columns,
          headerContent: currentPage === 1 ? newspaperTitle : pageData.headerContent,
          illustrations: pageData.layoutIllustrations,
          pageNumber: currentPage,
        };

        let saved: Layout;
        if (pageData.layoutId) {
          saved = await layoutAPI.updateLayout(pageData.layoutId, payload);
        } else {
          saved = await layoutAPI.createLayout(payload);
        }
        
        const newPagesData = { ...pagesData };
        newPagesData[currentPage] = {
          ...pageData,
          layoutId: saved.id,
          layoutTitle: saved.title,
        };
        setPagesData(newPagesData);
        setAutoSaveMessage(`Страница ${currentPage} сохранена`);
        setSaveError(null);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ошибка сохранения макета';
        setSaveError(errorMessage);
        setAutoSaveMessage(errorMessage);
      }
    }, 1200);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [
    selectedTemplate,
    currentPage,
    pagesData,
    newspaperTitle,
    layoutsLoading,
    templatesLoading,
    getTemplateForPage,
  ]);

  const handleTemplateChange = useCallback((templateId: string) => {
    const next = templates.find(t => t.id === templateId);
    if (next) {
      setSelectedTemplate(next);
      loadLayoutsForAllPages(next);
    }
  }, [templates, loadLayoutsForAllPages]);

  const handleReloadTemplate = useCallback(() => {
    if (selectedTemplate) {
      loadLayoutsForAllPages(selectedTemplate);
    }
  }, [selectedTemplate, loadLayoutsForAllPages]);

  const handlePageChange = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber);
    skipAutoSaveRef.current = true;
  }, []);

  const updateCurrentPageData = useCallback((updates: Partial<PageData>) => {
    setPagesData(prev => ({
      ...prev,
      [currentPage]: {
        ...prev[currentPage],
        ...updates,
      },
    }));
  }, [currentPage]);

  const getColumnUsedSpace = useCallback((column: ColumnContainer[]): { chars: number; lines: number } => {
    let totalChars = 0;
    let totalLines = 0;
    
    column.forEach(cont => {
      if (cont.isFilled) {
        totalChars += getTextLength(cont.content);
        totalLines += getTextLines(cont.content);
      }
    });
    
    return { chars: totalChars, lines: totalLines };
  }, []);

  const handleDeleteContainer = useCallback((columnIndex: number, containerIndex: number) => {
    updateCurrentPageData({
      columns: currentPageData.columns.map((col, colIdx) => {
        if (colIdx !== columnIndex) return col;
        const newCol = [...col];
        newCol.splice(containerIndex, 1);
        if (newCol.length === 0) {
          newCol.push({
            id: `col_${columnIndex}_container_0`,
            columnIndex,
            content: '',
            height: 0,
            isFilled: false,
          });
        }
        return newCol;
      }),
    });
  }, [currentPageData, updateCurrentPageData]);

  const handleDropArticle = useCallback((articleId: string, columnIndex: number, containerIndex: number) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    const pageTemplate = getTemplateForPage(currentPage);
    const newColumns = currentPageData.columns.map(col => col.map(cont => ({ ...cont })));
    const column = newColumns[columnIndex];
    
    if (!column[containerIndex]) return;

    let container = column[containerIndex];
    
    const columnUsed = getColumnUsedSpace(column);
    const columnAvailableChars = CHARS_PER_COLUMN - columnUsed.chars;
    const columnAvailableLines = LINES_PER_COLUMN - columnUsed.lines;
    
    const currentLength = container.isFilled ? getTextLength(container.content) : 0;
    const currentLines = container.isFilled ? getTextLines(container.content) : 0;
    
    const articleLength = getTextLength(article.content);
    const articleLines = getTextLines(article.content);
    const availableChars = CHARS_PER_COLUMN - currentLength;
    const availableLines = LINES_PER_COLUMN - currentLines;
    
    if ((currentLength >= CHARS_PER_COLUMN || currentLines >= LINES_PER_COLUMN) ||
        (articleLength > availableChars || articleLines > availableLines)) {
      const emptyContainer = column.find(cont => !cont.isFilled);
      if (emptyContainer) {
        container = emptyContainer;
        containerIndex = column.indexOf(emptyContainer);
      } else {
        const newEmpty: ColumnContainer = {
          id: `col_${columnIndex}_container_${Date.now()}_${Math.random()}`,
          columnIndex,
          content: '',
          height: 0,
          isFilled: false,
        };
        column.push(newEmpty);
        container = newEmpty;
        containerIndex = column.length - 1;
      }
    }
    
    const updatedCurrentLength = container.isFilled ? getTextLength(container.content) : 0;
    const updatedCurrentLines = container.isFilled ? getTextLines(container.content) : 0;
    const updatedColumnUsed = getColumnUsedSpace(column);
    const updatedColumnAvailableChars = CHARS_PER_COLUMN - updatedColumnUsed.chars;
    const updatedColumnAvailableLines = LINES_PER_COLUMN - updatedColumnUsed.lines;
    
    let allParts = splitContentToFitContainer(article.content);
    
    if (allParts.length === 1) {
      const containerAvailableChars = CHARS_PER_COLUMN - updatedCurrentLength;
      const containerAvailableLines = LINES_PER_COLUMN - updatedCurrentLines;
      
      if (articleLength > containerAvailableChars || articleLines > containerAvailableLines ||
          articleLength > updatedColumnAvailableChars || articleLines > updatedColumnAvailableLines) {
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(article.content, 'text/html');
        const text = doc.body.textContent || '';
        const tagName = doc.body.firstElementChild?.tagName.toLowerCase() || 'p';
        
        allParts = [];
        let remainingText = text;
        
        const firstPartMaxChars = Math.min(
          containerAvailableChars, 
          updatedColumnAvailableChars,
          CHARS_PER_COLUMN
        );
        
        if (remainingText.length > firstPartMaxChars && firstPartMaxChars > 0) {
          const firstPartText = remainingText.substring(0, firstPartMaxChars);
          allParts.push(`<${tagName}>${firstPartText}</${tagName}>`);
          remainingText = remainingText.substring(firstPartMaxChars);
          
          while (remainingText.length > 0) {
            const partText = remainingText.substring(0, CHARS_PER_COLUMN);
            allParts.push(`<${tagName}>${partText}</${tagName}>`);
            remainingText = remainingText.substring(CHARS_PER_COLUMN);
          }
        } else if (firstPartMaxChars <= 0) {
          allParts.push(article.content);
        } else {
          allParts.push(article.content);
        }
      }
    }
    
    if (allParts.length === 0) return;

    let partsInCurrentContainer = 0;
    let columnTotalLength = updatedColumnUsed.chars;
    let columnTotalLines = updatedColumnUsed.lines;
    
    for (let i = 0; i < allParts.length; i++) {
      const partLength = getTextLength(allParts[i]);
      const partLines = getTextLines(allParts[i]);
      
      if (columnTotalLength + partLength <= CHARS_PER_COLUMN && columnTotalLines + partLines <= LINES_PER_COLUMN) {
        columnTotalLength += partLength;
        columnTotalLines += partLines;
        partsInCurrentContainer++;
      } else {
        break;
      }
    }
    
    if (partsInCurrentContainer > 0) {
      const partsToAdd = allParts.slice(0, partsInCurrentContainer);
      if (container.isFilled) {
        container.content += '<br/>' + partsToAdd.join('<br/>');
      } else {
        container.content = partsToAdd.join('<br/>');
        container.articleId = article.id;
      }
      container.isFilled = true;
      
      const newLength = getTextLength(container.content);
      const newLines = getTextLines(container.content);
      const fillsContainer = (newLength >= CHARS_PER_COLUMN * 0.95) || (newLines >= LINES_PER_COLUMN * 0.95);

      if (!fillsContainer) {
        const emptyAfter: ColumnContainer = {
          id: `col_${columnIndex}_container_${Date.now()}_${Math.random()}`,
          columnIndex,
          content: '',
          height: 0,
          isFilled: false,
        };
        column.splice(containerIndex + 1, 0, emptyAfter);
      }
    }

    const remainingParts = partsInCurrentContainer > 0 
      ? allParts.slice(partsInCurrentContainer)
      : allParts;
    
    if (remainingParts.length > 0) {
      let currentColIndex = columnIndex;
      
      for (let partIndex = 0; partIndex < remainingParts.length && currentColIndex < pageTemplate.columns - 1; partIndex++) {
        currentColIndex = currentColIndex + 1;
        
        const nextColumn = newColumns[currentColIndex];
        if (!nextColumn) break;
        
        let emptyCont = nextColumn.find(cont => !cont.isFilled);
        let emptyContIndex = emptyCont ? nextColumn.indexOf(emptyCont) : -1;
        
        if (emptyContIndex === -1) {
          const newEmpty: ColumnContainer = {
            id: `col_${currentColIndex}_container_${Date.now()}_${Math.random()}`,
            columnIndex: currentColIndex,
            content: '',
            height: 0,
            isFilled: false,
          };
          nextColumn.push(newEmpty);
          emptyCont = newEmpty;
          emptyContIndex = nextColumn.length - 1;
        }

        if (!emptyCont) break;

        emptyCont.content = remainingParts[partIndex];
        emptyCont.articleId = article.id;
        emptyCont.isFilled = true;

        const newLength = getTextLength(emptyCont.content);
        const newLines = getTextLines(emptyCont.content);
        const fills = (newLength >= CHARS_PER_COLUMN * 0.95) || (newLines >= LINES_PER_COLUMN * 0.95);

        if (!fills) {
          const emptyAfter: ColumnContainer = {
            id: `col_${currentColIndex}_container_${Date.now()}_${Math.random()}`,
            columnIndex: currentColIndex,
            content: '',
            height: 0,
            isFilled: false,
          };
          nextColumn.splice(emptyContIndex + 1, 0, emptyAfter);
        }
      }
    }

    updateCurrentPageData({ columns: newColumns });
  }, [articles, currentPage, currentPageData, getTemplateForPage, getColumnUsedSpace, updateCurrentPageData]);

  const handleDropIllustration = useCallback((illustrationId: string, columnIndex: number, positionIndex: number) => {
    const illustration = allIllustrations.find(ill => ill.id === illustrationId);
    if (!illustration) return;

    const pageTemplate = getTemplateForPage(currentPage);
    const positions = pageTemplate.illustrationPositions.filter(
      pos => pos.allowedColumns.includes(columnIndex)
    );
    if (positionIndex >= positions.length) return;

    updateCurrentPageData({
      layoutIllustrations: [
        ...currentPageData.layoutIllustrations.filter(
          li => !(li.columnIndex === columnIndex && li.positionIndex === positionIndex) &&
                li.illustrationId !== illustrationId
        ),
        {
          illustrationId,
          columnIndex,
          positionIndex,
        },
      ],
    });
  }, [allIllustrations, currentPage, currentPageData, getTemplateForPage, updateCurrentPageData]);

  const handleDeleteIllustration = useCallback((columnIndex: number, positionIndex: number) => {
    updateCurrentPageData({
      layoutIllustrations: currentPageData.layoutIllustrations.filter(
        li => !(li.columnIndex === columnIndex && li.positionIndex === positionIndex)
      ),
    });
  }, [currentPageData, updateCurrentPageData]);

  const handleArticleDragStart = useCallback((e: React.DragEvent, articleId: string) => {
    e.dataTransfer.setData('articleId', articleId);
  }, []);

  const handleIllustrationDragStart = useCallback((e: React.DragEvent, illustrationId: string) => {
    e.dataTransfer.setData('illustrationId', illustrationId);
  }, []);

  const handleHeaderChange = useCallback((content: string) => {
    if (currentPage === 1) {
      setNewspaperTitle(content);
    } else {
      updateCurrentPageData({ headerContent: content });
    }
  }, [currentPage, updateCurrentPageData]);

  const currentTemplate = getTemplateForPage(currentPage);

  return (
    <div className="layout-designer-workspace">
      <LayoutHeader
        selectedTemplate={selectedTemplate}
        templates={templates}
        templatesLoading={templatesLoading}
        layoutsLoading={layoutsLoading}
        onTemplateChange={handleTemplateChange}
        onReloadTemplate={handleReloadTemplate}
        onRefreshTemplates={fetchTemplates}
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
              allIllustrations={allIllustrations}
              onArticleDragStart={handleArticleDragStart}
              onIllustrationDragStart={handleIllustrationDragStart}
            />
            <div className="layout-page-area">
              <div className="page-layout-wrapper">
                {currentPage === 1 ? (
                  <CoverPage
                    template={currentTemplate}
                    newspaperTitle={newspaperTitle}
                    onNewspaperTitleChange={setNewspaperTitle}
                    illustrations={allIllustrations}
                    layoutIllustrations={currentPageData.layoutIllustrations}
                    onDropIllustration={handleDropIllustration}
                    onDeleteIllustration={handleDeleteIllustration}
                  />
                ) : (
                  <PageLayout
                    template={currentTemplate}
                    columns={currentPageData.columns}
                    onDropArticle={handleDropArticle}
                    onDeleteContainer={handleDeleteContainer}
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
