import { CHARS_PER_COLUMN, LINES_PER_COLUMN, getTextLines } from './contentMetrics';

// Разбить контент по параграфам
export const splitByParagraphs = (html: string): string[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const paragraphs = doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
  
  if (paragraphs.length === 0) {
    return [html];
  }

  const result: string[] = [];
  paragraphs.forEach(p => {
    result.push(p.outerHTML);
  });

  return result;
};

// Разбить контент по строкам (для очень длинных параграфов)
export const splitByLines = (html: string, maxLines: number): string[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const text = doc.body.textContent || '';
  const words = text.split(/\s+/);
  
  const result: string[] = [];
  let currentLine = '';
  let currentLines = 0;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testLines = Math.ceil(testLine.length / 40);
    
    if (testLines > maxLines && currentLine) {
      result.push(`<p>${currentLine}</p>`);
      currentLine = word;
      currentLines = 1;
    } else {
      currentLine = testLine;
      currentLines = testLines;
    }
  }

  if (currentLine) {
    result.push(`<p>${currentLine}</p>`);
  }

  return result.length > 0 ? result : [html];
};

// Разбить контент на блоки (параграфы, заголовки и т.д.)
export const splitBlocks = (html: string): string[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blocks: string[] = [];
  
  // Сохраняем структуру HTML
  Array.from(doc.body.childNodes).forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      blocks.push((node as Element).outerHTML);
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      blocks.push(`<p>${node.textContent.trim()}</p>`);
    }
  });

  return blocks.length > 0 ? blocks : [html];
};

