import React, { useState, useMemo } from 'react';
import { useArticles } from '../../contexts/ArticleContext';
import { PageTemplate, ColumnContainer } from '../../types/PageTemplate';
import { defaultPageTemplate } from '../../data/templates';
import PageLayout from './PageLayout';

const LayoutDesignerWorkspace: React.FC = () => {
  const { articles } = useArticles();
  const [template, setTemplate] = useState<PageTemplate | null>(null);
  const [columns, setColumns] = useState<ColumnContainer[][]>([]);
  const [headerContent, setHeaderContent] = useState<string>('Заголовок газеты');

  const approvedArticles = useMemo(
    () => articles.filter(a => a.status === 'approved'),
    [articles]
  );

  const handleLoadTemplate = () => {
    setTemplate(defaultPageTemplate);
    setHeaderContent(defaultPageTemplate.headers.content || 'Заголовок газеты');
    const initialColumns: ColumnContainer[][] = [];
    for (let i = 0; i < defaultPageTemplate.columns; i++) {
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
    setColumns(initialColumns);
  };

  const CHARS_PER_COLUMN = 800;
  const LINES_PER_COLUMN = 20;
  
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
      column[containerIndex].content = '';
      column[containerIndex].articleId = undefined;
      column[containerIndex].isFilled = false;
      
      setColumns(newColumns);
    }
  };

  const handleDropArticle = (articleId: string, columnIndex: number, containerIndex: number) => {
    const article = articles.find(a => a.id === articleId);
    if (!article || !template) return;

    const newColumns = columns.map(col => col.map(cont => ({ ...cont })));
    const column = newColumns[columnIndex];
    
    if (!column[containerIndex]) return;

    const container = column[containerIndex];
    
    const currentLength = container.isFilled ? getTextLength(container.content) : 0;
    const currentLines = container.isFilled ? getTextLines(container.content) : 0;
    
    if (currentLength >= CHARS_PER_COLUMN || currentLines >= LINES_PER_COLUMN) {
      return;
    }

    const contentParts = splitContentIntoContainers(article.content);
    
    const availableSpace = CHARS_PER_COLUMN - currentLength;
    const availableLines = LINES_PER_COLUMN - currentLines;
    let firstPartLength = getTextLength(contentParts[0]);
    let firstPartLines = getTextLines(contentParts[0]);
    
    if (firstPartLength <= availableSpace && firstPartLines <= availableLines) {
      if (container.isFilled) {
        container.content += '<br/>' + contentParts[0];
      } else {
        container.content = contentParts[0];
      }
      container.articleId = article.id;
      container.isFilled = true;
      
      let currentColIndex = columnIndex;
      
      for (let i = 1; i < contentParts.length; i++) {
        currentColIndex = (currentColIndex + 1) % template.columns;
        
        let foundContainer = false;
        for (let j = 0; j < newColumns[currentColIndex].length; j++) {
          const cont = newColumns[currentColIndex][j];
          if (hasSpaceInContainer(cont)) {
            const contLength = cont.isFilled ? getTextLength(cont.content) : 0;
            const contLines = cont.isFilled ? getTextLines(cont.content) : 0;
            const partLength = getTextLength(contentParts[i]);
            const partLines = getTextLines(contentParts[i]);
            const contAvailableSpace = CHARS_PER_COLUMN - contLength;
            const contAvailableLines = LINES_PER_COLUMN - contLines;
            
            if (partLength <= contAvailableSpace && partLines <= contAvailableLines) {
              if (cont.isFilled) {
                cont.content += '<br/>' + contentParts[i];
              } else {
                cont.content = contentParts[i];
                cont.articleId = article.id;
                cont.isFilled = true;
              }
              foundContainer = true;
              break;
            }
          }
        }
        
        if (!foundContainer) {
          const newContainer: ColumnContainer = {
            id: `col_${currentColIndex}_container_${newColumns[currentColIndex].length}`,
            columnIndex: currentColIndex,
            content: contentParts[i],
            articleId: article.id,
            height: 0,
            isFilled: true,
          };
          newColumns[currentColIndex].push(newContainer);
        }
      }
    } else {
      if (!container.isFilled) {
        container.content = contentParts[0];
        container.articleId = article.id;
        container.isFilled = true;
      }
      
      let currentColIndex = columnIndex;
      
      for (let i = container.isFilled ? 1 : 0; i < contentParts.length; i++) {
        if (i === 0 && container.isFilled) continue;
        
        currentColIndex = (currentColIndex + 1) % template.columns;
        
        let foundContainer = false;
        for (let j = 0; j < newColumns[currentColIndex].length; j++) {
          const cont = newColumns[currentColIndex][j];
          if (hasSpaceInContainer(cont)) {
            const contLength = cont.isFilled ? getTextLength(cont.content) : 0;
            const contLines = cont.isFilled ? getTextLines(cont.content) : 0;
            const partLength = getTextLength(contentParts[i]);
            const partLines = getTextLines(contentParts[i]);
            const contAvailableSpace = CHARS_PER_COLUMN - contLength;
            const contAvailableLines = LINES_PER_COLUMN - contLines;
            
            if (partLength <= contAvailableSpace && partLines <= contAvailableLines) {
              if (cont.isFilled) {
                cont.content += '<br/>' + contentParts[i];
              } else {
                cont.content = contentParts[i];
                cont.articleId = article.id;
                cont.isFilled = true;
              }
              foundContainer = true;
              break;
            }
          }
        }
        
        if (!foundContainer) {
          const newContainer: ColumnContainer = {
            id: `col_${currentColIndex}_container_${newColumns[currentColIndex].length}`,
            columnIndex: currentColIndex,
            content: contentParts[i],
            articleId: article.id,
            height: 0,
            isFilled: true,
          };
          newColumns[currentColIndex].push(newContainer);
        }
      }
    }

    setColumns(newColumns);
  };

  return (
    <div className="layout-designer-workspace">
      <div className="workspace-header">
        <div>
          <h1>Верстка страницы</h1>
          <p>Загрузите шаблон и разместите материалы на странице</p>
        </div>
        {!template && (
          <button type="button" className="btn-create" onClick={handleLoadTemplate}>
            <span>📄</span> Загрузить шаблон
          </button>
        )}
      </div>

      {!template ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--subtext)' }}>
          <p style={{ fontSize: 18, marginBottom: 12 }}>Шаблон не загружен</p>
          <p style={{ fontSize: 14 }}>Нажмите «Загрузить шаблон» чтобы начать работу</p>
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
          </div>
          <div className="layout-page-area">
            <PageLayout
              template={template}
              columns={columns}
              onDropArticle={handleDropArticle}
              onDeleteContainer={handleDeleteContainer}
              headerContent={headerContent}
              onHeaderChange={setHeaderContent}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LayoutDesignerWorkspace;
