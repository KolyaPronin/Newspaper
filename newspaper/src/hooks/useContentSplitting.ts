import { CHARS_PER_COLUMN, LINES_PER_COLUMN, getTextLength, getTextLines } from './contentMetrics';
import { splitByParagraphs, splitByLines, splitBlocks } from './contentSplitHelpers';

// Экспортируем константы и функции
export { CHARS_PER_COLUMN, LINES_PER_COLUMN, getTextLength, getTextLines } from './contentMetrics';

// Проверить, есть ли место в контейнере
export const hasSpaceInContainer = (content: string): boolean => {
  const length = getTextLength(content);
  const lines = getTextLines(content);
  return length < CHARS_PER_COLUMN && lines < LINES_PER_COLUMN;
};

// Разбить контент на части, которые помещаются в контейнер
export const splitContentToFitContainer = (html: string): string[] => {
  const parts: string[] = [];
  const blocks = splitBlocks(html);
  
  if (blocks.length === 0) {
    return [html];
  }

  let currentPart = '';
  let currentLength = 0;
  let currentLines = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockLength = getTextLength(block);
    const blockLines = getTextLines(block);
    
    // Если один блок слишком длинный, разбиваем его на части
    if (blockLength > CHARS_PER_COLUMN) {
      // Сохраняем текущую часть, если она есть
      if (currentPart) {
        parts.push(currentPart);
        currentPart = '';
        currentLength = 0;
        currentLines = 0;
      }
      
      // Разбиваем длинный блок на части
      const parser = new DOMParser();
      const doc = parser.parseFromString(block, 'text/html');
      const text = doc.body.textContent || '';
      const tagName = doc.body.firstElementChild?.tagName.toLowerCase() || 'p';
      
      // Разбиваем текст на части по CHARS_PER_COLUMN
      for (let charIndex = 0; charIndex < text.length; charIndex += CHARS_PER_COLUMN) {
        const partText = text.substring(charIndex, charIndex + CHARS_PER_COLUMN);
        const partHTML = `<${tagName}>${partText}</${tagName}>`;
        parts.push(partHTML);
      }
      continue;
    }
    
    // Проверяем, поместится ли блок в текущую часть
    if (currentLength + blockLength <= CHARS_PER_COLUMN && 
        currentLines + blockLines <= LINES_PER_COLUMN) {
      // Блок помещается, добавляем к текущей части
      currentPart += block;
      currentLength += blockLength;
      currentLines += blockLines;
    } else {
      // Блок не помещается
      if (currentPart) {
        // Сохраняем текущую часть и начинаем новую
        parts.push(currentPart);
        currentPart = block;
        currentLength = blockLength;
        currentLines = blockLines;
      } else {
        // Даже один блок не помещается, обрезаем его
        const parser = new DOMParser();
        const doc = parser.parseFromString(block, 'text/html');
        const text = doc.body.textContent || '';
        const tagName = doc.body.firstElementChild?.tagName.toLowerCase() || 'p';
        const maxChars = CHARS_PER_COLUMN;
        const truncated = text.substring(0, maxChars);
        parts.push(`<${tagName}>${truncated}...</${tagName}>`);
        currentPart = '';
        currentLength = 0;
        currentLines = 0;
      }
    }
  }

  // Добавляем последнюю часть, если она есть
  if (currentPart) {
    parts.push(currentPart);
  }

  return parts.length > 0 ? parts : [html];
};

// Разбить контент на части с учетом уже занятого места в контейнере
export const splitContentToFitWithRemaining = (
  html: string,
  usedChars: number = 0,
  usedLines: number = 0
): { parts: string[]; fillsContainer: boolean } => {
  const availableChars = CHARS_PER_COLUMN - usedChars;
  const availableLines = LINES_PER_COLUMN - usedLines;
  
  // Если нет доступного места, возвращаем пустой массив
  if (availableChars <= 0 || availableLines <= 0) {
    return { parts: [], fillsContainer: true };
  }

  const parts: string[] = [];
  let remaining = html;
  let currentPart = '';
  let currentLength = 0;
  let currentLines = 0;

  const blocks = splitBlocks(remaining);

  for (const block of blocks) {
    const blockLength = getTextLength(block);
    const blockLines = getTextLines(block);

    // Проверяем, поместится ли блок в доступное место
    if (currentLength + blockLength <= availableChars && 
        currentLines + blockLines <= availableLines) {
      currentPart += block;
      currentLength += blockLength;
      currentLines += blockLines;
    } else {
      // Блок не помещается
      if (currentPart) {
        parts.push(currentPart);
        // Проверяем, заполнил ли контейнер полностью
        const fills = (currentLength >= availableChars * 0.95) || (currentLines >= availableLines * 0.95);
        return { parts, fillsContainer: fills };
      } else {
        // Даже один блок не помещается - обрезаем его
        const parser = new DOMParser();
        const doc = parser.parseFromString(block, 'text/html');
        const text = doc.body.textContent || '';
        const truncated = text.substring(0, Math.max(0, availableChars - 10));
        if (truncated) {
          parts.push(`<p>${truncated}...</p>`);
        }
        return { parts, fillsContainer: true };
      }
    }
  }

  // Весь контент поместился
  if (currentPart) {
    parts.push(currentPart);
    // Проверяем, заполнил ли контейнер полностью
    const fills = (currentLength >= availableChars * 0.95) || (currentLines >= availableLines * 0.95);
    return { parts, fillsContainer: fills };
  }

  return { parts: [html], fillsContainer: false };
};

