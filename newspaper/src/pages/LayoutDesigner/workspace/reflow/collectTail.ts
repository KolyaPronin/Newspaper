import { ColumnContainer } from '../../../../types/PageTemplate';
import { FlowItem } from '../types';
import { parseHtmlParagraphs } from '../paragraphParser';

export function collectTailFromColumns(
  columns: ColumnContainer[][],
  templateColumnsCount: number,
  startColIndex: number,
  startContainerIndex: number,
  into: FlowItem[],
  inferArticleIdFromHtml: (html: string) => string | undefined,
  skipArticleId?: string,
  skipIllustrationId?: string,
  removedSpan2MainIllustrationIds: Set<string> = new Set()
): void {
  const articleParagraphCounts: Record<string, number> = {};
  let lastArticleId: string | undefined = undefined;

  const pushMergedExisting = (item: FlowItem) => {
    const last = into.length > 0 ? into[into.length - 1] : undefined;
    
    if (item.kind === 'text' && item.articleId) {
      const paras = parseHtmlParagraphs(item.html).length;
      articleParagraphCounts[item.articleId] = (articleParagraphCounts[item.articleId] || 0) + paras;
      lastArticleId = item.articleId;
    }

    if (
      last &&
      last.kind === 'text' &&
      item.kind === 'text' &&
      last.source === 'existing' &&
      item.source === 'existing' &&
      last.articleId &&
      item.articleId &&
      last.articleId === item.articleId
    ) {
      last.html += item.html;
      return;
    }
    into.push(item);
  };

  for (let colIdx = startColIndex; colIdx < templateColumnsCount; colIdx++) {
    const column = columns[colIdx];
    if (!column) continue;

    let startIdx = colIdx === startColIndex ? Math.min(startContainerIndex, column.length) : 0;

    if (colIdx > startColIndex && startIdx === 0) {
      const prevColumn = columns[colIdx - 1] || [];
      while (startIdx < column.length) {
        const cont = column[startIdx];
        if (!cont?.isFilled || cont.kind !== 'illustration' || cont.span !== 2 || cont.spanRole !== 'ghost' || !cont.illustrationId) {
          break;
        }

        const hasMainInPrev = prevColumn.some(
          c => c.isFilled && c.kind === 'illustration' && c.illustrationId === cont.illustrationId && c.span === 2 && (c.spanRole || 'main') === 'main'
        );
        if (!hasMainInPrev) break;
        startIdx += 1;
      }
    }

    const removed = column.splice(startIdx);
    removed.forEach(cont => {
      if (cont.isFilled && cont.content) {
        const resolvedArticleId = cont.articleId || inferArticleIdFromHtml(cont.content);
        if (skipArticleId && resolvedArticleId === skipArticleId) return;
        pushMergedExisting({ kind: 'text', articleId: resolvedArticleId, html: cont.content, source: 'existing' });
      } else if (cont.isFilled && cont.kind === 'illustration' && cont.illustrationId) {
        if (skipIllustrationId && cont.illustrationId === skipIllustrationId) return;
        
        const span = cont.span || 1;
        const spanRole = cont.spanRole || 'main';
        if (span === 2 && spanRole === 'main') {
          removedSpan2MainIllustrationIds.add(cont.illustrationId);
        }

        if (span === 2 && spanRole === 'ghost' && removedSpan2MainIllustrationIds.has(cont.illustrationId)) return;

        // If this illustration has an anchor index relative to its container, 
        // we convert it to be relative to the start of the collected flow for this article.
        // We assume it belongs to the lastArticleId seen.
        let absoluteAnchor = cont.anchorParagraphIndex ?? null;
        if (typeof absoluteAnchor === 'number' && lastArticleId) {
          // The paragraphs from previous containers are already in articleParagraphCounts[lastArticleId]
          // But wait, the current container's paragraphs are NOT yet in the count if we are processing them in order.
          // Actually, pushMergedExisting is called BEFORE we reach the next item.
          // So articleParagraphCounts[lastArticleId] contains the total paragraphs of all text containers BEFORE this illustration.
          absoluteAnchor += (articleParagraphCounts[lastArticleId] || 0);
        }

        pushMergedExisting({
          kind: 'illustration',
          illustrationId: cont.illustrationId,
          span,
          spanRole: span === 2 ? spanRole : 'main',
          heightPx: cont.height && cont.height > 0 ? cont.height : 120,
          source: 'existing',
          float: cont.float,
          anchorParagraphIndex: absoluteAnchor,
          articleId: lastArticleId, // Attach articleId to illustration FlowItem
          pinnedColumnIndex: colIdx,
        });
      }
    });
  }
}
