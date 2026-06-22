/**
 * ParagraphParser — утилита для разбора HTML-контента на абзацы верхнего уровня
 * и вычисления anchorParagraphIndex для float-иллюстраций.
 */

const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'div']);

/**
 * Разбивает HTML-строку на массив outerHTML блочных элементов верхнего уровня.
 * Текстовые узлы без блочного обёртки оборачиваются в <p>.
 * Пустой или пробельный ввод возвращает [].
 */
export function parseHtmlParagraphs(html: string): string[] {
  if (!html || !html.trim()) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  const result: string[] = [];
  let pendingText = '';

  const flushPendingText = () => {
    const trimmed = pendingText.trim();
    if (trimmed) {
      result.push(`<p>${trimmed}</p>`);
    }
    pendingText = '';
  };

  body.childNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toLowerCase();
      if (BLOCK_TAGS.has(tagName)) {
        flushPendingText();
        result.push(el.outerHTML);
      } else {
        // Inline element — treat as text
        pendingText += el.outerHTML;
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      pendingText += text;
    }
  });

  flushPendingText();

  return result;
}

/**
 * Объединяет массив outerHTML обратно в HTML-строку.
 */
export function serializeHtmlParagraphs(paragraphs: string[]): string {
  return paragraphs.join('');
}

/**
 * Вычисляет anchorParagraphIndex из dropRatio и количества абзацев.
 * Возвращает clamp(floor(dropRatio * paragraphCount), 0, paragraphCount - 1).
 */
export function computeAnchorParagraphIndex(paragraphCount: number, dropRatio: number): number {
  if (paragraphCount <= 0) return 0;
  return Math.max(0, Math.min(paragraphCount - 1, Math.floor(dropRatio * paragraphCount)));
}
