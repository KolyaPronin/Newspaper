import { PageTemplate, ColumnContainer } from '../../../types/PageTemplate';
import { PageData } from './types';
import { columnHtmlToContainers, EMPTY_COLUMN_HTML } from './columnHtml/columnHtmlModel';

export function buildEmptyColumns(template: PageTemplate): ColumnContainer[][] {
  const initialColumns: ColumnContainer[][] = [];
  for (let i = 0; i < template.columns; i++) {
    initialColumns.push(columnHtmlToContainers(EMPTY_COLUMN_HTML, i));
  }
  return initialColumns;
}

export function initPageData(pageNum: number, template: PageTemplate): PageData {
  return {
    columns: buildEmptyColumns(template),
    headerContent: pageNum === 1 ? '' : (template.headers?.content || 'Заголовок газеты'),
    layoutTitle: pageNum === 1 ? 'Обложка' : `Страница ${pageNum}`,
    layoutId: null,
    layoutIllustrations: [],
    layoutAds: [],
  };
}
