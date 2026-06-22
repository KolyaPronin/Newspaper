import { useMemo } from 'react';
import { TOTAL_PAGES } from '../../../data/templates';
import { PageTemplate } from '../../../types/PageTemplate';
import { PageData } from './types';

export function useGlobalFirstOccurrenceByArticleId(
  getTemplateForPage: (pageNumber: number) => PageTemplate,
  pagesData: Record<number, PageData>
) {
  return useMemo(() => {
    const map = new Map<string, { pageNum: number; colIndex: number; containerIdx: number }>();

    for (let pageNum = 2; pageNum <= TOTAL_PAGES; pageNum++) {
      const template = getTemplateForPage(pageNum);
      const page = pagesData[pageNum];
      const cols = page?.columns || [];

      for (let colIndex = 0; colIndex < template.columns; colIndex++) {
        const column = cols[colIndex] || [];
        for (let containerIdx = 0; containerIdx < column.length; containerIdx++) {
          const c = column[containerIdx];
          if (!c || !c.isFilled || !c.articleId) continue;
          if (!map.has(c.articleId)) {
            map.set(c.articleId, { pageNum, colIndex, containerIdx });
          }
        }
      }
    }

    return map;
  }, [getTemplateForPage, pagesData]);
}
