import { CHARS_PER_COLUMN, CHARS_PER_LINE, LINES_PER_COLUMN, getTextLength, getTextLines } from './contentMetrics';
import { splitBlocks } from './contentSplitHelpers';

 const splitTextAtWordBoundary = (text: string, maxChars: number): { first: string; rest: string } => {
  if (maxChars <= 0) return { first: '', rest: text };
  if (text.length <= maxChars) return { first: text, rest: '' };
  const slice = text.substring(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace === -1) {
    return {
      first: text.substring(0, maxChars).trimEnd(),
      rest: text.substring(maxChars).trimStart(),
    };
  }
  const cut = lastSpace > Math.floor(maxChars * 0.6) ? lastSpace : maxChars;
  return {
    first: text.substring(0, cut).trimEnd(),
    rest: text.substring(cut).trimStart(),
  };
};

// Экспортируем константы и функции
export { CHARS_PER_COLUMN, LINES_PER_COLUMN, getTextLength, getTextLines } from './contentMetrics';

// Проверить, есть ли место в контейнере
export const hasSpaceInContainer = (
  content: string,
  maxChars: number = CHARS_PER_COLUMN,
  maxLines: number = LINES_PER_COLUMN
): boolean => {
  const length = getTextLength(content);
  const lines = getTextLines(content);
  return length < maxChars && lines < maxLines;
};

// Разбить контент на части, которые помещаются в контейнер
export const splitContentToFitContainer = (
  html: string,
  maxChars: number = CHARS_PER_COLUMN,
  maxLines: number = LINES_PER_COLUMN
): string[] => {
  const parts: string[] = [];
  const blocks = splitBlocks(html);

  if (blocks.length === 0) {
    return [html];
  }

  const effectiveMaxChars = Math.min(maxChars, maxLines * CHARS_PER_LINE);

  let currentPart = '';
  let currentLength = 0;
  let currentLines = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockLength = getTextLength(block);
    const blockLines = getTextLines(block);

    // Если один блок слишком длинный, разбиваем его на части
    if (blockLength > effectiveMaxChars) {
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

      // Разбиваем текст на части по effectiveMaxChars
      for (let charIndex = 0; charIndex < text.length; charIndex += effectiveMaxChars) {
        const partText = text.substring(charIndex, charIndex + effectiveMaxChars);
        const partHTML = `<${tagName}>${partText}</${tagName}>`;
        parts.push(partHTML);
      }
      continue;
    }

    // Проверяем, поместится ли блок в текущую часть
    if (currentLength + blockLength <= effectiveMaxChars && 
        currentLines + blockLines <= maxLines) {
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
        const truncated = text.substring(0, Math.max(0, effectiveMaxChars));
        parts.push(`<${tagName}>${truncated}</${tagName}>`);
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
  usedLines: number = 0,
  maxChars: number = CHARS_PER_COLUMN,
  maxLines: number = LINES_PER_COLUMN
): { parts: string[]; remainingHtml: string; fillsContainer: boolean } => {
  const MIN_SPLIT_CHARS = 4;
  const availableCharsRaw = maxChars - usedChars;
  const availableLines = maxLines - usedLines;
  const availableChars = Math.min(availableCharsRaw, availableLines * CHARS_PER_LINE);

  // Если нет доступного места, возвращаем пустой массив
  if (availableChars <= 0 || availableLines <= 0) {
    return { parts: [], remainingHtml: html, fillsContainer: true };
  }

  const blocks = splitBlocks(html);

  let fittingPart = '';
  let fittingLength = 0;
  let fittingLines = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockLength = getTextLength(block);
    const blockLines = getTextLines(block);

    if (fittingLength + blockLength <= availableChars && fittingLines + blockLines <= availableLines) {
      fittingPart += block;
      fittingLength += blockLength;
      fittingLines += blockLines;
      continue;
    }

    // Блок не помещается
    if (fittingPart) {
      const remainingChars = Math.max(0, availableChars - fittingLength);
      const remainingLines = Math.max(0, availableLines - fittingLines);
      const allowedChars = Math.min(remainingChars, remainingLines * CHARS_PER_LINE);

      if (allowedChars > 0) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(block, 'text/html');
        const text = doc.body.textContent || '';
        const tagName = doc.body.firstElementChild?.tagName.toLowerCase() || 'p';
        const { first, rest } = splitTextAtWordBoundary(text, allowedChars);

        if (first.length > 0 && first.length < MIN_SPLIT_CHARS) {
          const remainingHtml = blocks.slice(i).join('');
          return { parts: [fittingPart], remainingHtml, fillsContainer: true };
        }

        const firstHtml = first ? `<${tagName}>${first}</${tagName}>` : '';
        const restHtml = rest ? `<${tagName}>${rest}</${tagName}>` : '';
        const combined = fittingPart + firstHtml;
        const remainingHtml = restHtml + blocks.slice(i + 1).join('');

        return { parts: combined ? [combined] : [], remainingHtml, fillsContainer: true };
      }

      const remainingHtml = blocks.slice(i).join('');
      const fills = (fittingLength >= availableChars * 0.95) || (fittingLines >= availableLines * 0.95);
      return { parts: [fittingPart], remainingHtml, fillsContainer: fills };
    }

    // Даже один блок не помещается.
    // Если места слишком мало — переносим блок целиком (иначе получаются переносы типа "1 буква").
    if (availableChars < MIN_SPLIT_CHARS) {
      const remainingHtml = blocks.slice(i).join('');
      return { parts: [], remainingHtml, fillsContainer: true };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(block, 'text/html');
    const text = doc.body.textContent || '';
    const tagName = doc.body.firstElementChild?.tagName.toLowerCase() || 'p';
    const { first, rest } = splitTextAtWordBoundary(text, availableChars);

    if (!first || first.length < MIN_SPLIT_CHARS) {
      const remainingHtml = blocks.slice(i).join('');
      return { parts: [], remainingHtml, fillsContainer: true };
    }

    const firstHtml = `<${tagName}>${first}</${tagName}>`;
    const restHtml = rest ? `<${tagName}>${rest}</${tagName}>` : '';
    const remainingHtml = restHtml + blocks.slice(i + 1).join('');
    return { parts: [firstHtml], remainingHtml, fillsContainer: true };
  }

  // Весь контент поместился
  const fills = (fittingLength >= availableChars * 0.95) || (fittingLines >= availableLines * 0.95);
  return { parts: fittingPart ? [fittingPart] : [], remainingHtml: '', fillsContainer: fills };
};
