import { ColumnContainer } from '../../../../types/PageTemplate';
import { FlowItem } from '../types';

export function collectTailFromColumns(
  columns: ColumnContainer[][],
  templateColumnsCount: number,
  startColIndex: number,
  startContainerIndex: number,
  into: FlowItem[],
  inferArticleIdFromHtml: (html: string) => string | undefined,
  skipArticleId?: string
): void {
  const pushMergedExisting = (item: FlowItem) => {
    const last = into.length > 0 ? into[into.length - 1] : undefined;
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

  const removedSpan2MainIllustrationIds = new Set<string>();

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
        const span = cont.span || 1;
        const spanRole = cont.spanRole || 'main';
        if (span === 2 && spanRole === 'main') {
          removedSpan2MainIllustrationIds.add(cont.illustrationId);
        }

        if (span === 2 && spanRole === 'ghost' && removedSpan2MainIllustrationIds.has(cont.illustrationId)) return;

        pushMergedExisting({
          kind: 'illustration',
          illustrationId: cont.illustrationId,
          span,
          spanRole: span === 2 ? spanRole : 'main',
          heightPx: cont.height && cont.height > 0 ? cont.height : 120,
          source: 'existing',
        });
      }
    });
  }
}
