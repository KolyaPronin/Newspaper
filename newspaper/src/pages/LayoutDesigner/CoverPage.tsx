import React from 'react';
import { PageTemplate, LayoutIllustration, LayoutAd } from '../../types/PageTemplate';
import { Illustration } from '../../utils/api';

export interface CoverPageProps {
  template: PageTemplate;
  newspaperTitle: string;
  onNewspaperTitleChange: (title: string) => void;
  interactionDisabled?: boolean;
  illustrations?: Illustration[];
  layoutIllustrations?: LayoutIllustration[];
  onDropIllustration?: (illustrationId: string, columnIndex: number, positionIndex: number) => void;
  onDeleteIllustration?: (columnIndex: number, positionIndex: number) => void;

  ads?: Illustration[];
  layoutAds?: LayoutAd[];
  onDropAd?: (illustrationId: string, slotIndex: number) => void;
  onDeleteAd?: (slotIndex: number) => void;
}

const CoverPage: React.FC<CoverPageProps> = ({
  template,
  newspaperTitle,
  onNewspaperTitleChange,
  interactionDisabled,
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

    const byUrl = pool.find(i => i.url === raw || raw.includes(i.url));
    if (byUrl) return byUrl.id;

    return raw;
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

  const adSlotsToRender = (() => {
    const slots = template.adSlots || [];
    if (slots.length === 0) return [];
    if (slots.length >= 2) return slots.slice(0, 2);
    const only = slots[0];
    return [only, { ...only, id: `${only.id}_auto_second` }];
  })();

  return (
    <div className="page-layout cover-page">
      <div className="cover-header">
        <div className="page-header-fixed-title">
          XPress
        </div>
      </div>

      <div className="cover-content">
        <div className="cover-column-wrapper">
          <div className="cover-illustrations">
            {template.illustrationPositions
              .filter(pos => pos.allowedColumns.includes(0))
              .map((pos, idx) => {
                const illustration = getIllustrationForSlot(0, idx);
                return (
                  <div
                    key={`cover_illus_0_${idx}`}
                    className={`cover-illustration-slot ${illustration ? 'filled' : ''}`}
                    onDrop={(e) => handleIllustrationDrop(e, 0, idx)}
                    onDragOver={handleDragOver}
                  >
                    {illustration ? (
                      <>
                        <img
                          src={illustration.url}
                          alt={illustration.caption || ''}
                          className="cover-illustration-image"
                        />
                        {onDeleteIllustration && (
                          <button
                            className="delete-illustration-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteIllustration(0, idx);
                            }}
                            title="Удалить иллюстрацию"
                          >
                            ✕
                          </button>
                        )}
                      </>
                    ) : (
                      <span>Перетащите обложку сюда</span>
                    )}
                  </div>
                );
              })}
          </div>
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

export default CoverPage;

