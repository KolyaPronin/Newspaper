import { CHARS_PER_COLUMN, LINES_PER_COLUMN, getTextLength, getTextLines } from '../../../../hooks/useContentSplitting';
import { PageTemplate, ColumnContainer } from '../../../../types/PageTemplate';
import { Illustration } from '../../../../utils/api';

export function getColumnUsedSpace(
  column: ColumnContainer[],
  allIllustrations: Illustration[]
): { chars: number; lines: number } {
  let totalChars = 0;
  let totalLines = 0;
  let filledCount = 0;
  const approxLineHeightPx = 18;
  const inlineIllustrationExtraPx = 40;

  column.forEach(cont => {
    if (cont.isFilled) {
      filledCount += 1;
      if (cont.kind === 'illustration') {
        const h = cont.height && cont.height > 0 ? cont.height : 120;
        const ill = cont.illustrationId ? allIllustrations.find(i => i.id === cont.illustrationId) : undefined;
        const captionExtraPx = ill?.caption ? 18 : 0;
        totalLines += Math.ceil((h + inlineIllustrationExtraPx + captionExtraPx) / approxLineHeightPx);
      } else {
        totalChars += getTextLength(cont.content);
        totalLines += getTextLines(cont.content);
      }
    }
  });

  const columnPaddingPx = 24;
  const dropZoneHeightPx = 10;
  const containerGapPx = 8;
  const filledContainerPaddingPx = 16;
  const dropZonesCount = column.length > 0 ? column.length : 0;
  const gapsCount = Math.max(0, column.length - 1);
  const overheadPx =
    columnPaddingPx +
    (dropZonesCount * dropZoneHeightPx) +
    (gapsCount * containerGapPx) +
    (filledCount * filledContainerPaddingPx);
  const overheadLines = overheadPx > 0 ? Math.ceil(overheadPx / approxLineHeightPx) : 0;
  totalLines += overheadLines;

  totalLines += 1;

  return { chars: totalChars, lines: totalLines };
}

export function getColumnCapacity(template: PageTemplate, columnIndex: number): { maxChars: number; maxLines: number } {
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
}

export function ensureEmptyContainerAtEnd(
  column: ColumnContainer[],
  columnIndex: number,
  remainingLines: number
): void {
  const MIN_EMPTY_DROP_LINES = 4;
  const approxLineHeightPx = 18;

  const emptyContainerPaddingPx = 40;
  const extraDropZonePx = 10;
  const extraGapPx = 8;
  const extraOverheadLines = Math.ceil(
    (emptyContainerPaddingPx + extraDropZonePx + extraGapPx) / approxLineHeightPx
  );

  const predictedRemainingAfterEmpty = remainingLines - extraOverheadLines;

  if (predictedRemainingAfterEmpty < MIN_EMPTY_DROP_LINES) {
    while (column.length > 0 && !column[column.length - 1].isFilled) {
      column.pop();
    }

    const hasEmpty = column.some(cont => !cont.isFilled);
    if (!hasEmpty) {
      column.push({
        id: `col_${columnIndex}_container_${Date.now()}_${Math.random()}`,
        columnIndex,
        content: '',
        height: 0,
        isFilled: false,
      });
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
}
