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
import { CHARS_PER_COLUMN, LINES_PER_COLUMN, getTextLength, getTextLines, splitContentToFitWithRemaining } from '../../hooks/useContentSplitting';

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
    let filledCount = 0;
    
    column.forEach(cont => {
      if (cont.isFilled) {
        filledCount += 1;
        totalChars += getTextLength(cont.content);
        totalLines += getTextLines(cont.content);
      }
    });

    // UI-оверход, который реальный DOM занимает по высоте, но не учитывается в getTextLines:
    // - паддинги .page-column (12px сверху/снизу)
    // - drop-зоны между контейнерами (10px)
    // - вертикальные отступы между контейнерами (8px)
    // Если это не учитывать, низ текста может визуально клипаться (кажется, что он "уходит под иллюстрацию").
    const approxLineHeightPx = 18;
    const columnPaddingPx = 24;
    const dropZoneHeightPx = 10;
    const containerGapPx = 8;
    const filledContainerPaddingPx = 16;
    const dropZonesCount = column.length > 0 ? (column.length + 1) : 0;
    const gapsCount = Math.max(0, column.length - 1);
    const overheadPx =
      columnPaddingPx +
      (dropZonesCount * dropZoneHeightPx) +
      (gapsCount * containerGapPx) +
      (filledCount * filledContainerPaddingPx);
    const overheadLines = overheadPx > 0 ? Math.ceil(overheadPx / approxLineHeightPx) : 0;
    totalLines += overheadLines;

    // Минимальный запас, чтобы не было клипа на 1 строку из-за неточностей метрик/шрифтов
    totalLines += 1;
    
    return { chars: totalChars, lines: totalLines };
  }, []);

  const getColumnCapacity = useCallback((template: PageTemplate, columnIndex: number): { maxChars: number; maxLines: number } => {
    const slots = template.illustrationPositions.filter(pos => pos.allowedColumns.includes(columnIndex)).length;
    const illustrationSlotHeightPx = 120;
    const illustrationGapPx = 12;
    const approxLineHeightPx = 18;
    const reservedPx = slots > 0
      ? (slots * illustrationSlotHeightPx) + ((slots - 1) * illustrationGapPx) + illustrationGapPx
      : 0;
    const reservedLines = reservedPx > 0 ? Math.ceil(reservedPx / approxLineHeightPx) : 0;
    const SAFETY_LINES = slots > 0 ? 3 : 0;
    const maxLines = Math.max(1, LINES_PER_COLUMN - reservedLines - SAFETY_LINES);
    const maxChars = Math.max(1, Math.floor(CHARS_PER_COLUMN * (maxLines / LINES_PER_COLUMN)));
    return { maxChars, maxLines };
  }, []);

  const ensureEmptyContainerAtEnd = useCallback((
    column: ColumnContainer[],
    columnIndex: number,
    remainingLines: number
  ) => {
    // Хотим показывать хвостовой пустой контейнер только когда места РЕАЛЬНО много.
    // Иначе он выглядит как «лишний на 1–2 строки».
    const MIN_EMPTY_DROP_LINES = 4;
    const approxLineHeightPx = 18;

    // Добавление хвостового пустого контейнера само по себе съедает место:
    // - появится ещё 1 drop-zone снизу
    // - появится gap между последним заполненным контейнером и пустым
    // - у пустого контейнера есть внутренние padding (минимальная «интринсик» высота)
    // Если это не учесть — пустой контейнер будет создаваться даже при маленьком остатке,
    // визуально «лишний» и иногда выглядит как залезание под иллюстрацию.
    const emptyContainerPaddingPx = 40;
    const extraDropZonePx = 10;
    const extraGapPx = 8;
    const extraOverheadLines = Math.ceil(
      (emptyContainerPaddingPx + extraDropZonePx + extraGapPx) / approxLineHeightPx
    );

    const predictedRemainingAfterEmpty = remainingLines - extraOverheadLines;

    // Если места почти не осталось — не показываем/не создаём хвостовой пустой контейнер
    if (predictedRemainingAfterEmpty < MIN_EMPTY_DROP_LINES) {
      while (column.length > 0 && !column[column.length - 1].isFilled) {
        column.pop();
      }
      return;
    }

    const hasEmpty = column.some(cont => !cont.isFilled);
    if (hasEmpty) return;

    column.push({
      id: `col_${columnIndex}_container_${Date.now()}_${Math.random()}`,
      columnIndex,
      content: '',
      height: 0,
      isFilled: false,
    });
  }, []);

  const handleDeleteContainer = useCallback((columnIndex: number, containerIndex: number) => {
    updateCurrentPageData({
      columns: currentPageData.columns.map((col, colIdx) => {
        if (colIdx !== columnIndex) return col;
        const newCol = [...col];
        const target = newCol[containerIndex];
        if (target) {
          // «Удалить текст» = очистить контейнер, а не удалять его из списка.
          // Иначе у колонки визуально «пропадает место/дроп-зона».
          newCol[containerIndex] = {
            ...target,
            content: '',
            isFilled: false,
            articleId: undefined,
          };
        }
        return newCol;
      }),
    });
  }, [currentPageData, updateCurrentPageData]);

  const handleDropArticle = useCallback((articleId: string, columnIndex: number, containerIndex: number) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    type FlowItem = { articleId?: string; html: string; source: 'existing' | 'new' };

    const getPlainText = (html: string): string => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    };

    // Для старых/загруженных макетов articleId может быть пустым.
    // Тогда «склейка» и нормальный рефлоу невозможны. Пытаемся восстановить articleId по содержимому.
    const inferArticleIdFromHtml = (() => {
      const articleTextIndex = new Map<string, string>();
      for (const a of articles) {
        if (!articleTextIndex.has(a.id)) {
          articleTextIndex.set(a.id, getPlainText(a.content));
        }
      }

      return (html: string): string | undefined => {
        const text = getPlainText(html);
        if (!text) return undefined;
        const probe = text.slice(0, Math.min(80, text.length));
        if (probe.length < 30) return undefined;

        const entries = Array.from(articleTextIndex.entries());
        for (let i = 0; i < entries.length; i++) {
          const id = entries[i][0];
          const fullText = entries[i][1];
          if (fullText.includes(probe)) return id;
        }
        return undefined;
      };
    })();

    const initPageData = (pageNum: number, template: PageTemplate): PageData => {
      return {
        columns: buildEmptyColumns(template),
        headerContent: pageNum === 1 ? '' : (template.headers?.content || 'Заголовок газеты'),
        layoutTitle: pageNum === 1 ? 'Обложка' : `Страница ${pageNum}`,
        layoutId: null,
        layoutIllustrations: [],
      };
    };

    const collectTailFromColumns = (
      columns: ColumnContainer[][],
      templateColumnsCount: number,
      startColIndex: number,
      startContainerIndex: number,
      into: FlowItem[]
    ) => {
      const pushMergedExisting = (item: FlowItem) => {
        const last = into.length > 0 ? into[into.length - 1] : undefined;
        if (
          last &&
          last.source === 'existing' &&
          item.source === 'existing' &&
          last.articleId &&
          item.articleId &&
          last.articleId === item.articleId
        ) {
          last.html += item.html;
          return;
        }
        into.push(item);
      };

      for (let colIdx = startColIndex; colIdx < templateColumnsCount; colIdx++) {
        const column = columns[colIdx];
        if (!column) continue;
        const startIdx = colIdx === startColIndex ? Math.min(startContainerIndex, column.length) : 0;
        const removed = column.splice(startIdx);
        removed.forEach(cont => {
          if (cont.isFilled && cont.content) {
            const resolvedArticleId = cont.articleId || inferArticleIdFromHtml(cont.content);
            pushMergedExisting({ articleId: resolvedArticleId, html: cont.content, source: 'existing' });
          }
        });
      }
    };

    const packFlowIntoPageColumns = (
      flow: FlowItem[],
      columns: ColumnContainer[][],
      template: PageTemplate,
      startColIndex: number
    ) => {
      for (let colIdx = startColIndex; colIdx < template.columns && flow.length > 0; colIdx++) {
        const column = columns[colIdx] || [];
        columns[colIdx] = column;

        // Убираем любые пустые контейнеры перед упаковкой, чтобы они не влияли на оверхед/ёмкость.
        // Новые пустые зоны создаются только через ensureEmptyContainerAtEnd.
        for (let i = column.length - 1; i >= 0; i--) {
          if (!column[i].isFilled) {
            column.splice(i, 1);
          }
        }
        const { maxChars, maxLines } = getColumnCapacity(template, colIdx);
        let used = getColumnUsedSpace(column);

        while (flow.length > 0) {
          const current = flow[0];
          const { parts, remainingHtml } = splitContentToFitWithRemaining(
            current.html,
            used.chars,
            used.lines,
            maxChars,
            maxLines
          );

          if (parts.length === 0) {
            break;
          }

          const filled: ColumnContainer = {
            id: `col_${colIdx}_container_${Date.now()}_${Math.random()}`,
            columnIndex: colIdx,
            content: parts[0],
            height: 0,
            isFilled: true,
            articleId: current.articleId,
          };
          column.push(filled);

          used = getColumnUsedSpace(column);

          if (remainingHtml) {
            current.html = remainingHtml;
            break;
          }

          flow.shift();
        }

        // Правило: если поток продолжился в следующую колонку/страницу, в этой колонке
        // не нужен хвостовой пустой контейнер (иначе выглядит как «лишний»).
        if (flow.length === 0) {
          const remainingLines = Math.max(0, maxLines - used.lines);
          ensureEmptyContainerAtEnd(column, colIdx, remainingLines);
        }
      }
    };

    setPagesData(prev => {
      const updated = { ...prev };

      // Рефлоу в текущей странице с позиции вставки
      let pageNum = currentPage;
      let template = getTemplateForPage(pageNum);
      const basePageData = updated[pageNum] || initPageData(pageNum, template);
      const newColumns = (basePageData.columns && basePageData.columns.length > 0 ? basePageData.columns : buildEmptyColumns(template))
        .map(col => col.map(cont => ({ ...cont })));

      // Если дропнули «в конец» колонки, а последний контейнер пустой — считаем, что дропнули В него,
      // иначе он останется висеть выше и будет ломать расчёты/выглядеть как лишний.
      const startColumn = newColumns[columnIndex] || [];
      let normalizedInsertIndex = Math.min(containerIndex, startColumn.length);
      if (
        normalizedInsertIndex === startColumn.length &&
        normalizedInsertIndex > 0 &&
        !startColumn[normalizedInsertIndex - 1].isFilled
      ) {
        normalizedInsertIndex -= 1;
      }

      const flow: FlowItem[] = [];
      collectTailFromColumns(newColumns, template.columns, columnIndex, normalizedInsertIndex, flow);
      flow.unshift({ articleId: article.id, html: article.content, source: 'new' });
      packFlowIntoPageColumns(flow, newColumns, template, columnIndex);

      updated[pageNum] = { ...basePageData, columns: newColumns };

      // Если flow остался — переносим на следующую страницу в 1-ю колонку
      while (flow.length > 0 && pageNum < TOTAL_PAGES) {
        pageNum += 1;
        template = getTemplateForPage(pageNum);
        const nextPageData = updated[pageNum] || initPageData(pageNum, template);
        const nextColumns = (nextPageData.columns && nextPageData.columns.length > 0 ? nextPageData.columns : buildEmptyColumns(template))
          .map(col => col.map(cont => ({ ...cont })));

        // Сдвигаем существующий контент следующей страницы вниз: добавляем его хвост в flow
        collectTailFromColumns(nextColumns, template.columns, 0, 0, flow);
        packFlowIntoPageColumns(flow, nextColumns, template, 0);
        updated[pageNum] = { ...nextPageData, columns: nextColumns };
      }

      return updated;
    });
  }, [articles, buildEmptyColumns, currentPage, getColumnCapacity, getColumnUsedSpace, getTemplateForPage, ensureEmptyContainerAtEnd]);

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
