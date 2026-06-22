import { TOTAL_PAGES } from '../../../../data/templates';
import { PageTemplate } from '../../../../types/PageTemplate';
import { Illustration } from '../../../../utils/api';
import { buildEmptyColumns, initPageData } from '../columns';
import { FlowItem, PageData } from '../types';
import { collectTailFromColumns } from './collectTail';
import { packFlowIntoPageColumns } from './packFlow';
import { parseHtmlParagraphs } from '../paragraphParser';

export function reflowFromPosition(
  prev: Record<number, PageData>,
  startPage: number,
  startColIndex: number,
  startContainerIndex: number,
  prepend: FlowItem[],
  inferArticleIdFromHtml: (html: string) => string | undefined,
  getTemplateForPage: (pageNumber: number) => PageTemplate,
  allIllustrations: Illustration[],
  skipArticleId?: string,
  skipIllustrationId?: string
): Record<number, PageData> {
  const updated = { ...prev };
  const flow: FlowItem[] = [];
  const removedSpan2MainIllustrationIds = new Set<string>();

  for (let pageNum = startPage; pageNum <= TOTAL_PAGES; pageNum++) {
    const template = getTemplateForPage(pageNum);
    const basePageData = updated[pageNum] || initPageData(pageNum, template);
    const pageColumns = (basePageData.columns && basePageData.columns.length > 0 ? basePageData.columns : buildEmptyColumns(template))
      .map(col => col.map(cont => ({ ...cont })));

    if (pageNum === startPage) {
      collectTailFromColumns(pageColumns, template.columns, startColIndex, startContainerIndex, flow, inferArticleIdFromHtml, skipArticleId, skipIllustrationId, removedSpan2MainIllustrationIds);
    } else {
      collectTailFromColumns(pageColumns, template.columns, 0, 0, flow, inferArticleIdFromHtml, skipArticleId, skipIllustrationId, removedSpan2MainIllustrationIds);
    }

    updated[pageNum] = { ...basePageData, columns: pageColumns };
  }

  if (prepend.length > 0) {
    // If we prepend new content (e.g. text), we must shift the anchorParagraphIndex 
    // of any existing illustrations that belong to the same article.
    prepend.forEach(newItem => {
      if (newItem.kind === 'text' && newItem.articleId) {
        const parasAdded = parseHtmlParagraphs(newItem.html).length;
        flow.forEach(existingItem => {
          if (
            existingItem.kind === 'illustration' && 
            existingItem.articleId === newItem.articleId && 
            typeof existingItem.anchorParagraphIndex === 'number'
          ) {
            existingItem.anchorParagraphIndex += parasAdded;
          }
        });
      }
    });

    flow.unshift(...prepend);
  }

  for (let i = 0; i < flow.length - 1;) {
    const a = flow[i];
    const b = flow[i + 1];
    if (
      a.kind === 'text' &&
      b.kind === 'text' &&
      a.articleId &&
      b.articleId &&
      a.articleId === b.articleId
    ) {
      a.html += b.html;
      flow.splice(i + 1, 1);
      continue;
    }
    i += 1;
  }

  const articleParagraphOffsets: Record<string, number> = {};
  
  // Initialize offsets from ALL pages before startPage
  for (let pageNum = 1; pageNum < startPage; pageNum++) {
    const pageData = updated[pageNum];
    if (pageData && pageData.columns) {
      pageData.columns.forEach(col => {
        col.forEach(cont => {
          if (cont.isFilled && cont.kind === 'text' && cont.articleId) {
            articleParagraphOffsets[cont.articleId] = (articleParagraphOffsets[cont.articleId] || 0) + parseHtmlParagraphs(cont.content).length;
          }
        });
      });
    }
  }

  for (let pageNum = startPage; pageNum <= TOTAL_PAGES; pageNum++) {
    const template = getTemplateForPage(pageNum);
    const basePageData = updated[pageNum] || initPageData(pageNum, template);
    const pageColumns = (basePageData.columns && basePageData.columns.length > 0 ? basePageData.columns : buildEmptyColumns(template));
    
    packFlowIntoPageColumns(
      flow, 
      pageColumns, 
      template, 
      pageNum === startPage ? startColIndex : 0, 
      allIllustrations,
      articleParagraphOffsets // Pass offsets to be updated
    );
    
    updated[pageNum] = { ...basePageData, columns: pageColumns };
  }

  return updated;
}
