import React from 'react';
import { PageTemplate, ColumnContainer, LayoutIllustration } from '../../types/PageTemplate';
import { Illustration } from '../../utils/api';

export interface CoverPageProps {
  template: PageTemplate;
  newspaperTitle: string;
  onNewspaperTitleChange: (title: string) => void;
  illustrations?: Illustration[];
  layoutIllustrations?: LayoutIllustration[];
  onDropIllustration?: (illustrationId: string, columnIndex: number, positionIndex: number) => void;
  onDeleteIllustration?: (columnIndex: number, positionIndex: number) => void;
}

const CoverPage: React.FC<CoverPageProps> = ({
  template,
  newspaperTitle,
  onNewspaperTitleChange,
  illustrations = [],
  layoutIllustrations = [],
  onDropIllustration,
  onDeleteIllustration,
}) => {

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

  return (
    <div className="page-layout cover-page">
      <div className="cover-header">
        <input
          type="text"
          className="cover-title-input"
          value={newspaperTitle}
          onChange={(e) => onNewspaperTitleChange(e.target.value)}
          placeholder="Название газеты"
        />
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
    </div>
  );
};

export default CoverPage;

