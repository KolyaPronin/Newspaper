import { CHARS_PER_COLUMN, LINES_PER_COLUMN, splitContentToFitWithRemaining } from '../../../../hooks/useContentSplitting';
import { ColumnContainer, PageTemplate } from '../../../../types/PageTemplate';
import { Illustration } from '../../../../utils/api';
import { FlowItem } from '../types';
import { ensureEmptyContainerAtEnd, getColumnCapacity, getColumnUsedSpace } from './metrics';

export function packFlowIntoPageColumns(
  flow: FlowItem[],
  columns: ColumnContainer[][],
  template: PageTemplate,
  startColIndex: number,
  allIllustrations: Illustration[]
): void {
  const getExtraOverheadLinesForNewFilledContainer = (existingColumn: ColumnContainer[]): number => {
    const approxLineHeightPx = 18;
    const dropZoneHeightPx = 10;
    const containerGapPx = existingColumn.length > 0 ? 8 : 0;
    const filledContainerPaddingPx = 16;
    const deltaPx = dropZoneHeightPx + containerGapPx + filledContainerPaddingPx;
    return Math.ceil(deltaPx / approxLineHeightPx);
  };

  for (let colIdx = startColIndex; colIdx < template.columns; colIdx++) {
    const column = columns[colIdx] || [];
    columns[colIdx] = column;

    for (let i = column.length - 1; i >= 0; i--) {
      if (!column[i].isFilled) {
        column.splice(i, 1);
      }
    }

    const { maxLines: baseMaxLines } = getColumnCapacity(template, colIdx);
    let used = getColumnUsedSpace(column, allIllustrations);

    if (flow.length === 0) {
      const INLINE_SAFETY_LINES = 8;
      const columnHasInlineIllustration = column.some(c => c.isFilled && c.kind === 'illustration');
      const effectiveMaxLines = Math.max(
        1,
        baseMaxLines - (columnHasInlineIllustration ? INLINE_SAFETY_LINES : 0)
      );
      const remainingLines = Math.max(0, effectiveMaxLines - used.lines);
      ensureEmptyContainerAtEnd(column, colIdx, remainingLines);
      continue;
    }

    while (flow.length > 0) {
      const current = flow[0];
      const newContainerOverheadLines = getExtraOverheadLinesForNewFilledContainer(column);

      const INLINE_SAFETY_LINES = 8;
      const columnHasInlineIllustration = column.some(c => c.isFilled && c.kind === 'illustration');
      const columnHasText = column.some(c => c.isFilled && (c.kind || 'text') === 'text');
      const willPlaceIllustrationNow = current.kind === 'illustration';

      const shouldApplyInlineSafety =
        (columnHasInlineIllustration || willPlaceIllustrationNow) && (columnHasText || current.kind === 'text');
      const effectiveMaxLines = Math.max(
        1,
        baseMaxLines - (shouldApplyInlineSafety ? INLINE_SAFETY_LINES : 0)
      );
      const effectiveMaxChars = Math.max(
        1,
        Math.floor(CHARS_PER_COLUMN * (effectiveMaxLines / LINES_PER_COLUMN))
      );

      if (current.kind === 'illustration') {
        const approxLineHeightPx = 18;
        const inlineIllustrationExtraPx = 60;
        const needLines = Math.ceil((current.heightPx + inlineIllustrationExtraPx) / approxLineHeightPx);
        const remainingLines = Math.max(0, effectiveMaxLines - used.lines);
        if (needLines + newContainerOverheadLines > remainingLines) {
          break;
        }

        if (current.span === 2 && current.spanRole === 'ghost') {
          const ghost: ColumnContainer = {
            id: `col_${colIdx}_illus_ghost_${Date.now()}_${Math.random()}`,
            columnIndex: colIdx,
            content: '',
            height: current.heightPx,
            isFilled: true,
            kind: 'illustration',
            illustrationId: current.illustrationId,
            span: 2,
            spanRole: 'ghost',
          };
          column.push(ghost);
          used = getColumnUsedSpace(column, allIllustrations);
          flow.shift();
          continue;
        }

        const resolvedSpan: 1 | 2 = current.span === 2 && colIdx < template.columns - 1 ? 2 : 1;

        if (resolvedSpan === 2) {
          const nextColIdx = colIdx + 1;
          const nextColumn = columns[nextColIdx] || [];
          columns[nextColIdx] = nextColumn;

          for (let i = nextColumn.length - 1; i >= 0; i--) {
            if (!nextColumn[i].isFilled) {
              nextColumn.splice(i, 1);
            }
          }

          const { maxLines: nextBaseMaxLines } = getColumnCapacity(template, nextColIdx);
          const nextUsed = getColumnUsedSpace(nextColumn, allIllustrations);
          const nextNewContainerOverheadLines = getExtraOverheadLinesForNewFilledContainer(nextColumn);
          const nextColumnHasText = nextColumn.some(c => c.isFilled && (c.kind || 'text') === 'text');
          const nextEffectiveMaxLines = Math.max(
            1,
            nextBaseMaxLines - (nextColumnHasText ? INLINE_SAFETY_LINES : 0)
          );
          const nextRemainingLines = Math.max(0, nextEffectiveMaxLines - nextUsed.lines);
          if (needLines + nextNewContainerOverheadLines > nextRemainingLines) {
            break;
          }

          const illContainer: ColumnContainer = {
            id: `col_${colIdx}_illus_${Date.now()}_${Math.random()}`,
            columnIndex: colIdx,
            content: '',
            height: current.heightPx,
            isFilled: true,
            kind: 'illustration',
            illustrationId: current.illustrationId,
            span: 2,
            spanRole: 'main',
          };
          column.push(illContainer);

          const ghost: ColumnContainer = {
            id: `col_${nextColIdx}_illus_ghost_${Date.now()}_${Math.random()}`,
            columnIndex: nextColIdx,
            content: '',
            height: current.heightPx,
            isFilled: true,
            kind: 'illustration',
            illustrationId: current.illustrationId,
            span: 2,
            spanRole: 'ghost',
          };
          nextColumn.push(ghost);

          used = getColumnUsedSpace(column, allIllustrations);
          flow.shift();
          continue;
        }

        const illContainer: ColumnContainer = {
          id: `col_${colIdx}_illus_${Date.now()}_${Math.random()}`,
          columnIndex: colIdx,
          content: '',
          height: current.heightPx,
          isFilled: true,
          kind: 'illustration',
          illustrationId: current.illustrationId,
          span: 1,
          spanRole: 'main',
        };
        column.push(illContainer);
        used = getColumnUsedSpace(column, allIllustrations);
        flow.shift();
        continue;
      }

      const { parts, remainingHtml } = splitContentToFitWithRemaining(
        current.html,
        used.chars,
        used.lines + newContainerOverheadLines,
        effectiveMaxChars,
        effectiveMaxLines
      );

      if (parts.length === 0) {
        break;
      }

      const filled: ColumnContainer = {
        id: `col_${colIdx}_container_${Date.now()}_${Math.random()}`,
        columnIndex: colIdx,
        content: parts[0],
        height: 0,
        isFilled: true,
        articleId: current.articleId,
        kind: 'text',
      };
      column.push(filled);

      used = getColumnUsedSpace(column, allIllustrations);

      if (remainingHtml) {
        current.html = remainingHtml;
        break;
      }

      flow.shift();
    }

    if (flow.length === 0) {
      const INLINE_SAFETY_LINES = 3;
      const columnHasInlineIllustration = column.some(c => c.isFilled && c.kind === 'illustration');
      const effectiveMaxLines = Math.max(
        1,
        baseMaxLines - (columnHasInlineIllustration ? INLINE_SAFETY_LINES : 0)
      );
      const remainingLines = Math.max(0, effectiveMaxLines - used.lines);
      ensureEmptyContainerAtEnd(column, colIdx, remainingLines);
    }
  }
}
