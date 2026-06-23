import { CHARS_PER_COLUMN, LINES_PER_COLUMN, splitContentToFitWithRemaining } from '../../../../hooks/useContentSplitting';
import { ColumnContainer, PageTemplate } from '../../../../types/PageTemplate';
import { Illustration } from '../../../../utils/api';
import { FlowItem } from '../types';
import { ensureEmptyContainerAtEnd, getColumnCapacity, getColumnUsedSpace } from './metrics';
import { parseHtmlParagraphs, serializeHtmlParagraphs } from '../paragraphParser';

export function packFlowIntoPageColumns(
  flow: FlowItem[],
  columns: ColumnContainer[][],
  template: PageTemplate,
  startColIndex: number,
  allIllustrations: Illustration[],
  articleParagraphOffsets: Record<string, number> = {}
): void {
  // Initialize offsets from previous columns (only if they aren't already provided for previous pages)
  if (startColIndex > 0) {
    for (let c = 0; c < startColIndex; c++) {
      const col = columns[c] || [];
      col.forEach(cont => {
        if (cont.isFilled && cont.kind === 'text' && cont.articleId) {
          articleParagraphOffsets[cont.articleId] = (articleParagraphOffsets[cont.articleId] || 0) + parseHtmlParagraphs(cont.content).length;
        }
      });
    }
  }

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
      const illustrationCount = column.filter(c => c.isFilled && c.kind === 'illustration').length;
      const effectiveMaxLines = Math.max(
        1,
        baseMaxLines - (illustrationCount * 8)
      );
      const remainingLines = Math.max(0, effectiveMaxLines - used.lines);
      ensureEmptyContainerAtEnd(column, colIdx, remainingLines);
      continue;
    }

    while (flow.length > 0) {
      const current = flow[0];

      // Keep existing illustrations in their original column during reflow.
      // This prevents visual "jumping" when text is repacked.
      if (
        current.kind === 'illustration' &&
        current.source === 'existing' &&
        typeof current.pinnedColumnIndex === 'number' &&
        current.pinnedColumnIndex !== colIdx
      ) {
        break;
      }

      // --- If current is text and there are anchored illustrations, check if we need to split ---
      if (current.kind === 'text' && flow.length > 1) {
        // Find ALL illustrations in the remaining flow that belong to this article and have an anchor
        const offset = articleParagraphOffsets[current.articleId || ''] || 0;
        const paragraphs = parseHtmlParagraphs(current.html);
        
        // Find the FIRST illustration that should be inserted within THIS text block
        let splitIdx = -1;
        let localAnchor = -1;

        for (let j = 1; j < flow.length; j++) {
          const item = flow[j];
          if (item.kind === 'illustration' && typeof item.anchorParagraphIndex === 'number' && item.articleId === current.articleId) {
            const anchor = item.anchorParagraphIndex - offset;
            if (anchor > 0 && anchor < paragraphs.length) {
              splitIdx = j;
              localAnchor = anchor;
              break; // Found the earliest one to split at
            }
          } else if (item.kind === 'text' && item.articleId !== current.articleId) {
            break; // Hit a different article
          }
        }

        if (splitIdx !== -1) {
          const before = paragraphs.slice(0, localAnchor);
          const after = paragraphs.slice(localAnchor);
          current.html = serializeHtmlParagraphs(before);
          const remainingItem: FlowItem = { ...current, html: serializeHtmlParagraphs(after), source: 'existing' };
          
          // Move the illustration (and its ghost if span=2) to right after current text
          const ill = flow.splice(splitIdx, 1)[0];
          flow.splice(1, 0, ill);
          flow.splice(2, 0, remainingItem);
          // Now current.html is only the part before the FIRST anchor.
          
          // Re-evaluate if current (now shorter) fits.
          continue; 
        }
      }

      const newContainerOverheadLines = getExtraOverheadLinesForNewFilledContainer(column);

      const illustrationCount = column.filter(c => c.isFilled && c.kind === 'illustration').length;
      const columnHasText = column.some(c => c.isFilled && (c.kind || 'text') === 'text');
      const willPlaceIllustrationNow = current.kind === 'illustration';
      
      const effectiveIllustrationCount = illustrationCount + (willPlaceIllustrationNow ? 1 : 0);

      const shouldApplyInlineSafety =
        effectiveIllustrationCount > 0 && (columnHasText || current.kind === 'text');
      
      // Safety lines per illustration. If multiple, we need more safety as they might stack or 
      // cause more wrapping issues.
      const SAFETY_PER_ILLUSTRATION = 6;
      const totalSafetyLines = effectiveIllustrationCount * SAFETY_PER_ILLUSTRATION;

      const effectiveMaxLines = Math.max(
        1,
        baseMaxLines - (shouldApplyInlineSafety ? totalSafetyLines : 0)
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
        
        // --- MODIFIED: Illustrations must NEVER move to next column/page. ---
        // They stay in the column they were dropped in, even if they overflow.
        // The user said "illustration should NEVER move".
        /* 
        if (needLines + newContainerOverheadLines > remainingLines) {
          break;
        }
        */

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
            nextBaseMaxLines - (nextColumnHasText ? 6 : 0)
          );
          const nextRemainingLines = Math.max(0, nextEffectiveMaxLines - nextUsed.lines);
          /*
          if (needLines + nextNewContainerOverheadLines > nextRemainingLines) {
            break;
          }
          */

          const offset = current.articleId ? (articleParagraphOffsets[current.articleId] || 0) : 0;
          const localAnchor = (typeof current.anchorParagraphIndex === 'number' && current.articleId)
            ? current.anchorParagraphIndex - offset
            : null;

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
            float: current.float,
            anchorParagraphIndex: localAnchor,
            articleId: current.articleId,
          };
          column.push(illContainer);

          // Ghost must be inserted at the same logical position in the next column
          // as main is in the current column. Any existing content in nextColumn at
          // that position must be pushed into flow so it gets repacked after the ghost.
          const ghostInsertIdx = nextColumn.length; // next column was already cleared of empties above
          // Collect any remaining filled content from nextColumn that comes after ghostInsertIdx
          // (currently none since we insert at end, but this makes the intent explicit)
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
          nextColumn.splice(ghostInsertIdx, 0, ghost);

          // Push displaced content from nextColumn back into flow so it repacks after ghost
          const displaced = nextColumn.splice(ghostInsertIdx + 1);
          displaced.forEach(cont => {
            if (cont.isFilled && cont.content) {
              flow.push({ kind: 'text', articleId: cont.articleId, html: cont.content, source: 'existing' });
            } else if (cont.isFilled && cont.kind === 'illustration' && cont.illustrationId && cont.span !== 2) {
              flow.push({ kind: 'illustration', illustrationId: cont.illustrationId, span: 1, spanRole: 'main', heightPx: cont.height || 120, source: 'existing' });
            }
          });

          used = getColumnUsedSpace(column, allIllustrations);
          flow.shift();
          continue;
        }

        const offset = current.articleId ? (articleParagraphOffsets[current.articleId] || 0) : 0;
        const localAnchor = (typeof current.anchorParagraphIndex === 'number' && current.articleId)
          ? current.anchorParagraphIndex - offset
          : null;

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
          float: current.float,
          anchorParagraphIndex: localAnchor,
          articleId: current.articleId,
        };
        column.push(illContainer);
        used = getColumnUsedSpace(column, allIllustrations);
        flow.shift();
        continue;
      }

      const { parts, remainingHtml, fillsContainer } = splitContentToFitWithRemaining(
        current.html,
        used.chars,
        used.lines + newContainerOverheadLines,
        effectiveMaxChars,
        effectiveMaxLines
      );

      // If we couldn't fit even one part and there are illustrations later in the flow
      // that MUST stay in this column, we should NOT break. We should skip text and 
      // place the illustration first? No, that would break order.
      // If illustrations must never move, and text doesn't fit, text must move.
      if (parts.length === 0) {
        // If text doesn't fit, but there's an illustration later in the flow
        // that belongs to this column and MUST be processed, we split the text 
        // entirely to next column and let the illustration be next.
        let hasIllustrationForThisColumn = false;
        const offset = articleParagraphOffsets[current.articleId || ''] || 0;
        for (let j = 1; j < flow.length; j++) {
          const item = flow[j];
          if (item.kind === 'illustration' && typeof item.anchorParagraphIndex === 'number' && item.articleId === current.articleId) {
            const anchor = item.anchorParagraphIndex - offset;
            if (anchor <= 0) { // It belongs BEFORE or AT the start of this text block
              hasIllustrationForThisColumn = true;
              break;
            }
          }
        }

        if (hasIllustrationForThisColumn) {
          // Push ALL of this text block to after the illustration
          const text = flow.shift()!;
          flow.splice(1, 0, text); // Insert after the illustration (which is now at flow[0])
          continue;
        }
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

      if (current.articleId) {
        articleParagraphOffsets[current.articleId] = (articleParagraphOffsets[current.articleId] || 0) + parseHtmlParagraphs(parts[0]).length;
      }

      used = getColumnUsedSpace(column, allIllustrations);

      if (remainingHtml) {
        current.html = remainingHtml;
        break;
      }

      flow.shift();
    }

    if (flow.length === 0) {
      const illustrationCount = column.filter(c => c.isFilled && c.kind === 'illustration').length;
      const effectiveMaxLines = Math.max(
        1,
        baseMaxLines - (illustrationCount * 3)
      );
      const remainingLines = Math.max(0, effectiveMaxLines - used.lines);
      ensureEmptyContainerAtEnd(column, colIdx, remainingLines);
    }
  }
}
