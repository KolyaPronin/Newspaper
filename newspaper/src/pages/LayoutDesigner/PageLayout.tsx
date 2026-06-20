import React, { useMemo } from 'react';
import { PageTemplate, ColumnContainer, LayoutIllustration, LayoutAd } from '../../types/PageTemplate';
import { Article } from '../../types/Article';
import { Illustration } from '../../utils/api';
import ColumnFlowBody from './ColumnFlowBody';
import { getColumnHtml } from './workspace/columnHtml/columnHtmlModel';

export interface PageLayoutProps {
  template: PageTemplate;
  pageNumber: number;
  columns: ColumnContainer[][];
  articles: Article[];
  illustrations?: Illustration[];
  onColumnHtmlChange: (columnIndex: number, html: string) => void;
  interactionDisabled?: boolean;
  headerContent: string;
  onHeaderChange: (content: string) => void;
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
  articles,
  illustrations = [],
  onColumnHtmlChange,
  interactionDisabled,
  layoutIllustrations = [],
  onDropIllustration,
  onDeleteIllustration,
  ads = [],
  layoutAds = [],
  onDropAd,
  onDeleteAd,
}) => {
  const parseDragPayload = (e: React.DragEvent): Record<string, unknown> | null => {
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

    const byUrl = pool.find(i => i.url === raw || raw.includes(i.url));
    if (byUrl) return byUrl.id;

    return raw;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = interactionDisabled ? 'none' : 'copy';
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

  return (
    <div className="page-layout">
      <div className="page-header">
        <div className="page-header-fixed-title">XPress</div>
      </div>

      <div className="page-content page-content--columns">
        <div className="page-columns-row">
          {Array.from({ length: template.columns }).map((_, colIndex) => (
            <div
              key={`col-wrap-${pageNumber}-${colIndex}`}
              className="page-col-wrapper"
              style={{ width: columnWidth }}
            >
              <ColumnFlowBody
                key={`col-${pageNumber}-${colIndex}`}
                columnIndex={colIndex}
                html={getColumnHtml(columns, colIndex, illustrations)}
                articles={articles}
                illustrations={illustrations}
                disabled={interactionDisabled}
                onHtmlChange={(html) => onColumnHtmlChange(colIndex, html)}
              />
            </div>
          ))}
        </div>

        <div className="page-illustration-row">
          {Array.from({ length: template.columns }).map((_, colIndex) => {
            const illustrationSlotsCount = template.illustrationPositions.filter(pos =>
              pos.allowedColumns.includes(colIndex)
            ).length;
            const hasIllustration = illustrationSlotsCount > 0;

            if (!hasIllustration) {
              return <div key={colIndex} className="page-illustration-slot-spacer" style={{ width: columnWidth }} />;
            }

            return (
              <div key={colIndex} className="page-column-wrapper page-column-wrapper--slots-only" style={{ width: columnWidth }}>
                <div className="illustrations-container">
                  {template.illustrationPositions
                    .filter(pos => pos.allowedColumns.includes(colIndex))
                    .map((pos, idx) => {
                      const illustration = getIllustrationForSlot(colIndex, idx);
                      return (
                        <div
                          key={`illus_${colIndex}_${idx}`}
                          className={`illustration-slot ${illustration ? 'filled' : ''}`}
                          onDrop={e => handleIllustrationDrop(e, colIndex, idx)}
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
                                  type="button"
                                  className="delete-illustration-btn"
                                  onClick={e => {
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
              </div>
            );
          })}
        </div>
      </div>

      {adSlotsToRender.length > 0 && (
        <div className="ad-slots-container">
          {adSlotsToRender.map((slot, idx) => {
            const ad = getAdForSlot(idx);
            return (
              <div
                key={slot.id}
                className="ad-slot"
                onDrop={e => handleAdDrop(e, idx)}
                onDragOver={handleDragOver}
                style={{ position: 'relative', overflow: 'hidden' }}
              >
                {ad ? (
                  <>
                    <img src={ad.url} alt={ad.caption || ''} className="illustration-slot-image" />
                    {onDeleteAd && (
                      <button
                        type="button"
                        className="delete-illustration-btn"
                        onClick={e => {
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
