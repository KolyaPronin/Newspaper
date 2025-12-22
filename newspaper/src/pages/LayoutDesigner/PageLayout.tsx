import React, { useMemo } from 'react';
import { PageTemplate, ColumnContainer, LayoutIllustration } from '../../types/PageTemplate';
import { Illustration } from '../../utils/api';

export interface PageLayoutProps {
  template: PageTemplate;
  pageNumber: number;
  columns: ColumnContainer[][];
  globalFirstOccurrenceByArticleId: Map<string, { pageNum: number; colIndex: number; containerIdx: number }>;
  interactionDisabled?: boolean;
  onDropArticle: (articleId: string, columnIndex: number, containerIndex: number) => void;
  onDropInlineIllustration?: (illustrationId: string, columnIndex: number, containerIndex: number, dropRatio?: number) => void;
  onDeleteContainer?: (columnIndex: number, containerIndex: number) => void;
  onDeleteInlineIllustration?: (columnIndex: number, containerIndex: number) => void;
  headerContent: string;
  onHeaderChange: (content: string) => void;
  illustrations?: Illustration[];
  layoutIllustrations?: LayoutIllustration[];
  onDropIllustration?: (illustrationId: string, columnIndex: number, positionIndex: number) => void;
  onDeleteIllustration?: (columnIndex: number, positionIndex: number) => void;
}

const PageLayout: React.FC<PageLayoutProps> = ({ 
  template, 
  pageNumber,
  columns, 
  globalFirstOccurrenceByArticleId,
  interactionDisabled,
  onDropArticle, 
  onDropInlineIllustration,
  onDeleteContainer, 
  onDeleteInlineIllustration,
  headerContent, 
  onHeaderChange,
  illustrations = [],
  layoutIllustrations = [],
  onDropIllustration,
  onDeleteIllustration,
}) => {
  const firstOccurrenceByArticleIdOnPage = useMemo(() => {
    const map = new Map<string, { colIndex: number; containerIdx: number }>();
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const col = columns[colIndex] || [];
      for (let containerIdx = 0; containerIdx < col.length; containerIdx++) {
        const c = col[containerIdx];
        if (!c || !c.isFilled || !c.articleId) continue;
        if (!map.has(c.articleId)) {
          map.set(c.articleId, { colIndex, containerIdx });
        }
      }
    }
    return map;
  }, [columns]);

  const handleDrop = (
    e: React.DragEvent,
    columnIndex: number,
    containerIndex: number,
    dropTarget: 'zone' | 'container',
    containerIsFilled?: boolean,
    containerKind?: 'text' | 'illustration'
  ) => {
    if (interactionDisabled) return;
    e.preventDefault();
    const articleId = e.dataTransfer.getData('articleId');
    if (articleId) {
      onDropArticle(articleId, columnIndex, containerIndex);
      return;
    }

    const illustrationId = e.dataTransfer.getData('illustrationId');
    if (illustrationId && onDropInlineIllustration) {
      let insertIndex = containerIndex;

      if (dropTarget === 'container' && containerIsFilled && containerKind === 'text') {
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const ratioRaw = rect.height > 0 ? (relativeY / rect.height) : 0.5;
        const ratio = Math.max(0, Math.min(1, ratioRaw));
        onDropInlineIllustration(illustrationId, columnIndex, containerIndex, ratio);
        return;
      }

      if (dropTarget === 'container' && containerIsFilled && containerKind === 'illustration') {
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const before = relativeY < rect.height / 2;
        insertIndex = before ? containerIndex : (containerIndex + 1);
      }
      onDropInlineIllustration(illustrationId, columnIndex, insertIndex);
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
    if (interactionDisabled) return;
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
        {Array.from({ length: template.columns }).map((_, colIndex) => {
          const columnContainers = columns[colIndex] || [];
          const illustrationSlotsCount = template.illustrationPositions.filter(
            pos => pos.allowedColumns.includes(colIndex)
          ).length;
          const hasIllustration = illustrationSlotsCount > 0;
          const illustrationSlotHeightPx = 120;
          const illustrationGapPx = 12;
          const illustrationHeight = hasIllustration
            ? (illustrationSlotsCount * illustrationSlotHeightPx) + ((illustrationSlotsCount - 1) * illustrationGapPx)
            : 0;
          
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
                      onDrop={(e) => handleDrop(e, colIndex, 0, 'zone')}
                      onDragOver={handleDragOver}
                    >
                      <div className="container-empty-text">
                        Перетащите статью сюда
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className="container-drop-zone"
                        onDrop={(e) => handleDrop(e, colIndex, 0, 'zone')}
                        onDragOver={handleDragOver}
                      />
                      {columnContainers.map((container, containerIdx) => {
                        const isLast = containerIdx === columnContainers.length - 1;
                        const isDeleteButtonAllowed = (() => {
                          if (!onDeleteContainer) return false;
                          if (!container.isFilled) return false;
                          if (container.kind === 'illustration') return false;
                          if (!container.articleId) return true;

                          // Показываем ✕ только у "начала" статьи:
                          // 1) на странице — только у первого фрагмента
                          // 2) глобально — только если это самое первое появление статьи во всём макете
                          const firstOnPage = firstOccurrenceByArticleIdOnPage.get(container.articleId);
                          if (!firstOnPage || firstOnPage.colIndex !== colIndex || firstOnPage.containerIdx !== containerIdx) {
                            return false;
                          }

                          const globalFirst = globalFirstOccurrenceByArticleId.get(container.articleId);
                          if (!globalFirst) {
                            // Если глобальная карта не содержит статью (например, только что вставили и данные ещё не попали)
                            // — хотя бы не показываем множество крестиков на странице.
                            return true;
                          }

                          return (
                            globalFirst.pageNum === pageNumber &&
                            globalFirst.colIndex === colIndex &&
                            globalFirst.containerIdx === containerIdx
                          );
                        })();
                        return (
                          <React.Fragment key={container.id}>
                            <div
                              className={`column-container ${container.isFilled ? 'filled' : 'empty'}`}
                              onDrop={(e) => handleDrop(
                                e,
                                colIndex,
                                containerIdx,
                                'container',
                                container.isFilled,
                                (container.kind || 'text')
                              )}
                              onDragOver={handleDragOver}
                              style={{ marginBottom: isLast ? '0' : '8px' }}
                            >
                              {container.isFilled ? (
                                <div className="container-content">
                                  {container.kind === 'illustration' ? (
                                    <>
                                      {(() => {
                                        const ill = illustrations.find(i => i.id === container.illustrationId);
                                        if (!ill) {
                                          return (
                                            <div className="inline-illustration-placeholder">
                                              Иллюстрация
                                            </div>
                                          );
                                        }
                                        return (
                                          <div className="inline-illustration">
                                            <img
                                              src={ill.url}
                                              alt={ill.caption || ''}
                                              className="inline-illustration-image"
                                              style={{ height: container.height || 120 }}
                                            />
                                            {ill.caption && (
                                              <div className="inline-illustration-caption">
                                                {ill.caption}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                      {onDeleteInlineIllustration && (
                                        <button
                                          className="delete-container-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteInlineIllustration?.(colIndex, containerIdx);
                                          }}
                                          title="Удалить иллюстрацию"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <div
                                        className="article-content"
                                        lang="ru"
                                        dangerouslySetInnerHTML={{ __html: container.content }}
                                      />
                                      {isDeleteButtonAllowed && (
                                        <button
                                          className="delete-container-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteContainer?.(colIndex, containerIdx);
                                          }}
                                          title="Удалить текст"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="container-empty-text">
                                  Перетащите статью сюда
                                </div>
                              )}
                            </div>
                            {!isLast && (
                              <div
                                className="container-drop-zone"
                                onDrop={(e) => handleDrop(e, colIndex, containerIdx + 1, 'zone')}
                                onDragOver={handleDragOver}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                      <div
                        className="container-drop-zone"
                        onDrop={(e) => handleDrop(e, colIndex, columnContainers.length, 'zone')}
                        onDragOver={handleDragOver}
                      />
                    </>
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
