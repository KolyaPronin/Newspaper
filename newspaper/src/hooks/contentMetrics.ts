export const CHARS_PER_COLUMN = 1300;
export const LINES_PER_COLUMN = 50;
export const CHARS_PER_LINE = 50;

export const getTextLength = (html: string): number => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body.textContent?.length || 0;
};

export const getTextLines = (html: string): number => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const text = doc.body.textContent || '';
  return Math.ceil(text.length / CHARS_PER_LINE);
};

