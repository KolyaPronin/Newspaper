import { useCallback } from 'react';
import { TOTAL_PAGES } from '../../../data/templates';
import { PageTemplate, ColumnContainer } from '../../../types/PageTemplate';
import { Illustration } from '../../../utils/api';
import { FlowItem, PageData } from './types';
import { parseHtmlParagraphs, computeAnchorParagraphIndex } from './paragraphParser';

interface UseLayoutDesignerColumnActionsArgs {
  articles: { id: string; content: string }[];
  allIllustrations: Illustration[];
  currentPage: number;
  getTemplateForPage: (pageNumber: number) => PageTemplate;
  initPageData: (pageNum: number, template: PageTemplate) => PageData;
  buildEmptyColumns: (template: PageTemplate) => any[][];
  inferArticleIdFromHtml: (html: string) => string | undefined;
  reflowFromPosition: (
    prev: Record<number, PageData>,
    startPage: number,
    startColIndex: number,
    startContainerIndex: number,
    prepend: FlowItem[],
    skipArticleId?: string,
    skipIllustrationId?: string
  ) => Record<number, PageData>;
  setPagesData: React.Dispatch<React.SetStateAction<Record<number, PageData>>>;
}

export function useLayoutDesignerColumnActions({
  articles,
  allIllustrations,
  currentPage,
  getTemplateForPage,
  initPageData,
  buildEmptyColumns,
  inferArticleIdFromHtml,
  reflowFromPosition,
  setPagesData,
}: UseLayoutDesignerColumnActionsArgs) {
  const handleDeleteContainer = useCallback((columnIndex: number, containerIndex: number) => {
    setPagesData(prev => {
      const current = prev[currentPage] || {
        columns: [],
        headerContent: currentPage === 1 ? '' : 'Заголовок газеты',
        layoutTitle: currentPage === 1 ? 'Обложка' : `Страница ${currentPage}`,
        layoutId: null,
        layoutIllustrations: [],
        layoutAds: [],
      };

      const col = current.columns[columnIndex];
      const cont = col ? col[containerIndex] : undefined;
      if (!cont || !cont.isFilled || !cont.content) return prev;

      const deleteArticleId = cont.articleId || inferArticleIdFromHtml(cont.content);
      if (!deleteArticleId) {
        const template = getTemplateForPage(currentPage);
        const basePageData = prev[currentPage] || initPageData(currentPage, template);
        const columns = (basePageData.columns && basePageData.columns.length > 0 ? basePageData.columns : buildEmptyColumns(template))
          .map(col2 => col2.map(c => ({ ...c })));
        if (columns[columnIndex] && columns[columnIndex][containerIndex]) {
          columns[columnIndex][containerIndex] = {
            ...columns[columnIndex][containerIndex],
            content: '',
            isFilled: false,
            articleId: undefined,
          };
        }
        return { ...prev, [currentPage]: { ...basePageData, columns } };
      }

      // Check if the column containing the deleted text has float illustrations.
      // If so, we must NOT use packFlow (it repositions illustrations).
      // Instead, just clear the text container and leave illustrations in place.
      const template = getTemplateForPage(currentPage);
      const basePageData = prev[currentPage] || initPageData(currentPage, template);
      const colData = basePageData.columns[columnIndex] || [];
      const colHasFloatIllustration = colData.some(
        c => c.isFilled && c.kind === 'illustration' && c.float
      );

      if (colHasFloatIllustration) {
        // Simple delete: clear the container, leave illustrations untouched
        const columns = (basePageData.columns && basePageData.columns.length > 0 ? basePageData.columns : buildEmptyColumns(template))
          .map(col2 => col2.map(c => ({ ...c })));
        // Remove all containers with this articleId from this column
        const targetCol = columns[columnIndex];
        for (let i = targetCol.length - 1; i >= 0; i--) {
          const c = targetCol[i];
          if (!c.isFilled || !c.content) continue;
          const resolved = c.articleId || inferArticleIdFromHtml(c.content);
          if (resolved === deleteArticleId) {
            targetCol[i] = { ...c, content: '', isFilled: false, articleId: undefined };
          }
        }
        return { ...prev, [currentPage]: { ...basePageData, columns } };
      }

      let startPage = -1;
      let startCol = -1;
      let startContainer = -1;

      for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
        const tmpl = getTemplateForPage(pageNum);
        const pageData = prev[pageNum] || initPageData(pageNum, tmpl);
        const cols = pageData.columns || [];
        for (let c = 0; c < tmpl.columns; c++) {
          const column = cols[c] || [];
          for (let i = 0; i < column.length; i++) {
            const candidate = column[i];
            if (!candidate.isFilled || !candidate.content) continue;
            const resolved = candidate.articleId || inferArticleIdFromHtml(candidate.content);
            if (resolved === deleteArticleId) {
              startPage = pageNum;
              startCol = c;
              startContainer = i;
              break;
            }
          }
          if (startPage !== -1) break;
        }
        if (startPage !== -1) break;
      }

      if (startPage === -1) return prev;

      return reflowFromPosition(prev, startPage, startCol, startContainer, [], deleteArticleId);
    });
  }, [buildEmptyColumns, currentPage, getTemplateForPage, inferArticleIdFromHtml, initPageData, reflowFromPosition, setPagesData]);

  const handleDropArticle = useCallback((articleId: string, columnIndex: number, containerIndex: number) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    setPagesData(prev => {
      const template = getTemplateForPage(currentPage);
      const basePageData = prev[currentPage] || initPageData(currentPage, template);
      const columns = (basePageData.columns && basePageData.columns.length > 0 ? basePageData.columns : buildEmptyColumns(template))
        .map(col => col.map(cont => ({ ...cont })));

      const targetCol = columns[columnIndex] || [];

      // ── Special case: column has flex-positioned illustration (empty(h>0) + ILL + empty(h>0)) ──
      // Rebuild the column as if the illustration was dropped into the text at the same ratio.
      // This gives the same result as "text first, then illustration" scenario.
      const hasFlexIllustration = targetCol.some(
        (c, i) => c.isFilled && c.kind === 'illustration' &&
          ((i > 0 && !targetCol[i-1].isFilled && targetCol[i-1].height > 0) ||
           (i < targetCol.length - 1 && !targetCol[i+1].isFilled && targetCol[i+1].height > 0))
      );

      if (hasFlexIllustration) {
        // Find the illustration and its flex ratio
        const illIdx = targetCol.findIndex(c => c.isFilled && c.kind === 'illustration');
        if (illIdx !== -1) {
          const ill = targetCol[illIdx];
          const beforeSpacerIdx = illIdx > 0 && !targetCol[illIdx - 1].isFilled ? illIdx - 1 : -1;
          const beforeH = beforeSpacerIdx !== -1 ? targetCol[beforeSpacerIdx].height : 0;
          const afterSpacerIdx = illIdx < targetCol.length - 1 && !targetCol[illIdx + 1].isFilled ? illIdx + 1 : -1;
          const afterH = afterSpacerIdx !== -1 ? targetCol[afterSpacerIdx].height : 0;
          const total = beforeH + afterH;
          const ratio = total > 0 ? beforeH / total : 0.5;

          // Compute which paragraph the illustration should anchor to
          const paragraphs = parseHtmlParagraphs(article.content);
          const anchorIdx = computeAnchorParagraphIndex(paragraphs.length, ratio);

          // Build new column: [text_before_anchor, ILL(float:left), text_from_anchor, empty]
          // The illustration is inserted between paragraphs at the anchor point.
          // CSS float:left makes text wrap around it naturally.
          const makeEmpty = (): ColumnContainer => ({
            id: `col_${columnIndex}_empty_${Date.now()}_${Math.random()}`,
            columnIndex,
            content: '',
            height: 0,
            isFilled: false,
          });

          const beforeParagraphs = paragraphs.slice(0, anchorIdx);
          const afterParagraphs = paragraphs.slice(anchorIdx);
          const beforeHtml = beforeParagraphs.join('');
          const afterHtml = afterParagraphs.join('');

          const newContainers: ColumnContainer[] = [];

          if (beforeHtml.trim()) {
            newContainers.push({
              id: `col_${columnIndex}_text_${Date.now()}_a`,
              columnIndex,
              content: beforeHtml,
              height: 0,
              isFilled: true,
              kind: 'text',
              articleId: article.id,
            });
          }

          // Illustration with float so text wraps around it
          newContainers.push({
            ...ill,
            id: `col_${columnIndex}_ill_${Date.now()}`,
            float: 'left',
            anchorParagraphIndex: anchorIdx,
            articleId: article.id,
          });

          if (afterHtml.trim()) {
            newContainers.push({
              id: `col_${columnIndex}_text_${Date.now()}_b`,
              columnIndex,
              content: afterHtml,
              height: 0,
              isFilled: true,
              kind: 'text',
              articleId: article.id,
            });
          }

          newContainers.push(makeEmpty());
          columns[columnIndex] = newContainers;

          // Reflow starting after the illustration so overflow flows to next column/page
          const illNewIdx = beforeHtml.trim() ? 1 : 0;
          const afterStartIdx = illNewIdx + 1;
          const withIll = { ...prev, [currentPage]: { ...basePageData, columns } };
          return reflowFromPosition(withIll, currentPage, columnIndex, afterStartIdx, [], undefined);
        }
      }

      // ── Standard case: use reflowFromPosition for proper multi-column/page flow ──
      let targetIdx = Math.min(containerIndex, Math.max(0, targetCol.length - 1));
      // If dropped on a filled container, find nearest empty slot
      if (targetCol[targetIdx]?.isFilled) {
        const before = targetCol.findIndex((c, i) => i < targetIdx && !c.isFilled);
        if (before !== -1) {
          targetIdx = before;
        } else {
          const next = targetCol.findIndex((c, i) => i > targetIdx && !c.isFilled);
          if (next !== -1) targetIdx = next;
        }
      }

      const next2 = { ...prev, [currentPage]: { ...basePageData, columns } };
      return reflowFromPosition(
        next2, currentPage, columnIndex, targetIdx,
        [{ kind: 'text', articleId: article.id, html: article.content, source: 'new' }],
        article.id
      );
    });
  }, [articles, buildEmptyColumns, currentPage, getTemplateForPage, initPageData, reflowFromPosition, setPagesData]);

  const handleDropInlineIllustration = useCallback((
    illustrationId: string,
    columnIndex: number,
    containerIndex: number,
    dropRatio?: number,
    span?: 1 | 2
  ) => {
    const illustration = allIllustrations.find(ill => ill.id === illustrationId);
    if (!illustration) return;

    const INLINE_ILLUSTRATION_HEIGHT_PX = 120;
    const INLINE_ILLUSTRATION_SPAN2_HEIGHT_PX = 200;

    setPagesData(prev => {
      const template = getTemplateForPage(currentPage);
      const resolvedSpan: 1 | 2 = span === 2 && columnIndex < template.columns - 1 ? 2 : 1;
      const resolvedHeightPx = resolvedSpan === 2 ? INLINE_ILLUSTRATION_SPAN2_HEIGHT_PX : INLINE_ILLUSTRATION_HEIGHT_PX;
      const basePageData = prev[currentPage] || initPageData(currentPage, template);
      const columns = (basePageData.columns && basePageData.columns.length > 0 ? basePageData.columns : buildEmptyColumns(template))
        .map(col => col.map(cont => ({ ...cont })));

      const startColumn = columns[columnIndex] || [];

      const makeIllContainer = (colIdx: number): ColumnContainer => ({
        id: `col_${colIdx}_illus_${Date.now()}_${Math.random()}`,
        columnIndex: colIdx,
        content: '',
        height: resolvedHeightPx,
        isFilled: true,
        kind: 'illustration',
        illustrationId: illustration.id,
        span: resolvedSpan,
        spanRole: 'main',
      });

      const makeEmpty = (colIdx: number): ColumnContainer => ({
        id: `col_${colIdx}_empty_${Date.now()}_${Math.random()}`,
        columnIndex: colIdx,
        content: '',
        height: 0,
        isFilled: false,
      });

      const makeGhost = (colIdx: number): ColumnContainer => ({
        id: `col_${colIdx}_illus_ghost_${Date.now()}_${Math.random()}`,
        columnIndex: colIdx,
        content: '',
        height: resolvedHeightPx,
        isFilled: true,
        kind: 'illustration',
        illustrationId: illustration.id,
        span: 2,
        spanRole: 'ghost',
      });

      // Insert ghost into next column at the same logical position
      const insertGhostInNextColumn = (insertIdx: number) => {
        if (resolvedSpan !== 2 || columnIndex >= template.columns - 1) return;
        const nextCol = columns[columnIndex + 1];
        if (!nextCol) return;
        nextCol.splice(insertIdx, 0, makeGhost(columnIndex + 1));
        // ensure empty at end
        if (!nextCol[nextCol.length - 1] || nextCol[nextCol.length - 1].isFilled) {
          nextCol.push(makeEmpty(columnIndex + 1));
        }
      };

      // ── Case 1: drop on a text container with ratio → split text at drop point, insert illustration between ──
      const targetContainer = startColumn[containerIndex];
      if (
        typeof dropRatio === 'number' &&
        targetContainer &&
        targetContainer.isFilled &&
        (targetContainer.kind || 'text') === 'text' &&
        targetContainer.content
      ) {
        const paragraphs = parseHtmlParagraphs(targetContainer.content);
        const anchorParagraphIndex = computeAnchorParagraphIndex(paragraphs.length, dropRatio);

        // Split text at the anchor paragraph: before gets paragraphs[0..anchor-1],
        // after gets paragraphs[anchor..end]. The illustration sits between them.
        const beforeParagraphs = paragraphs.slice(0, anchorParagraphIndex);
        const afterParagraphs = paragraphs.slice(anchorParagraphIndex);
        const beforeHtml = beforeParagraphs.join('');
        const afterHtml = afterParagraphs.join('');

        const illContainer: ColumnContainer = {
          ...makeIllContainer(columnIndex),
          float: 'left',
          anchorParagraphIndex,
          articleId: targetContainer.articleId,
        };

        const newContainers: ColumnContainer[] = [];
        if (beforeHtml.trim()) {
          newContainers.push({
            ...targetContainer,
            id: `col_${columnIndex}_text_${Date.now()}_a`,
            content: beforeHtml,
          });
        }
        newContainers.push(illContainer);
        if (afterHtml.trim()) {
          newContainers.push({
            ...targetContainer,
            id: `col_${columnIndex}_text_${Date.now()}_b`,
            content: afterHtml,
          });
        }
        if (!newContainers[newContainers.length - 1] || newContainers[newContainers.length - 1].isFilled) {
          newContainers.push(makeEmpty(columnIndex));
        }

        const illInsertedIdx = containerIndex + (beforeHtml.trim() ? 1 : 0);
        startColumn.splice(containerIndex, 1, ...newContainers);
        insertGhostInNextColumn(illInsertedIdx);

        // Reflow starting AFTER the illustration so overflow flows to next column/page
        const afterStartIdx = illInsertedIdx + 1;
        const withIll = { ...prev, [currentPage]: { ...basePageData, columns } };
        return reflowFromPosition(withIll, currentPage, columnIndex, afterStartIdx, [], undefined, illustrationId);
      }

      // ── Case 2: drop on empty container → place illustration with flex spacers for Y positioning ──
      if (
        typeof dropRatio === 'number' &&
        targetContainer &&
        !targetContainer.isFilled
      ) {
        const FLEX_TOTAL = 100;
        const beforeFlex = Math.round(dropRatio * FLEX_TOTAL);
        const afterFlex = FLEX_TOTAL - beforeFlex;

        const illContainer: ColumnContainer = {
          ...makeIllContainer(columnIndex),
          float: 'left',
          anchorParagraphIndex: null,
          articleId: undefined,
        };

        const emptyBefore: ColumnContainer = { ...makeEmpty(columnIndex), height: beforeFlex };
        const emptyAfter: ColumnContainer = { ...makeEmpty(columnIndex), height: afterFlex };

        let newColumn: ColumnContainer[];
        if (dropRatio < 0.05) {
          newColumn = [illContainer, { ...makeEmpty(columnIndex), height: FLEX_TOTAL }];
        } else if (dropRatio > 0.95) {
          newColumn = [{ ...makeEmpty(columnIndex), height: FLEX_TOTAL }, illContainer, makeEmpty(columnIndex)];
        } else {
          newColumn = [emptyBefore, illContainer, emptyAfter];
        }

        startColumn.splice(containerIndex, 1, ...newColumn);
        insertGhostInNextColumn(containerIndex + (dropRatio < 0.05 ? 0 : 1));
        return { ...prev, [currentPage]: { ...basePageData, columns } };
      }

      // ── Case 3: drop on zone or illustration container → insert at boundary ──
      let insertIdx = Math.min(containerIndex, startColumn.length);
      // If last slot is empty, insert before it
      if (insertIdx === startColumn.length && insertIdx > 0 && !startColumn[insertIdx - 1].isFilled) {
        insertIdx -= 1;
      }

      startColumn.splice(insertIdx, 0, makeIllContainer(columnIndex));
      // ensure empty at end
      if (!startColumn[startColumn.length - 1] || startColumn[startColumn.length - 1].isFilled) {
        startColumn.push(makeEmpty(columnIndex));
      }
      insertGhostInNextColumn(insertIdx);

      return { ...prev, [currentPage]: { ...basePageData, columns } };
    });
  }, [allIllustrations, buildEmptyColumns, currentPage, getTemplateForPage, inferArticleIdFromHtml, initPageData, reflowFromPosition, setPagesData]);

  const handleToggleIllustrationFloat = useCallback((columnIndex: number, containerIndex: number) => {
    setPagesData(prev => {
      const template = getTemplateForPage(currentPage);
      const basePageData = prev[currentPage] || initPageData(currentPage, template);
      const columns = (basePageData.columns && basePageData.columns.length > 0 ? basePageData.columns : buildEmptyColumns(template))
        .map(col => col.map(cont => ({ ...cont })));

      const col = columns[columnIndex] || [];
      const target = col[containerIndex];
      if (!target || !target.isFilled || target.kind !== 'illustration') return prev;

      col[containerIndex] = {
        ...target,
        float: target.float === 'left' ? 'right' : 'left',
      };

      return { ...prev, [currentPage]: { ...basePageData, columns } };
    });
  }, [buildEmptyColumns, currentPage, getTemplateForPage, initPageData, setPagesData]);

  const handleDeleteInlineIllustration = useCallback((columnIndex: number, containerIndex: number) => {
    setPagesData(prev => {
      const template = getTemplateForPage(currentPage);
      const basePageData = prev[currentPage] || initPageData(currentPage, template);
      const columns = (basePageData.columns && basePageData.columns.length > 0 ? basePageData.columns : buildEmptyColumns(template))
        .map(col => col.map(cont => ({ ...cont })));

      const col = columns[columnIndex] || [];
      const target = col[containerIndex];
      if (!target || !target.isFilled || target.kind !== 'illustration') return prev;

      const illustrationId = target.illustrationId;
      const span = target.span || 1;
      const spanRole = target.spanRole || 'main';

      col.splice(containerIndex, 1);

      if (span === 2 && illustrationId) {
        if (spanRole === 'main') {
          const nextCol = columns[columnIndex + 1] || [];
          const ghostIdx = nextCol.findIndex(c => c.isFilled && c.kind === 'illustration' && c.illustrationId === illustrationId && c.span === 2 && c.spanRole === 'ghost');
          if (ghostIdx !== -1) nextCol.splice(ghostIdx, 1);
        } else {
          const prevCol = columns[columnIndex - 1] || [];
          const mainIdx = prevCol.findIndex(c => c.isFilled && c.kind === 'illustration' && c.illustrationId === illustrationId && c.span === 2 && (c.spanRole || 'main') === 'main');
          if (mainIdx !== -1) prevCol.splice(mainIdx, 1);
        }
      }

      const reflowStartIndex = Math.max(0, containerIndex - 1);

      const next = { ...prev, [currentPage]: { ...basePageData, columns } };
      return reflowFromPosition(next, currentPage, columnIndex, reflowStartIndex, [], undefined);
    });
  }, [buildEmptyColumns, currentPage, getTemplateForPage, initPageData, reflowFromPosition, setPagesData]);

  return {
    handleDeleteContainer,
    handleDropArticle,
    handleDropInlineIllustration,
    handleDeleteInlineIllustration,
  };
}
