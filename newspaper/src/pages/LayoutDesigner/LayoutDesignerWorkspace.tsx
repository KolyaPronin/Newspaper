import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useArticles } from '../../contexts/ArticleContext';
import { PageTemplate, ColumnContainer, Layout, LayoutIllustration } from '../../types/PageTemplate';
import { defaultPageTemplate } from '../../data/templates';
import PageLayout from './PageLayout';
import { layoutAPI, templateAPI, illustrationAPI, Illustration } from '../../utils/api';
import { CHARS_PER_COLUMN, LINES_PER_COLUMN, getTextLength, getTextLines, splitContentToFitContainer, splitContentToFitWithRemaining } from '../../hooks/useContentSplitting';

const LayoutDesignerWorkspace: React.FC = () => {
  const { articles } = useArticles();
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PageTemplate | null>(null);
  const [columns, setColumns] = useState<ColumnContainer[][]>([]);
  const [headerContent, setHeaderContent] = useState<string>('Заголовок газеты');
  const [layoutTitle, setLayoutTitle] = useState<string>('Макет страницы');
  const [templatesLoading, setTemplatesLoading] = useState<boolean>(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [layoutsLoading, setLayoutsLoading] = useState<boolean>(false);
  const [currentLayoutId, setCurrentLayoutId] = useState<string | null>(null);
  const [autoSaveMessage, setAutoSaveMessage] = useState<string | null>('Нет изменений');
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const skipAutoSaveRef = useRef<boolean>(false);
  const [articleIllustrations, setArticleIllustrations] = useState<Record<string, Illustration[]>>({});
  const [allIllustrations, setAllIllustrations] = useState<Illustration[]>([]);
  const [layoutIllustrations, setLayoutIllustrations] = useState<LayoutIllustration[]>([]);

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

  const resetLayoutForTemplate = useCallback((template: PageTemplate) => {
    skipAutoSaveRef.current = true;
    setColumns(buildEmptyColumns(template));
    setHeaderContent(template.headers?.content || 'Заголовок газеты');
    setLayoutTitle(`${template.name} макет`);
    setCurrentLayoutId(null);
    setLayoutIllustrations([]);
    setAutoSaveMessage('Макет готов к редактированию');
  }, [buildEmptyColumns]);

  const applyLayout = useCallback((layout: Layout, fallbackTemplate?: PageTemplate | null) => {
    skipAutoSaveRef.current = true;
    setColumns(layout.columns || []);
    setHeaderContent(layout.headerContent || fallbackTemplate?.headers?.content || 'Заголовок газеты');
    setLayoutTitle(layout.title);
    setCurrentLayoutId(layout.id);
    setLayoutIllustrations(layout.illustrations || []);
    setAutoSaveMessage('Загружен сохранённый макет');
  }, []);

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
          console.error(`Failed to load illustrations for article ${article.id}:`, error);
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

  const loadLayoutsForTemplate = useCallback(async (template: PageTemplate) => {
    setLayoutsLoading(true);
    try {
      const layouts = await layoutAPI.getLayouts({ templateId: template.id, limit: 1 });
      if (layouts.length > 0) {
        applyLayout(layouts[0], template);
      } else {
        resetLayoutForTemplate(template);
      }
    } catch (error) {
      console.error('Failed to load layouts', error);
      resetLayoutForTemplate(template);
      setAutoSaveMessage(error instanceof Error ? error.message : 'Не удалось загрузить макет');
    } finally {
      setLayoutsLoading(false);
    }
  }, [applyLayout, resetLayoutForTemplate]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const fetchedTemplates = await templateAPI.getTemplates();
      if (fetchedTemplates.length === 0) {
        setTemplates([defaultPageTemplate]);
        setSelectedTemplate(defaultPageTemplate);
        resetLayoutForTemplate(defaultPageTemplate);
      } else {
        setTemplates(fetchedTemplates);
        setSelectedTemplate((current) => {
          if (!current) {
            return fetchedTemplates[0];
          }
          return fetchedTemplates.find(t => t.id === current.id) || fetchedTemplates[0];
        });
      }
    } catch (error) {
      const fallbackTemplate = defaultPageTemplate;
      setTemplates([fallbackTemplate]);
      setSelectedTemplate(fallbackTemplate);
      resetLayoutForTemplate(fallbackTemplate);
      setTemplatesError(error instanceof Error ? error.message : 'Не удалось загрузить шаблоны');
    } finally {
      setTemplatesLoading(false);
    }
  }, [resetLayoutForTemplate]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }
    loadLayoutsForTemplate(selectedTemplate);
  }, [selectedTemplate, loadLayoutsForTemplate]);

  useEffect(() => {
    if (!selectedTemplate) return;
    if (layoutsLoading || templatesLoading) return;
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const payload = {
          templateId: selectedTemplate.id,
          title: layoutTitle || `${selectedTemplate.name} макет`,
          columns,
          headerContent,
          illustrations: layoutIllustrations,
        };

        let saved: Layout;
        if (currentLayoutId) {
          saved = await layoutAPI.updateLayout(currentLayoutId, payload);
        } else {
          saved = await layoutAPI.createLayout(payload);
        }
        setCurrentLayoutId(saved.id);
        setLayoutTitle(saved.title);
        setAutoSaveMessage('Изменения сохранены');
      } catch (error) {
        console.error('Failed to auto-save layout', error);
        setAutoSaveMessage(error instanceof Error ? error.message : 'Ошибка сохранения макета');
      }
    }, 1200);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [
    selectedTemplate,
    columns,
    headerContent,
    layoutTitle,
    layoutIllustrations,
    currentLayoutId,
    layoutsLoading,
    templatesLoading,
  ]);

  const handleTemplateChange = (templateId: string) => {
    const next = templates.find(t => t.id === templateId);
    if (next) {
      setSelectedTemplate(next);
    }
  };

  const handleReloadTemplate = () => {
    if (selectedTemplate) {
      loadLayoutsForTemplate(selectedTemplate);
    }
  };

  // Используем константы из useContentSplitting
  
  const splitContentIntoContainers = (htmlContent: string): string[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const body = doc.body;
    const textContent = body.textContent || htmlContent;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const htmlText = tempDiv.innerText || tempDiv.textContent || '';
    
    const bodyBlocks = Array.from(body.children);
    const paragraphCount = bodyBlocks.filter(b => b.tagName.toLowerCase() === 'p').length;
    const lineBreaks = (htmlContent.match(/<br\s*\/?>/gi) || []).length;
    const newLines = (htmlText.match(/\n/g) || []).length;
    const actualLines = htmlText.split(/\n/).filter(line => line.trim().length > 0).length || 1;
    
    const totalLines = Math.max(paragraphCount, actualLines, lineBreaks + newLines + 1);
    
    console.log('splitContentIntoContainers:', { 
      textLength: textContent.length, 
      totalLines, 
      paragraphCount,
      actualLines,
      lineBreaks, 
      newLines,
      limit: LINES_PER_COLUMN,
      shouldSplit: totalLines > LINES_PER_COLUMN,
      htmlContent: htmlContent.substring(0, 200),
      blocksCount: bodyBlocks.length
    });
    
    if (textContent.length <= CHARS_PER_COLUMN && totalLines <= LINES_PER_COLUMN) {
      console.log('Текст короткий, возвращаем как есть');
      return [htmlContent];
    }
    
    if (totalLines > LINES_PER_COLUMN) {
      if (paragraphCount > 1) {
        const parts: string[] = [];
        let currentPart = '';
        let currentLines = 0;
        
        for (const block of bodyBlocks) {
          const blockText = (block as HTMLElement).innerText || block.textContent || '';
          const blockLines = blockText.split(/\n/).filter(l => l.trim().length > 0).length || 1;
          
          if (currentLines + blockLines > LINES_PER_COLUMN && currentPart) {
            parts.push(currentPart);
            currentPart = block.outerHTML;
            currentLines = blockLines;
          } else {
            currentPart += (currentPart ? '' : '') + block.outerHTML;
            currentLines += blockLines;
          }
        }
        
        if (currentPart) {
          parts.push(currentPart);
        }
        
        console.log('Разбивка по параграфам:', { partsCount: parts.length, paragraphCount });
        return parts.length > 0 ? parts : [htmlContent];
      }
      
      const lines = htmlText.split(/\n/).filter(line => line.trim().length > 0);
      if (lines.length > 1) {
        const parts: string[] = [];
        let currentPart = '';
        let currentLines = 0;
        
        for (const line of lines) {
          if (currentLines >= LINES_PER_COLUMN && currentPart) {
            parts.push(`<p>${currentPart.trim()}</p>`);
            currentPart = line;
            currentLines = 1;
          } else {
            currentPart += (currentPart ? '\n' : '') + line;
            currentLines++;
          }
        }
        
        if (currentPart) {
          parts.push(`<p>${currentPart.trim()}</p>`);
        }
        
        console.log('Разбивка по строкам:', { partsCount: parts.length, linesCount: lines.length });
        return parts.length > 0 ? parts : [`<p>${htmlText}</p>`];
      }
    }

    const blocks: Element[] = Array.from(body.children);
    
    if (blocks.length === 0) {
      const lines = textContent.split(/\n/);
      if (lines.length > 1) {
        const parts: string[] = [];
        let currentPart = '';
        let currentLines = 0;
        let currentLength = 0;
        
        for (const line of lines) {
          const lineLength = line.length;
          
          if (currentPart && (currentLength + lineLength > CHARS_PER_COLUMN || currentLines >= LINES_PER_COLUMN)) {
            parts.push(`<p>${currentPart.trim()}</p>`);
            currentPart = line;
            currentLines = 1;
            currentLength = lineLength;
          } else {
            currentPart += (currentPart ? '\n' : '') + line;
            currentLines++;
            currentLength += lineLength;
          }
        }
        
        if (currentPart) {
          parts.push(`<p>${currentPart.trim()}</p>`);
        }
        
        return parts.length > 0 ? parts : [`<p>${textContent}</p>`];
      }
      
      const parts: string[] = [];
      for (let i = 0; i < textContent.length; i += CHARS_PER_COLUMN) {
        const part = textContent.slice(i, i + CHARS_PER_COLUMN);
        parts.push(`<p>${part}</p>`);
      }
      return parts.length > 0 ? parts : [`<p>${textContent}</p>`];
    }

    const parts: string[] = [];
    let currentPart = '';
    let currentLength = 0;
    let currentLines = 0;

    for (const block of blocks) {
      const blockText = block.textContent || '';
      const blockHTML = block.outerHTML;
      const blockInnerText = (block as HTMLElement).innerText || block.textContent || '';
      const blockLinesFromText = blockInnerText.split(/\n/).filter(l => l.trim().length > 0).length || 1;
      const blockBreaks = (blockHTML.match(/<br\s*\/?>/gi) || []).length;
      const blockLines = (blockText.match(/\n/g) || []).length + 1;
      const totalBlockLines = Math.max(blockLinesFromText, blockLines, blockBreaks + 1);
      
      console.log('Блок:', {
        tagName: block.tagName,
        blockLinesFromText,
        blockLines,
        blockBreaks,
        totalBlockLines,
        limit: LINES_PER_COLUMN,
        shouldSplit: totalBlockLines > LINES_PER_COLUMN
      });
      
      if (blockText.length > CHARS_PER_COLUMN || totalBlockLines > LINES_PER_COLUMN || (currentPart && currentLines + totalBlockLines > LINES_PER_COLUMN)) {
        console.log('Разбиваем блок, т.к. превышает лимит');
        if (currentPart) {
          parts.push(currentPart);
          currentPart = '';
          currentLength = 0;
          currentLines = 0;
        }
        
        const blockLinesArray = blockInnerText.split(/\n/).filter(l => l.trim().length > 0);
        if (blockLinesArray.length > 1) {
          let blockPart = '';
          let blockPartLength = 0;
          let blockPartLines = 0;
          
          for (const line of blockLinesArray) {
            if (blockPart && (blockPartLength + line.length > CHARS_PER_COLUMN || blockPartLines >= LINES_PER_COLUMN)) {
              const tagName = block.tagName.toLowerCase();
              if (tagName === 'p' || tagName === 'div') {
                parts.push(`<${tagName}>${blockPart.trim()}</${tagName}>`);
              } else {
                parts.push(`<p>${blockPart.trim()}</p>`);
              }
              blockPart = line;
              blockPartLength = line.length;
              blockPartLines = 1;
            } else {
              blockPart += (blockPart ? '\n' : '') + line;
              blockPartLength += line.length;
              blockPartLines++;
            }
          }
          
          if (blockPart) {
            const tagName = block.tagName.toLowerCase();
            if (tagName === 'p' || tagName === 'div') {
              parts.push(`<${tagName}>${blockPart.trim()}</${tagName}>`);
            } else {
              parts.push(`<p>${blockPart.trim()}</p>`);
            }
          }
        } else {
          const blockParts: string[] = [];
          for (let i = 0; i < blockText.length; i += CHARS_PER_COLUMN) {
            const part = blockText.slice(i, i + CHARS_PER_COLUMN);
            const tagName = block.tagName.toLowerCase();
            if (tagName === 'p' || tagName === 'div') {
              blockParts.push(`<${tagName}>${part}</${tagName}>`);
            } else {
              blockParts.push(`<p>${part}</p>`);
            }
          }
          parts.push(...blockParts);
        }
        continue;
      }
      
      if (currentPart && (currentLength + blockText.length > CHARS_PER_COLUMN || currentLines + totalBlockLines > LINES_PER_COLUMN)) {
        parts.push(currentPart);
        currentPart = blockHTML;
        currentLength = blockText.length;
        currentLines = totalBlockLines;
      } else {
        currentPart += blockHTML;
        currentLength += blockText.length;
        currentLines += totalBlockLines;
      }
    }

    if (currentPart) {
      parts.push(currentPart);
    }

    return parts.length > 0 ? parts : [htmlContent];
  };

  const getTextLength = (htmlContent: string): number => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    return (doc.body.textContent || '').length;
  };

  const getTextLines = (htmlContent: string): number => {
    if (!htmlContent) return 0;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const textContent = doc.body.textContent || '';
    const lineBreaks = (htmlContent.match(/<br\s*\/?>/gi) || []).length;
    const newLines = (textContent.match(/\n/g) || []).length;
    return lineBreaks + newLines + 1;
  };

  const hasSpaceInContainer = (container: ColumnContainer): boolean => {
    if (!container.isFilled) return true;
    const currentLength = getTextLength(container.content);
    const currentLines = getTextLines(container.content);
    return currentLength < CHARS_PER_COLUMN && currentLines < LINES_PER_COLUMN;
  };

  const handleDeleteContainer = (columnIndex: number, containerIndex: number) => {
    const newColumns = columns.map(col => col.map(cont => ({ ...cont })));
    const column = newColumns[columnIndex];
    
    if (column[containerIndex]) {
      // Удаляем контейнер
      column.splice(containerIndex, 1);
      
      // Если колонка пустая, создаем один пустой контейнер
      if (column.length === 0) {
        column.push({
          id: `col_${columnIndex}_container_0`,
          columnIndex,
          content: '',
          height: 0,
          isFilled: false,
        });
      }
      
      setColumns(newColumns);
    }
  };

  // Вычисляет общую занятость колонки (сумма всех заполненных контейнеров)
  const getColumnUsedSpace = (column: ColumnContainer[]): { chars: number; lines: number } => {
    let totalChars = 0;
    let totalLines = 0;
    
    column.forEach(cont => {
      if (cont.isFilled) {
        totalChars += getTextLength(cont.content);
        totalLines += getTextLines(cont.content);
      }
    });
    
    return { chars: totalChars, lines: totalLines };
  };

  const handleDropArticle = (articleId: string, columnIndex: number, containerIndex: number) => {
    const article = articles.find(a => a.id === articleId);
    if (!article || !selectedTemplate) return;

    const newColumns = columns.map(col => col.map(cont => ({ ...cont })));
    const column = newColumns[columnIndex];
    
    if (!column[containerIndex]) return;

    let container = column[containerIndex];
    
    // Вычисляем общую занятость колонки
    const columnUsed = getColumnUsedSpace(column);
    const columnAvailableChars = CHARS_PER_COLUMN - columnUsed.chars;
    const columnAvailableLines = LINES_PER_COLUMN - columnUsed.lines;
    
    // Проверяем, есть ли место в текущем контейнере для нового текста
    const currentLength = container.isFilled ? getTextLength(container.content) : 0;
    const currentLines = container.isFilled ? getTextLines(container.content) : 0;
    
    // Проверяем, поместится ли хотя бы часть статьи в текущий контейнер
    const articleLength = getTextLength(article.content);
    const articleLines = getTextLines(article.content);
    const availableChars = CHARS_PER_COLUMN - currentLength;
    const availableLines = LINES_PER_COLUMN - currentLines;
    
    console.log('Проверка вместимости:', {
      columnUsedChars: columnUsed.chars,
      columnAvailableChars,
      articleLength,
      currentLength,
      availableChars,
    });
    
    // Если текущий контейнер заполнен полностью ИЛИ нет места для нового текста, ищем пустой контейнер
    if ((currentLength >= CHARS_PER_COLUMN || currentLines >= LINES_PER_COLUMN) ||
        (articleLength > availableChars || articleLines > availableLines)) {
      // Ищем пустой контейнер в этой колонке
      const emptyContainer = column.find(cont => !cont.isFilled);
      if (emptyContainer) {
        container = emptyContainer;
        containerIndex = column.indexOf(emptyContainer);
      } else {
        // Создаем новый пустой контейнер
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
    
    // Обновляем currentLength после возможного переключения контейнера
    const updatedCurrentLength = container.isFilled ? getTextLength(container.content) : 0;
    const updatedCurrentLines = container.isFilled ? getTextLines(container.content) : 0;

    // Проверяем, поместится ли статья в оставшееся место в колонке
    // Пересчитываем занятость колонки (на случай если контейнер изменился)
    const updatedColumnUsed = getColumnUsedSpace(column);
    const updatedColumnAvailableChars = CHARS_PER_COLUMN - updatedColumnUsed.chars;
    const updatedColumnAvailableLines = LINES_PER_COLUMN - updatedColumnUsed.lines;
    
    // Разбиваем всю статью на части, которые помещаются в контейнер
    let allParts = splitContentToFitContainer(article.content);
    
    // Если статья не разбилась на части, проверяем, поместится ли она в колонку
    if (allParts.length === 1) {
      const articleLength = getTextLength(article.content);
      const articleLines = getTextLines(article.content);
      const containerAvailableChars = CHARS_PER_COLUMN - updatedCurrentLength;
      const containerAvailableLines = LINES_PER_COLUMN - updatedCurrentLines;
      
      // Если статья не помещается в доступное место в контейнере ИЛИ в колонке, разбиваем принудительно
      if (articleLength > containerAvailableChars || articleLines > containerAvailableLines ||
          articleLength > updatedColumnAvailableChars || articleLines > updatedColumnAvailableLines) {
        console.log('Статья не разбилась, но не помещается. Принудительно разбиваем...', {
          articleLength,
          articleLines,
          containerAvailableChars,
          containerAvailableLines,
          columnAvailableChars: updatedColumnAvailableChars,
          columnAvailableLines: updatedColumnAvailableLines,
        });
        
        // Разбиваем по символам с учетом доступного места
        const parser = new DOMParser();
        const doc = parser.parseFromString(article.content, 'text/html');
        const text = doc.body.textContent || '';
        const tagName = doc.body.firstElementChild?.tagName.toLowerCase() || 'p';
        
        allParts = [];
        let remainingText = text;
        
        // Первая часть - с учетом доступного места в КОЛОНКЕ (не только в контейнере!)
        // Используем минимум из доступного места в контейнере и в колонке
        const firstPartMaxChars = Math.min(
          containerAvailableChars, 
          updatedColumnAvailableChars,
          CHARS_PER_COLUMN
        );
        
        console.log('Разбиение статьи:', {
          textLength: text.length,
          firstPartMaxChars,
          containerAvailableChars,
          columnAvailableChars: updatedColumnAvailableChars,
        });
        
        if (remainingText.length > firstPartMaxChars && firstPartMaxChars > 0) {
          // Берем первую часть, которая помещается в колонку
          const firstPartText = remainingText.substring(0, firstPartMaxChars);
          allParts.push(`<${tagName}>${firstPartText}</${tagName}>`);
          remainingText = remainingText.substring(firstPartMaxChars);
          
          // Остальные части - по CHARS_PER_COLUMN
          while (remainingText.length > 0) {
            const partText = remainingText.substring(0, CHARS_PER_COLUMN);
            allParts.push(`<${tagName}>${partText}</${tagName}>`);
            remainingText = remainingText.substring(CHARS_PER_COLUMN);
          }
        } else if (firstPartMaxChars <= 0) {
          // В колонке нет места вообще - вся статья перетекает
          allParts.push(article.content);
        } else {
          // Вся статья помещается в первую часть
          allParts.push(article.content);
        }
        
        console.log('Принудительно разбито на части:', allParts.length);
      }
    }
    
    console.log('handleDropArticle:', {
      articleId: article.id,
      columnIndex,
      containerIndex,
      allPartsCount: allParts.length,
      currentLength: updatedCurrentLength,
      currentLines: updatedCurrentLines,
      availableChars: CHARS_PER_COLUMN - updatedCurrentLength,
      availableLines: LINES_PER_COLUMN - updatedCurrentLines,
      columnAvailableChars: updatedColumnAvailableChars,
      columnAvailableLines: updatedColumnAvailableLines,
    });
    
    if (allParts.length === 0) {
      console.warn('Не удалось разбить контент');
      return;
    }

    // Определяем, сколько частей поместится в колонку (не в контейнер!)
    // Используем общую занятость колонки как базу
    let partsInCurrentContainer = 0;
    let columnTotalLength = updatedColumnUsed.chars; // Начинаем с уже занятого места в колонке
    let columnTotalLines = updatedColumnUsed.lines;
    
    // Проверяем каждую часть
    for (let i = 0; i < allParts.length; i++) {
      const partLength = getTextLength(allParts[i]);
      const partLines = getTextLines(allParts[i]);
      
      // Проверяем, поместится ли часть в колонку (с учетом уже занятого места)
      if (columnTotalLength + partLength <= CHARS_PER_COLUMN && columnTotalLines + partLines <= LINES_PER_COLUMN) {
        columnTotalLength += partLength;
        columnTotalLines += partLines;
        partsInCurrentContainer++;
      } else {
        // Часть не помещается в колонку
        console.log(`Часть ${i} не помещается в колонку`, {
          partLength,
          partLines,
          columnTotalLength,
          columnTotalLines,
          columnAvailableChars: CHARS_PER_COLUMN - columnTotalLength,
          columnAvailableLines: LINES_PER_COLUMN - columnTotalLines,
          limitChars: CHARS_PER_COLUMN,
          limitLines: LINES_PER_COLUMN,
        });
        break;
      }
    }
    
    // Если ни одна часть не помещается, но есть части - перетекаем все
    if (partsInCurrentContainer === 0 && allParts.length > 0) {
      console.log('Ни одна часть не помещается в текущий контейнер, перетекаем все части');
    }

    console.log('Части в текущем контейнере:', partsInCurrentContainer, 'из', allParts.length);

    // Заполняем текущий контейнер частями, которые помещаются
    if (partsInCurrentContainer > 0) {
      const partsToAdd = allParts.slice(0, partsInCurrentContainer);
      if (container.isFilled) {
        container.content += '<br/>' + partsToAdd.join('<br/>');
      } else {
        container.content = partsToAdd.join('<br/>');
        container.articleId = article.id;
      }
      container.isFilled = true;
      
      // Проверяем, заполнил ли контейнер полностью
      const newLength = getTextLength(container.content);
      const newLines = getTextLines(container.content);
      const fillsContainer = (newLength >= CHARS_PER_COLUMN * 0.95) || (newLines >= LINES_PER_COLUMN * 0.95);

      console.log('Контейнер заполнен:', {
        newLength,
        newLines,
        fillsContainer,
        limitChars: CHARS_PER_COLUMN,
        limitLines: LINES_PER_COLUMN,
      });

      // СЛУЧАЙ 1: Короткая статья - не заполняет контейнер полностью
      if (!fillsContainer) {
        // Создаем пустой контейнер сразу после заполненного для дальнейших вставок
        const emptyAfter: ColumnContainer = {
          id: `col_${columnIndex}_container_${Date.now()}_${Math.random()}`,
          columnIndex,
          content: '',
          height: 0,
          isFilled: false,
        };
        column.splice(containerIndex + 1, 0, emptyAfter);
        console.log('Создан пустой контейнер после заполненного');
      }
    } else {
      // Если ни одна часть не поместилась, перетекаем все части в следующую колонку
      console.warn('Ни одна часть не поместилась в текущий контейнер, перетекаем все части');
    }

    // СЛУЧАЙ 2: Длинная статья - остальные части перетекают в следующие колонки
    // Если ни одна часть не поместилась в текущий контейнер, перетекаем все части
    const remainingParts = partsInCurrentContainer > 0 
      ? allParts.slice(partsInCurrentContainer)
      : allParts;
    
    console.log('Оставшиеся части для перетекания:', remainingParts.length, 'из', allParts.length);
    
    if (remainingParts.length > 0) {
      let currentColIndex = columnIndex;
      
      for (let partIndex = 0; partIndex < remainingParts.length && currentColIndex < selectedTemplate.columns - 1; partIndex++) {
        currentColIndex = currentColIndex + 1;
        
        console.log(`Перетекание части ${partIndex} в колонку ${currentColIndex}`);
        
        // Находим или создаем пустой контейнер в следующей колонке
        const nextColumn = newColumns[currentColIndex];
        if (!nextColumn) {
          console.error(`Колонка ${currentColIndex} не существует`);
          break;
        }
        
        let emptyCont = nextColumn.find(cont => !cont.isFilled);
        let emptyContIndex = emptyCont ? nextColumn.indexOf(emptyCont) : -1;
        
        if (emptyContIndex === -1) {
          // Создаем новый пустой контейнер
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
          console.log(`Создан новый пустой контейнер в колонке ${currentColIndex}`);
        }

        if (!emptyCont) {
          console.error(`Не удалось найти или создать контейнер в колонке ${currentColIndex}`);
          break;
        }

        // Вставляем часть в контейнер
        emptyCont.content = remainingParts[partIndex];
        emptyCont.articleId = article.id;
        emptyCont.isFilled = true;

        console.log(`Вставлена часть ${partIndex} в колонку ${currentColIndex}`);

        // Проверяем, заполнил ли контейнер полностью
        const newLength = getTextLength(emptyCont.content);
        const newLines = getTextLines(emptyCont.content);
        const fills = (newLength >= CHARS_PER_COLUMN * 0.95) || (newLines >= LINES_PER_COLUMN * 0.95);

        // Если контейнер не заполнен полностью, создаем пустой после него
        if (!fills) {
          const emptyAfter: ColumnContainer = {
            id: `col_${currentColIndex}_container_${Date.now()}_${Math.random()}`,
            columnIndex: currentColIndex,
            content: '',
            height: 0,
            isFilled: false,
          };
          nextColumn.splice(emptyContIndex + 1, 0, emptyAfter);
          console.log(`Создан пустой контейнер после заполненного в колонке ${currentColIndex}`);
        }
      }
    } else {
      console.log('Нет оставшихся частей для перетекания');
    }

    setColumns(newColumns);
  };

  const handleDropIllustration = (illustrationId: string, columnIndex: number, positionIndex: number) => {
    const illustration = allIllustrations.find(ill => ill.id === illustrationId);
    if (!illustration || !selectedTemplate) return;

    const positions = selectedTemplate.illustrationPositions.filter(
      pos => pos.allowedColumns.includes(columnIndex)
    );
    if (positionIndex >= positions.length) return;

    const newLayoutIllustrations = layoutIllustrations.filter(
      li => !(li.columnIndex === columnIndex && li.positionIndex === positionIndex) &&
            li.illustrationId !== illustrationId
    );

    newLayoutIllustrations.push({
      illustrationId,
      columnIndex,
      positionIndex,
    });

    setLayoutIllustrations(newLayoutIllustrations);
  };

  const handleDeleteIllustration = (columnIndex: number, positionIndex: number) => {
    const newLayoutIllustrations = layoutIllustrations.filter(
      li => !(li.columnIndex === columnIndex && li.positionIndex === positionIndex)
    );
    setLayoutIllustrations(newLayoutIllustrations);
  };

  return (
    <div className="layout-designer-workspace">
      <div className="workspace-header" style={{ flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <div>
          <h1>Верстка страницы</h1>
          <p>Выберите шаблон и загрузите макет из базы</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: 'var(--subtext)' }}>
            Шаблон
            <select
              value={selectedTemplate?.id || ''}
              onChange={(e) => handleTemplateChange(e.target.value)}
              disabled={templatesLoading || templates.length === 0}
              style={{ 
                minWidth: 220, 
                padding: '6px 10px', 
                borderRadius: 6, 
                border: '1px solid var(--border)',
                background: '#0e1016',
                color: 'var(--text)',
                fontSize: 14
              }}
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn" onClick={handleReloadTemplate} disabled={!selectedTemplate || layoutsLoading} style={{ width: 'auto' }}>
            {layoutsLoading ? 'Загрузка...' : 'Загрузить шаблон'}
          </button>
        </div>
      </div>

      {templatesError && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, color: '#92400E' }}>
          {templatesError}. Используется локальный шаблон по умолчанию.
        </div>
      )}

      <div style={{ 
        marginBottom: 16, 
        padding: '8px 12px', 
        border: '1px solid var(--border)', 
        borderRadius: 8, 
        background: 'rgba(21, 24, 33, 0.3)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        fontSize: 13 
      }}>
        <span style={{ color: 'var(--subtext)' }}>Автосохранение: {autoSaveMessage}</span>
        <button type="button" className="btn" onClick={fetchTemplates} disabled={templatesLoading} style={{ padding: '6px 12px', fontSize: 13, width: 'auto' }}>
          {templatesLoading ? 'Обновляю...' : 'Обновить'}
        </button>
      </div>

      {!selectedTemplate ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--subtext)' }}>
          <p style={{ fontSize: 18, marginBottom: 12 }}>Шаблоны не найдены</p>
          <p style={{ fontSize: 14 }}>Добавьте шаблон через API или используйте локальный.</p>
        </div>
      ) : (
        <div className="layout-workspace-content">
          <div className="layout-articles-sidebar">
            <h3>Одобренные статьи</h3>
            {approvedArticles.length === 0 ? (
              <p className="article-empty">Нет одобренных статей для размещения</p>
            ) : (
              <div className="layout-articles-list">
                {approvedArticles.map(article => (
                  <div
                    key={article.id}
                    className="layout-article-item"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('articleId', article.id);
                    }}
                  >
                    <div className="layout-article-title">{article.title}</div>
                    <div className="layout-article-meta">
                      <span>{new Date(article.updatedAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(38, 42, 54, 0.3)' }}>
              <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Иллюстрации</h3>
              {allIllustrations.length === 0 ? (
                <p className="article-empty" style={{ fontSize: 12 }}>Нет доступных иллюстраций</p>
              ) : (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: 8,
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}>
                  {allIllustrations.map(ill => (
                    <div
                      key={ill.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('illustrationId', ill.id);
                      }}
                      style={{
                        cursor: 'grab',
                        border: '1px solid rgba(38, 42, 54, 0.4)',
                        borderRadius: 6,
                        overflow: 'hidden',
                        background: 'rgba(14, 16, 22, 0.5)',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(38, 42, 54, 0.4)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <img
                        src={ill.url}
                        alt={ill.caption || ''}
                        style={{
                          width: '100%',
                          height: 60,
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                      {ill.caption && (
                        <div style={{
                          padding: '4px 6px',
                          fontSize: 10,
                          color: 'var(--subtext)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {ill.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="layout-page-area">
            <PageLayout
              template={selectedTemplate}
              columns={columns}
              onDropArticle={handleDropArticle}
              onDeleteContainer={handleDeleteContainer}
              headerContent={headerContent}
              onHeaderChange={setHeaderContent}
              illustrations={allIllustrations}
              layoutIllustrations={layoutIllustrations}
              onDropIllustration={handleDropIllustration}
              onDeleteIllustration={handleDeleteIllustration}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LayoutDesignerWorkspace;
