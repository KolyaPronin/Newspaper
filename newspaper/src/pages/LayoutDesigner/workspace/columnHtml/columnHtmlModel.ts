import { ColumnContainer } from '../../../../types/PageTemplate';
import { Illustration } from '../../../../utils/api';
import { buildFloatedImageHtml } from './insertInColumn';

export const EMPTY_COLUMN_HTML = '<p><br></p>';

/** Placeholder paragraph left in an otherwise empty column. */
export function isEmptyPlaceholderElement(el: HTMLElement): boolean {
  if (el.classList.contains('flow-object') || el.classList.contains('flow-anchor-block')) {
    return false;
  }
  if (el.tagName.toLowerCase() !== 'p') return false;
  const normalized = el.innerHTML.trim().toLowerCase().replace(/\s+/g, '');
  return normalized === '' || normalized === '<br>' || normalized === '<br/>';
}

export function columnHtmlToContainers(html: string, columnIndex: number): ColumnContainer[] {
  const normalized = html.trim() || EMPTY_COLUMN_HTML;
  return [
    {
      id: `col_${columnIndex}_unified`,
      columnIndex,
      content: normalized,
      isFilled: normalized !== EMPTY_COLUMN_HTML,
      height: 0,
      kind: 'text',
    },
  ];
}

export function getColumnHtml(
  columns: ColumnContainer[][],
  columnIndex: number,
  illustrations: Illustration[] = []
): string {
  const col = columns[columnIndex] || [];
  if (col.length === 0) return EMPTY_COLUMN_HTML;
  if (col.length === 1 && col[0].content) {
    return col[0].content;
  }
  return mergeLegacyContainersToHtml(col, illustrations);
}

export function mergeLegacyContainersToHtml(
  containers: ColumnContainer[],
  illustrations: Illustration[]
): string {
  const parts: string[] = [];

  for (const cont of containers) {
    if (!cont.isFilled) continue;

    if (cont.kind === 'illustration' && cont.illustrationId) {
      const ill = illustrations.find(i => i.id === cont.illustrationId);
      if (ill) {
        parts.push(buildFloatedImageHtml(ill.url, ill.caption || ''));
      }
      continue;
    }

    if (cont.content?.trim()) {
      parts.push(cont.content);
    }
  }

  return parts.length > 0 ? parts.join('') : EMPTY_COLUMN_HTML;
}

export function setColumnHtmlInPageColumns(
  columns: ColumnContainer[][],
  columnIndex: number,
  html: string
): ColumnContainer[][] {
  const next = columns.map(col => [...col]);
  while (next.length <= columnIndex) {
    next.push([]);
  }
  next[columnIndex] = columnHtmlToContainers(html, columnIndex);
  return next;
}

/** Собирает единый HTML-поток страницы из колонок (для CSS multi-column). */
export function getPageFlowHtml(
  columns: ColumnContainer[][],
  illustrations: Illustration[] = []
): string {
  const parts: string[] = [];
  for (let i = 0; i < columns.length; i++) {
    const html = getColumnHtml(columns, i, illustrations);
    const trimmed = html.trim();
    if (trimmed && trimmed !== EMPTY_COLUMN_HTML) {
      parts.push(trimmed);
    }
  }
  return parts.length > 0 ? parts.join('') : EMPTY_COLUMN_HTML;
}

/** Сохраняет поток в первую колонку, остальные — пустые слоты API. */
export function setPageFlowHtml(
  columns: ColumnContainer[][],
  columnCount: number,
  html: string
): ColumnContainer[][] {
  const next: ColumnContainer[][] = [];
  const count = Math.max(columnCount, columns.length, 1);
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      next.push(columnHtmlToContainers(html, 0));
    } else {
      next.push(columnHtmlToContainers(EMPTY_COLUMN_HTML, i));
    }
  }
  return next;
}
