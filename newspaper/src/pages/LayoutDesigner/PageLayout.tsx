import React, { useMemo } from 'react';
import { PageTemplate, ColumnContainer, LayoutIllustration, LayoutAd } from '../../types/PageTemplate';
import { Illustration } from '../../utils/api';

export interface PageLayoutProps {
  template: PageTemplate;
  pageNumber: number;
  columns: ColumnContainer[][];
  globalFirstOccurrenceByArticleId: Map<string, { pageNum: number; colIndex: number; containerIdx: number }>;
  interactionDisabled?: boolean;
  inlineIllustrationSpan?: 1 | 2;
  onDropArticle: (articleId: string, columnIndex: number, containerIndex: number) => void;
  onDropInlineIllustration?: (
    illustrationId: string,
    columnIndex: number,
    containerIndex: number,
    dropRatio?: number,
    span?: 1 | 2
  ) => void;
  onDeleteContainer?: (columnIndex: number, containerIndex: number) => void;
  onDeleteInlineIllustration?: (columnIndex: number, containerIndex: number) => void;
  headerContent: string;
  onHeaderChange: (content: string) => void;
  illustrations?: Illustration[];
  layoutIllustrations?: LayoutIllustration[];
  onDropIllustration?: (illustrationId: string, columnIndex: number, positionIndex: number) => void;
  onDeleteIllustration?: (columnIndex: number, positionIndex: number) => void;

  ads?: Illustration[];
  layoutAds?: LayoutAd[];
  onDropAd?: (illustrationId: string, slotIndex: number) => void;
  onDeleteAd?: (slotIndex: number) => void;
}

const PageLayout: React.FC<PageLayoutProps> = ({ 
  template, 
  pageNumber,
  columns, 
  globalFirstOccurrenceByArticleId,
  interactionDisabled,
  inlineIllustrationSpan = 1,
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
  ads = [],
  layoutAds = [],
  onDropAd,
  onDeleteAd,
}) => {
  const parseDragPayload = (e: React.DragEvent): any | null => {
    try {
      const raw = e.dataTransfer.getData('application/x-newspaper-dnd') || e.dataTransfer.getData('text/plain');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  };

  const readDraggedIllustrationId = (e: React.DragEvent, pool: Illustration[]): string => {
    const direct = e.dataTransfer.getData('illustrationId');
    if (direct) return direct;

    const payload = parseDragPayload(e);
    if (payload && typeof payload.illustrationId === 'string' && payload.illustrationId) {
      return payload.illustrationId;
    }

    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return '';

    // If browser dragged an image URL, try map it to known items
    const byUrl = pool.find(i => i.url === raw || raw.includes(i.url));
    if (byUrl) return byUrl.id;

    // If text/plain is already an id
    return raw;
  };

  const hasSpan2InlineIllustrations = useMemo(() => {
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const col = columns[colIndex] || [];
      for (let i = 0; i < col.length; i++) {
        const c = col[i];
        if (!c || !c.isFilled) continue;
        if (c.kind !== 'illustration') continue;
        if (c.span === 2 && (c.spanRole || 'main') === 'main') return true;
      }
    }
    return false;
  }, [columns]);

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
      const span: 1 | 2 = e.shiftKey ? 2 : inlineIllustrationSpan;
      let insertIndex = containerIndex;

      if (dropTarget === 'container' && containerIsFilled && containerKind === 'text') {
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const ratioRaw = rect.height > 0 ? (relativeY / rect.height) : 0.5;
        const ratio = Math.max(0, Math.min(1, ratioRaw));
        onDropInlineIllustration(illustrationId, columnIndex, containerIndex, ratio, span);
        return;
      }

      if (dropTarget === 'container' && containerIsFilled && containerKind === 'illustration') {
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const before = relativeY < rect.height / 2;
        insertIndex = before ? containerIndex : (containerIndex + 1);
      }
      onDropInlineIllustration(illustrationId, columnIndex, insertIndex, undefined, span);
    }
  };

  const handleIllustrationDrop = (e: React.DragEvent, columnIndex: number, positionIndex: number) => {
    if (interactionDisabled) return;
    e.preventDefault();
    const assetKind = e.dataTransfer.getData('assetKind');
    if (assetKind && assetKind !== 'illustration') return;
    const illustrationId = readDraggedIllustrationId(e, illustrations);
    if (illustrationId && onDropIllustration) {
      onDropIllustration(illustrationId, columnIndex, positionIndex);
    }
  };

  const handleAdDrop = (e: React.DragEvent, slotIndex: number) => {
    if (interactionDisabled) return;
    e.preventDefault();
    const assetKind = e.dataTransfer.getData('assetKind');
    if (assetKind && assetKind !== 'ad') return;
    const illustrationId = readDraggedIllustrationId(e, ads);
    if (illustrationId && onDropAd) {
      onDropAd(illustrationId, slotIndex);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = interactionDisabled ? 'none' : 'move';
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

  const getAdForSlot = (slotIndex: number): Illustration | null => {
    const binding = layoutAds.find(a => a.slotIndex === slotIndex);
    if (!binding) return null;
    return ads.find(a => a.id === binding.illustrationId) || null;
  };

  const columnWidth = `calc((100% - ${(template.columns - 1) * 16}px) / ${template.columns})`;

  const adSlotsToRender = useMemo(() => {
    const slots = template.adSlots || [];
    if (slots.length === 0) return [];
    if (slots.length >= 2) return slots.slice(0, 2);
    const only = slots[0];
    return [only, { ...only, id: `${only.id}_auto_second` }];
  }, [template.adSlots]);

  return (
    <div className="page-layout">
      <div className="page-header">
        <div className="page-header-fixed-title">
          XPress
        </div>
      </div>

      <div className={`page-content ${hasSpan2InlineIllustrations ? 'allow-span2-overflow' : ''}`}>
        {Array.from({ length: template.columns }).map((_, colIndex) => {
          const columnContainers = columns[colIndex] || [];
          const allowOverflowInThisColumn = columnContainers.some(
            c => c && c.isFilled && c.kind === 'illustration' && c.span === 2 && (c.spanRole || 'main') === 'main'
          );
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
                className={`page-column ${allowOverflowInThisColumn ? 'allow-span2-overflow' : ''}`}
                style={{
                  height: hasIllustration ? `calc(100% - ${illustrationHeight}px - 12px)` : '100%',
                  maxHeight: hasIllustration ? `calc(100% - ${illustrationHeight}px - 12px)` : '100%',
                  marginBottom: hasIllustration ? '12px' : '0',
                }}
              >
                <div className={`page-column-content ${allowOverflowInThisColumn ? 'allow-span2-overflow' : ''}`}>
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

                        const spanRole = container.spanRole || 'main';
                        const span2Main = container.kind === 'illustration' && container.span === 2 && spanRole === 'main';
                        const span2Ghost = container.kind === 'illustration' && container.span === 2 && spanRole === 'ghost';
                        const span2LastPair = span2Main && colIndex === template.columns - 2;
                        return (
                          <React.Fragment key={container.id}>
                            <div
                              className={`column-container ${container.isFilled ? 'filled' : 'empty'} ${span2Main ? 'span-2-main' : ''} ${span2Ghost ? 'span-2-ghost' : ''}`}
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
                                        if (container.span === 2 && spanRole === 'ghost') {
                                          const ill = illustrations.find(i => i.id === container.illustrationId);
                                          const captionExtraPx = ill?.caption ? 18 : 0;
                                          // Ghost должен визуально резервировать ровно столько же, сколько main,
                                          // иначе пустые контейнеры ниже будут начинаться на разных высотах.
                                          return <div style={{ height: (container.height || 120) + captionExtraPx }} />;
                                        }
                                        const ill = illustrations.find(i => i.id === container.illustrationId);
                                        if (!ill) {
                                          return (
                                            <div className="inline-illustration-placeholder">
                                              Иллюстрация
                                            </div>
                                          );
                                        }
                                        return (
                                          <div className={`inline-illustration ${span2Main ? 'span-2' : ''} ${span2LastPair ? 'span-2-last-pair' : ''}`}>
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
                                      {onDeleteInlineIllustration && !(container.span === 2 && container.spanRole === 'ghost') && (
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

      {adSlotsToRender.length > 0 && (
        <div className="ad-slots-container">
          {adSlotsToRender.map((slot, idx) => {
            const ad = getAdForSlot(idx);
            return (
            <div
              key={slot.id}
              className="ad-slot"
              onDrop={(e) => handleAdDrop(e, idx)}
              onDragOver={handleDragOver}
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              {ad ? (
                <>
                  <img
                    src={ad.url}
                    alt={ad.caption || ''}
                    className="illustration-slot-image"
                  />
                  {onDeleteAd && (
                    <button
                      className="delete-illustration-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAd(idx);
                      }}
                      title="Удалить рекламу"
                    >
                      ✕
                    </button>
                  )}
                </>
              ) : (
                <span>Реклама</span>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PageLayout;
