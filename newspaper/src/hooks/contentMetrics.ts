// Константы для измерения контента
// Примерно 1060 символов на колонку (как указал пользователь)
export const CHARS_PER_COLUMN = 1150;
export const LINES_PER_COLUMN = 50;

// Получить длину текста (без HTML тегов)
export const getTextLength = (html: string): number => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body.textContent?.length || 0;
};

// Получить количество строк текста (приблизительно)
export const getTextLines = (html: string): number => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const text = doc.body.textContent || '';
  // Примерно 40 символов на строку
  return Math.ceil(text.length / 40);
};

