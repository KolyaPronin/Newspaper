import { useCallback } from 'react';
import { TOTAL_PAGES } from '../../../data/templates';
import { PageTemplate } from '../../../types/PageTemplate';
import { Illustration } from '../../../utils/api';
import { FlowItem, PageData } from './types';

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
    skipArticleId?: string
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

      let startPage = -1;
      let startCol = -1;
      let startContainer = -1;

      for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
        const template = getTemplateForPage(pageNum);
        const basePageData = prev[pageNum] || initPageData(pageNum, template);
        const cols = basePageData.columns || [];
        for (let c = 0; c < template.columns; c++) {
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

      const startColumn = columns[columnIndex] || [];
      let normalizedInsertIndex = Math.min(containerIndex, startColumn.length);
      if (
        normalizedInsertIndex === startColumn.length &&
        normalizedInsertIndex > 0 &&
        !startColumn[normalizedInsertIndex - 1].isFilled
      ) {
        normalizedInsertIndex -= 1;
      }

      const next = { ...prev, [currentPage]: { ...basePageData, columns } };
      return reflowFromPosition(
        next,
        currentPage,
        columnIndex,
        normalizedInsertIndex,
        [{ kind: 'text', articleId: article.id, html: article.content, source: 'new' }],
        undefined
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
      let normalizedInsertIndex = Math.min(containerIndex, startColumn.length);
      if (
        normalizedInsertIndex === startColumn.length &&
        normalizedInsertIndex > 0 &&
        !startColumn[normalizedInsertIndex - 1].isFilled
      ) {
        normalizedInsertIndex -= 1;
      }

      const splitHtmlByDropRatio = (html: string, ratio: number): { beforeHtml: string; afterHtml: string } => {
        const SNAP_TOP = 0.05;
        const SNAP_BOTTOM = 0.95;
        if (ratio <= SNAP_TOP) {
          return { beforeHtml: '', afterHtml: html || '' };
        }
        if (ratio >= SNAP_BOTTOM) {
          return { beforeHtml: html || '', afterHtml: '' };
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(html || '', 'text/html');
        const nodes = Array.from(doc.body.childNodes);
        const serializeNode = (node: ChildNode): string => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            return (node as Element).outerHTML;
          }
          if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
          }
          return '';
        };
        const blocks = nodes
          .map(serializeNode)
          .map(s => s.trim())
          .filter(Boolean);

        if (blocks.length <= 1) {
          if (ratio < 0.5) {
            return { beforeHtml: '', afterHtml: html || '' };
          }
          return { beforeHtml: html || '', afterHtml: '' };
        }

        const splitPointRaw = Math.round(blocks.length * ratio);
        const splitPoint = Math.max(1, Math.min(blocks.length - 1, splitPointRaw));
        return {
          beforeHtml: blocks.slice(0, splitPoint).join(''),
          afterHtml: blocks.slice(splitPoint).join(''),
        };
      };

      if (
        typeof dropRatio === 'number' &&
        dropRatio >= 0 &&
        dropRatio <= 1 &&
        startColumn[normalizedInsertIndex] &&
        startColumn[normalizedInsertIndex].isFilled &&
        (startColumn[normalizedInsertIndex].kind || 'text') === 'text' &&
        startColumn[normalizedInsertIndex].content
      ) {
        const target = startColumn[normalizedInsertIndex];
        const { beforeHtml, afterHtml } = splitHtmlByDropRatio(target.content, dropRatio);
        const items: FlowItem[] = [];
        if (beforeHtml.trim()) {
          items.push({ kind: 'text', articleId: target.articleId, html: beforeHtml, source: 'existing' });
        }
        items.push({ kind: 'illustration', illustrationId: illustration.id, span: resolvedSpan, spanRole: 'main', heightPx: resolvedHeightPx, source: 'new' });
        if (afterHtml.trim()) {
          items.push({ kind: 'text', articleId: target.articleId, html: afterHtml, source: 'existing' });
        }

        startColumn.splice(normalizedInsertIndex, 1);

        const next = { ...prev, [currentPage]: { ...basePageData, columns } };
        return reflowFromPosition(
          next,
          currentPage,
          columnIndex,
          normalizedInsertIndex,
          items,
          undefined
        );
      }

      const next = { ...prev, [currentPage]: { ...basePageData, columns } };
      return reflowFromPosition(
        next,
        currentPage,
        columnIndex,
        normalizedInsertIndex,
        [{ kind: 'illustration', illustrationId: illustration.id, span: resolvedSpan, spanRole: 'main', heightPx: resolvedHeightPx, source: 'new' }],
        undefined
      );
    });
  }, [allIllustrations, buildEmptyColumns, currentPage, getTemplateForPage, initPageData, reflowFromPosition, setPagesData]);

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
