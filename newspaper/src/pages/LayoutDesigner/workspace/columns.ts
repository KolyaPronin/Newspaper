import { PageTemplate, ColumnContainer } from '../../../types/PageTemplate';
import { PageData } from './types';

export function buildEmptyColumns(template: PageTemplate): ColumnContainer[][] {
  const initialColumns: ColumnContainer[][] = [];
  for (let i = 0; i < template.columns; i++) {
    initialColumns.push([
      {
        id: `col_${i}_container_0`,
        columnIndex: i,
        content: '',
        height: 0,
        isFilled: false,
      },
    ]);
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
