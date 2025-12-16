import React from 'react';
import { PageTemplate, ColumnContainer, LayoutIllustration } from '../../types/PageTemplate';
import { Illustration } from '../../utils/api';

export interface PageLayoutProps {
  template: PageTemplate;
  columns: ColumnContainer[][];
  onDropArticle: (articleId: string, columnIndex: number, containerIndex: number) => void;
  onDeleteContainer?: (columnIndex: number, containerIndex: number) => void;
  headerContent: string;
  onHeaderChange: (content: string) => void;
  illustrations?: Illustration[];
  layoutIllustrations?: LayoutIllustration[];
  onDropIllustration?: (illustrationId: string, columnIndex: number, positionIndex: number) => void;
  onDeleteIllustration?: (columnIndex: number, positionIndex: number) => void;
}

const PageLayout: React.FC<PageLayoutProps> = ({ 
  template, 
  columns, 
  onDropArticle, 
  onDeleteContainer, 
  headerContent, 
  onHeaderChange,
  illustrations = [],
  layoutIllustrations = [],
  onDropIllustration,
  onDeleteIllustration,
}) => {
  const handleDrop = (e: React.DragEvent, columnIndex: number, containerIndex: number) => {
    e.preventDefault();
    const articleId = e.dataTransfer.getData('articleId');
    if (articleId) {
      onDropArticle(articleId, columnIndex, containerIndex);
    }
  };

  const handleIllustrationDrop = (e: React.DragEvent, columnIndex: number, positionIndex: number) => {
    e.preventDefault();
    const illustrationId = e.dataTransfer.getData('illustrationId');
    if (illustrationId && onDropIllustration) {
      onDropIllustration(illustrationId, columnIndex, positionIndex);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const getIllustrationForSlot = (columnIndex: number, positionIndex: number): Illustration | null => {
    const layoutIll = layoutIllustrations.find(
      li => li.columnIndex === columnIndex && li.positionIndex === positionIndex
    );
    if (layoutIll) {
      return illustrations.find(ill => ill.id === layoutIll.illustrationId) || null;
    }
    return null;
  };

  const columnWidth = `calc((100% - ${(template.columns - 1) * 16}px) / ${template.columns})`;

  return (
    <div className="page-layout">
      <div className="page-header">
        <input
          type="text"
          className="page-header-input"
          value={headerContent}
          onChange={(e) => onHeaderChange(e.target.value)}
          placeholder="Заголовок газеты"
        />
      </div>

      <div className="page-content">
        {columns.map((columnContainers, colIndex) => {
          const hasIllustration = template.illustrationPositions.some(
            pos => pos.allowedColumns.includes(colIndex)
          );
          const illustrationHeight = hasIllustration ? 120 : 0;
          
          return (
            <div
              key={colIndex}
              className="page-column-wrapper"
              style={{ width: columnWidth }}
            >
              <div
                className="page-column"
                style={{
                  height: hasIllustration ? `calc(100% - ${illustrationHeight}px - 12px)` : '100%',
                  maxHeight: hasIllustration ? `calc(100% - ${illustrationHeight}px - 12px)` : '100%',
                  marginBottom: hasIllustration ? '12px' : '0',
                }}
              >
                <div className="page-column-content">
                  {columnContainers.length === 0 ? (
                    <div
                      className="column-container empty"
                      onDrop={(e) => handleDrop(e, colIndex, 0)}
                      onDragOver={handleDragOver}
                    >
                      <div className="container-empty-text">
                        Перетащите статью сюда
                      </div>
                    </div>
                  ) : (
                    columnContainers.map((container, containerIdx) => {
                      const isLast = containerIdx === columnContainers.length - 1;
                      return (
                        <div
                          key={container.id}
                          className={`column-container ${container.isFilled ? 'filled' : 'empty'}`}
                          onDrop={(e) => handleDrop(e, colIndex, containerIdx)}
                          onDragOver={handleDragOver}
                          style={{ marginBottom: isLast ? '0' : '8px' }}
                        >
                          {container.isFilled ? (
                            <div className="container-content">
                              <div
                                className="article-content"
                                dangerouslySetInnerHTML={{ __html: container.content }}
                              />
                              {onDeleteContainer && (
                                <button
                                  className="delete-container-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteContainer(colIndex, containerIdx);
                                  }}
                                  title="Удалить текст"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="container-empty-text">
                              Перетащите статью сюда
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              {hasIllustration && (
                <div className="illustrations-container">
                  {template.illustrationPositions
                    .filter(pos => pos.allowedColumns.includes(colIndex))
                    .map((pos, idx) => {
                      const illustration = getIllustrationForSlot(colIndex, idx);
                      return (
                        <div
                          key={`illus_${colIndex}_${idx}`}
                          className={`illustration-slot ${illustration ? 'filled' : ''}`}
                          onDrop={(e) => handleIllustrationDrop(e, colIndex, idx)}
                          onDragOver={handleDragOver}
                          style={{ marginTop: idx > 0 ? '12px' : '0' }}
                        >
                          {illustration ? (
                            <>
                              <img
                                src={illustration.url}
                                alt={illustration.caption || ''}
                                className="illustration-slot-image"
                              />
                              {onDeleteIllustration && (
                                <button
                                  className="delete-illustration-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteIllustration(colIndex, idx);
                                  }}
                                  title="Удалить иллюстрацию"
                                >
                                  ✕
                                </button>
                              )}
                            </>
                          ) : (
                            <span>Иллюстрация</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {template.adSlots.length > 0 && (
        <div className="ad-slots-container">
          {template.adSlots.map(slot => (
            <div
              key={slot.id}
              className="ad-slot"
            >
              Реклама
            </div>
          ))}
        </div>
      )}

      <div className="page-footer">
        {template.footers.content}
      </div>
    </div>
  );
};

export default PageLayout;
