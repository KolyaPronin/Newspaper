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
    <div className="page-layout" style={{ 
      margin: '20px auto', 
      width: '210mm', 
      height: '297mm', 
      background: '#fff', 
      boxShadow: '0 0 20px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div className="page-header" style={{ 
        minHeight: '40px',
        borderBottom: '1px solid #ddd', 
        padding: '12px', 
        textAlign: 'center', 
        background: '#f5f5f5' 
      }}>
        <input
          type="text"
          value={headerContent}
          onChange={(e) => onHeaderChange(e.target.value)}
          style={{
            width: '100%',
            border: 'none',
            background: 'transparent',
            fontSize: '16px',
            fontWeight: 600,
            textAlign: 'center',
            outline: 'none',
          }}
          placeholder="Заголовок газеты"
        />
      </div>

      <div className="page-content" style={{ 
        display: 'flex', 
        gap: '16px',
        padding: '16px',
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {columns.map((columnContainers, colIndex) => {
          const hasIllustration = template.illustrationPositions.some(
            pos => pos.allowedColumns.includes(colIndex)
          );
          const illustrationHeight = hasIllustration ? 120 : 0;
          
          return (
            <div
              key={colIndex}
              style={{
                width: columnWidth,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
            >
              <div
                className="page-column"
                style={{
                  width: '100%',
                  padding: '12px',
                  position: 'relative',
                  background: '#fafafa',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  display: 'flex',
                  flexDirection: 'column',
                  height: hasIllustration ? `calc(100% - ${illustrationHeight}px - 12px)` : '100%',
                  maxHeight: hasIllustration ? `calc(100% - ${illustrationHeight}px - 12px)` : '100%',
                  overflow: 'hidden',
                  marginBottom: hasIllustration ? '12px' : '0',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    maxHeight: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  {columnContainers.length === 0 ? (
                    <div
                      className="column-container empty"
                      onDrop={(e) => handleDrop(e, colIndex, 0)}
                      onDragOver={handleDragOver}
                      style={{
                        border: '2px dashed var(--accent)',
                        borderRadius: '4px',
                        padding: '20px',
                        background: 'rgba(6, 191, 204, 0.05)',
                        cursor: 'pointer',
                        flexShrink: 0,
                        minHeight: '100px',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div style={{ color: 'var(--subtext)', fontSize: '12px', textAlign: 'center' }}>
                        Перетащите статью сюда
                      </div>
                    </div>
                  ) : (
                    columnContainers.map((container, containerIdx) => {
                      const isFirst = containerIdx === 0;
                      const isLast = containerIdx === columnContainers.length - 1;
                      return (
                        <div
                          key={container.id}
                          className={`column-container ${container.isFilled ? 'filled' : 'empty'}`}
                          onDrop={(e) => handleDrop(e, colIndex, containerIdx)}
                          onDragOver={handleDragOver}
                          style={{
                            border: container.isFilled ? 'none' : '2px dashed var(--accent)',
                            borderRadius: isFirst ? '4px' : '0',
                            padding: container.isFilled ? '8px' : '20px',
                            background: container.isFilled ? 'transparent' : 'rgba(6, 191, 204, 0.05)',
                            cursor: container.isFilled ? 'default' : 'pointer',
                            flexShrink: container.isFilled ? 0 : 1,
                            minHeight: container.isFilled ? 'auto' : '100px',
                            maxHeight: '100%',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            marginBottom: isLast ? '0' : '8px',
                          }}
                        >
                          {container.isFilled ? (
                            <div style={{ 
                              position: 'relative', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              width: '100%', 
                              flex: '1 1 auto',
                              minHeight: 0,
                              overflow: 'hidden' 
                            }}>
                              <div
                                className="article-content"
                                dangerouslySetInnerHTML={{ __html: container.content }}
                                style={{ 
                                  fontSize: '12px', 
                                  lineHeight: '1.5', 
                                  overflow: 'hidden',
                                  wordBreak: 'break-word',
                                  hyphens: 'auto'
                                }}
                              />
                              {onDeleteContainer && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteContainer(colIndex, containerIdx);
                                  }}
                                  style={{
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    background: 'rgba(255, 107, 107, 0.9)',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    padding: '4px 8px',
                                    fontSize: '10px',
                                    fontWeight: 500,
                                    zIndex: 10,
                                  }}
                                  title="Удалить текст"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ) : (
                            <div style={{ color: 'var(--subtext)', fontSize: '12px', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                <div style={{ 
                  width: '100%',
                  flexShrink: 0,
                }}>
                  {template.illustrationPositions
                    .filter(pos => pos.allowedColumns.includes(colIndex))
                    .map((pos, idx) => {
                      const illustration = getIllustrationForSlot(colIndex, idx);
                      return (
                        <div
                          key={`illus_${colIndex}_${idx}`}
                          className="illustration-slot"
                          onDrop={(e) => handleIllustrationDrop(e, colIndex, idx)}
                          onDragOver={handleDragOver}
                          style={{
                            width: '100%',
                            height: '120px',
                            border: illustration ? '2px solid #4ecdc4' : '2px dashed #4ecdc4',
                            background: illustration ? 'rgba(78, 205, 196, 0.2)' : 'rgba(78, 205, 196, 0.1)',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            color: '#4ecdc4',
                            flexShrink: 0,
                            marginTop: idx > 0 ? '12px' : '0',
                            position: 'relative',
                            overflow: 'hidden',
                            cursor: illustration ? 'default' : 'pointer',
                          }}
                        >
                          {illustration ? (
                            <>
                              <img
                                src={illustration.url}
                                alt={illustration.caption || ''}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                              />
                              {onDeleteIllustration && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteIllustration(colIndex, idx);
                                  }}
                                  style={{
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    background: 'rgba(255, 107, 107, 0.9)',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    padding: '4px 8px',
                                    fontSize: '10px',
                                    fontWeight: 500,
                                    zIndex: 10,
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
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #e0e0e0',
        }}>
          {template.adSlots.map(slot => (
            <div
              key={slot.id}
              className="ad-slot"
              style={{
                width: '100%',
                height: '60px',
                border: '2px dashed #ff6b6b',
                background: 'rgba(255, 107, 107, 0.15)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                color: '#ff6b6b',
                fontWeight: 500,
              }}
            >
              Реклама
            </div>
          ))}
        </div>
      )}

      <div className="page-footer" style={{ 
        minHeight: '30px',
        borderTop: '1px solid #ddd', 
        padding: '8px', 
        textAlign: 'center', 
        background: '#f5f5f5', 
        fontSize: '12px' 
      }}>
        {template.footers.content}
      </div>
    </div>
  );
};

export default PageLayout;

