import { TOTAL_PAGES } from '../../../../data/templates';
import { PageTemplate } from '../../../../types/PageTemplate';
import { Illustration } from '../../../../utils/api';
import { buildEmptyColumns, initPageData } from '../columns';
import { FlowItem, PageData } from '../types';
import { collectTailFromColumns } from './collectTail';
import { packFlowIntoPageColumns } from './packFlow';

export function reflowFromPosition(
  prev: Record<number, PageData>,
  startPage: number,
  startColIndex: number,
  startContainerIndex: number,
  prepend: FlowItem[],
  inferArticleIdFromHtml: (html: string) => string | undefined,
  getTemplateForPage: (pageNumber: number) => PageTemplate,
  allIllustrations: Illustration[],
  skipArticleId?: string
): Record<number, PageData> {
  const updated = { ...prev };
  const flow: FlowItem[] = [];

  for (let pageNum = startPage; pageNum <= TOTAL_PAGES; pageNum++) {
    const template = getTemplateForPage(pageNum);
    const basePageData = updated[pageNum] || initPageData(pageNum, template);
    const pageColumns = (basePageData.columns && basePageData.columns.length > 0 ? basePageData.columns : buildEmptyColumns(template))
      .map(col => col.map(cont => ({ ...cont })));

    if (pageNum === startPage) {
      collectTailFromColumns(pageColumns, template.columns, startColIndex, startContainerIndex, flow, inferArticleIdFromHtml, skipArticleId);
    } else {
      collectTailFromColumns(pageColumns, template.columns, 0, 0, flow, inferArticleIdFromHtml, skipArticleId);
    }

    updated[pageNum] = { ...basePageData, columns: pageColumns };
  }

  if (prepend.length > 0) {
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

  for (let pageNum = startPage; pageNum <= TOTAL_PAGES; pageNum++) {
    const template = getTemplateForPage(pageNum);
    const basePageData = updated[pageNum] || initPageData(pageNum, template);
    const pageColumns = (basePageData.columns && basePageData.columns.length > 0 ? basePageData.columns : buildEmptyColumns(template));
    packFlowIntoPageColumns(flow, pageColumns, template, pageNum === startPage ? startColIndex : 0, allIllustrations);
    updated[pageNum] = { ...basePageData, columns: pageColumns };
  }

  return updated;
}
