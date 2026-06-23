import { isEmptyPlaceholderElement } from './columnHtmlModel';

const FLOW_BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol',
]);

export function insertHtmlAtPoint(
  root: HTMLElement,
  html: string,
  clientX: number,
  clientY: number
): void {
  const fragment = htmlToFragment(html);
  const lastInserted = fragment.lastChild;
  const rootRect = root.getBoundingClientRect();

  if (shouldInsertAtColumnStart(root, clientY, rootRect)) {
    removeEmptyPlaceholders(root);
    root.insertBefore(fragment, root.firstChild);
    placeCaretAfter(lastInserted ?? root.lastChild);
    return;
  }

  const range = getRangeAtPoint(clientX, clientY, root);
  const rangeBlock = range ? getContainingFlowBlock(range.startContainer, root) : null;
  const canUseRange =
    range &&
    isDropPointConsistentWithRange(range, clientX, clientY) &&
    rangeBlock &&
    !isEmptyPlaceholderElement(rangeBlock) &&
    !fragmentHasFlowObjects(fragment);

  if (canUseRange && range) {
    range.deleteContents();
    range.insertNode(fragment);
    placeCaretAfter(lastInserted);
    return;
  }

  insertFragmentAtVerticalPoint(root, fragment, clientY, rootRect);
  placeCaretAfter(lastInserted ?? root.lastChild);
}

export function insertImageAtPoint(
  root: HTMLElement,
  url: string,
  alt: string,
  clientX: number,
  clientY: number
): void {
  const figure = htmlToElement(buildFloatedImageHtml(url, alt));

  const range = getRangeAtPoint(clientX, clientY, root);
  if (range && isDropPointConsistentWithRange(range, clientX, clientY) && isRangeInTextFlow(range, root)) {
    insertFigureInFlowAtRange(root, range, figure);
    return;
  }

  insertFigureAtVerticalPoint(root, figure, clientY);
}

function insertFigureInFlowAtRange(root: HTMLElement, range: Range, figure: HTMLElement): void {
  const block = getContainingFlowBlock(range.startContainer, root);

  if (!block) {
    root.appendChild(figure);
    ensureWrapParagraphAfter(figure);
    placeCaretAtStart(getOrCreateAfterParagraph(figure));
    return;
  }

  const tag = block.tagName.toLowerCase();

  if (tag === 'p') {
    const afterRange = document.createRange();
    afterRange.setStart(range.startContainer, range.startOffset);
    afterRange.setEnd(block, block.childNodes.length);

    const afterP = document.createElement('p');
    const tail = afterRange.extractContents();
    if (hasMeaningfulContent(tail)) {
      afterP.appendChild(tail);
    } else {
      afterP.innerHTML = '<br>';
    }

    block.after(figure);
    figure.after(afterP);

    if (!hasMeaningfulContent(block)) {
      block.remove();
    }

    placeCaretAtStart(afterP);
    return;
  }

  const blockRect = block.getBoundingClientRect();
  const rangeRect = range.getBoundingClientRect();
  const midY = blockRect.top + blockRect.height / 2;

  if (rangeRect.top >= midY) {
    block.after(figure);
  } else {
    block.before(figure);
  }

  ensureWrapParagraphAfter(figure);
  placeCaretAtStart(getOrCreateAfterParagraph(figure));
}

function insertFigureAtVerticalPoint(root: HTMLElement, figure: HTMLElement, clientY: number): void {
  const blocks = getFlowBlocks(root);

  if (blocks.length === 0) {
    root.appendChild(figure);
    ensureWrapParagraphAfter(figure);
    placeCaretAtStart(getOrCreateAfterParagraph(figure));
    return;
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const rect = block.getBoundingClientRect();

    if (clientY >= rect.top && clientY <= rect.bottom) {
      if (clientY >= rect.top + rect.height / 2) {
        block.after(figure);
      } else {
        block.before(figure);
      }
      ensureWrapParagraphAfter(figure);
      placeCaretAtStart(getOrCreateAfterParagraph(figure));
      return;
    }

    const prev = blocks[i - 1];
    const gapStart = prev ? prev.getBoundingClientRect().bottom : -Infinity;
    if (clientY < rect.top && clientY >= gapStart) {
      block.before(figure);
      ensureWrapParagraphAfter(figure);
      placeCaretAtStart(getOrCreateAfterParagraph(figure));
      return;
    }
  }

  const last = blocks[blocks.length - 1];
  last.after(figure);
  ensureWrapParagraphAfter(figure);
  placeCaretAtStart(getOrCreateAfterParagraph(figure));
}

function insertFragmentAtVerticalPoint(
  root: HTMLElement,
  fragment: DocumentFragment,
  clientY: number,
  rootRect?: DOMRect,
): void {
  removeEmptyPlaceholders(root);

  const rect = rootRect ?? root.getBoundingClientRect();
  const relativeY = clientY - rect.top;
  const blocks = getFlowBlocks(root);

  if (blocks.length === 0) {
    root.appendChild(fragment);
    return;
  }

  const firstRect = blocks[0].getBoundingClientRect();
  const firstTop = firstRect.top - rect.top;
  if (relativeY <= firstTop + 4) {
    root.insertBefore(fragment, blocks[0]);
    return;
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockRect = block.getBoundingClientRect();
    const top = blockRect.top - rect.top;
    const bottom = blockRect.bottom - rect.top;

    if (relativeY < top) {
      root.insertBefore(fragment, block);
      return;
    }

    if (relativeY >= top && relativeY <= bottom) {
      if (relativeY < top + blockRect.height / 2) {
        root.insertBefore(fragment, block);
      } else {
        insertFragmentAfter(root, fragment, block);
      }
      return;
    }
  }

  root.appendChild(fragment);
}

function insertFragmentAfter(root: HTMLElement, fragment: DocumentFragment, block: HTMLElement): void {
  const next = block.nextSibling;
  if (next) {
    root.insertBefore(fragment, next);
  } else {
    root.appendChild(fragment);
  }
}

function shouldInsertAtColumnStart(root: HTMLElement, clientY: number, rootRect: DOMRect): boolean {
  if (isColumnEffectivelyEmpty(root)) return true;

  const relativeY = clientY - rootRect.top;
  const blocks = getFlowBlocks(root);
  if (blocks.length === 0) return relativeY <= 12;

  const firstRect = blocks[0].getBoundingClientRect();
  const firstTop = firstRect.top - rootRect.top;
  if (relativeY <= firstTop + 4) return true;
  if (relativeY <= firstTop + firstRect.height * 0.25) return true;

  return false;
}

function isColumnEffectivelyEmpty(root: HTMLElement): boolean {
  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.classList.contains('flow-anchor-block')) continue;
    if (isEmptyPlaceholderElement(child)) continue;
    return false;
  }
  return true;
}

function removeEmptyPlaceholders(root: HTMLElement): void {
  Array.from(root.children).forEach(child => {
    if (child instanceof HTMLElement && isEmptyPlaceholderElement(child)) {
      child.remove();
    }
  });
}

function fragmentHasFlowObjects(fragment: DocumentFragment): boolean {
  for (const node of Array.from(fragment.childNodes)) {
    if (node instanceof HTMLElement && node.classList.contains('flow-object')) {
      return true;
    }
  }
  return false;
}

function ensureWrapParagraphAfter(figure: HTMLElement): void {
  const next = figure.nextElementSibling;
  if (next && next.tagName.toLowerCase() === 'p') return;
  const afterP = document.createElement('p');
  afterP.innerHTML = '<br>';
  figure.after(afterP);
}

function getOrCreateAfterParagraph(figure: HTMLElement): HTMLElement {
  const next = figure.nextElementSibling;
  if (next && next.tagName.toLowerCase() === 'p') {
    return next as HTMLElement;
  }
  const afterP = document.createElement('p');
  afterP.innerHTML = '<br>';
  figure.after(afterP);
  return afterP;
}

function getContainingFlowBlock(node: Node, root: HTMLElement): HTMLElement | null {
  let el: Element | null =
    node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;

  while (el && el !== root) {
    if (el.parentElement === root && isFlowBlockElement(el as HTMLElement)) {
      return el as HTMLElement;
    }
    el = el.parentElement;
  }
  return null;
}

function isFlowBlockElement(el: HTMLElement): boolean {
  if (el.classList.contains('column-inline-figure')) return false;
  const tag = el.tagName.toLowerCase();
  return FLOW_BLOCK_TAGS.has(tag);
}

function isRangeInTextFlow(range: Range, root: HTMLElement): boolean {
  if (isInsideFigure(range.startContainer)) return false;
  return getContainingFlowBlock(range.startContainer, root) !== null;
}

function isDropPointConsistentWithRange(range: Range, clientX: number, clientY: number): boolean {
  const rects = range.getClientRects();
  const rect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return Math.abs(rect.left - clientX) < 80 && Math.abs(rect.top - clientY) < 40;
  }
  const padding = 8;
  return (
    clientX >= rect.left - padding &&
    clientX <= rect.right + padding &&
    clientY >= rect.top - padding &&
    clientY <= rect.bottom + padding
  );
}

function hasMeaningfulContent(node: Node | DocumentFragment): boolean {
  const probe = document.createElement('div');
  probe.appendChild(node.cloneNode(true));
  return (probe.textContent || '').replace(/\u00a0/g, ' ').trim().length > 0;
}

function getFlowBlocks(root: HTMLElement): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  root.childNodes.forEach(node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.classList.contains('flow-object') || isFlowBlockElement(el)) {
      blocks.push(el);
    }
  });
  return blocks;
}

function getRangeAtPoint(clientX: number, clientY: number, root: HTMLElement): Range | null {
  let range: Range | null = null;

  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(clientX, clientY);
  } else {
    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    const pos = doc.caretPositionFromPoint?.(clientX, clientY);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }

  if (!range) return null;
  if (!root.contains(range.startContainer)) return null;
  if (isInsideFigure(range.startContainer)) return null;
  return range;
}

function isInsideFigure(node: Node): boolean {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return Boolean(el?.closest('.column-inline-figure'));
}

function htmlToFragment(html: string): DocumentFragment {
  const template = document.createElement('div');
  template.innerHTML = html;
  const fragment = document.createDocumentFragment();
  while (template.firstChild) {
    fragment.appendChild(template.firstChild);
  }
  return fragment;
}

function htmlToElement(html: string): HTMLElement {
  const template = document.createElement('div');
  template.innerHTML = html;
  const el = template.firstElementChild;
  if (!el || !(el instanceof HTMLElement)) {
    throw new Error('Failed to parse HTML element');
  }
  return el;
}

function placeCaretAfter(node: ChildNode | null | undefined): void {
  if (!node || !node.parentNode) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function placeCaretAtStart(el: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * Inserts an image anchored at a fixed Y position within a per-column container.
 * The figure gets `position: absolute; top: Npx` via CSS class + inline style.
 * Text paragraphs that visually overlap the figure get `margin-left` applied by
 * `applyAnchorWrap()` called after every change.
 */
export function insertAnchoredFigureAtPoint(
  root: HTMLElement,
  url: string,
  alt: string,
  _clientX: number,
  clientY: number,
  illustrationId?: string
): void {
  const rootRect = root.getBoundingClientRect();
  let anchorTopPx = Math.max(0, Math.round(clientY - rootRect.top));

  // Snap to the bottom of whichever paragraph contains the drop point.
  // This prevents the entire paragraph block from being pushed below the image,
  // which would create a large empty gap above it.
  const paragraphs = Array.from(
    root.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, h5, h6'),
  ).filter(el => !el.closest('.flow-anchor-block'));

  for (const p of paragraphs) {
    const pRect = p.getBoundingClientRect();
    const pTopRel = pRect.top - rootRect.top;
    const pBottomRel = pRect.bottom - rootRect.top;
    if (anchorTopPx >= pTopRel - 2 && anchorTopPx < pBottomRel + 2) {
      anchorTopPx = Math.ceil(pBottomRel);
      break;
    }
  }
  const safeUrl = escapeAttr(url);
  const safeAlt = escapeAttr(alt);
  const safeCaption = escapeHtmlText(alt);
  const illustrationIdAttr = illustrationId
    ? ` data-illustration-id="${escapeAttr(illustrationId)}"`
    : '';

  const figureHtml =
    `<figure class="column-inline-figure col-anchored-figure" contenteditable="false">` +
    `<img src="${safeUrl}" alt="${safeAlt}" class="column-inline-img" draggable="false" />` +
    (alt ? `<figcaption class="column-inline-caption">${safeCaption}</figcaption>` : '') +
    `</figure>`;

  const html =
    `<div class="flow-object flow-anchor-block" data-flow-object="1" data-kind="anchor" style="top:${anchorTopPx}px"${illustrationIdAttr}>` +
    `<button type="button" class="flow-delete-btn flow-delete-object" data-action="delete-object" title="Удалить иллюстрацию">✕</button>` +
    figureHtml +
    `</div>`;

  const el = htmlToElement(html);
  root.appendChild(el);
}

/**
 * After any content change, push the first text paragraph that would overlap
 * an anchored (full-width) figure down below that figure.
 * Call inside requestAnimationFrame so layout is current.
 */
export function applyAnchorWrap(root: HTMLElement): void {
  const anchors = Array.from(root.querySelectorAll<HTMLElement>('.flow-anchor-block'));

  // Clear previous adjustments (must happen before we read positions below)
  root.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, h5, h6').forEach(el => {
    if (!el.closest('.flow-anchor-block')) {
      el.style.marginTop = '';
      el.style.marginLeft = '';
    }
  });

  if (!anchors.length) return;

  // Re-run once images finish loading (they start at height=0 when not cached)
  root.querySelectorAll<HTMLImageElement>('.flow-anchor-block img').forEach(img => {
    if (!img.complete) {
      img.addEventListener('load', () => requestAnimationFrame(() => applyAnchorWrap(root)), { once: true });
    }
  });

  const rootRect = root.getBoundingClientRect();

  anchors.forEach(anchor => {
    const figure = anchor.querySelector<HTMLElement>('.col-anchored-figure');
    if (!figure) return;
    const figRect = figure.getBoundingClientRect();
    if (figRect.height <= 0) return; // image not loaded yet

    const figTopRel    = figRect.top    - rootRect.top;
    const figBottomRel = figRect.bottom - rootRect.top;

    const paragraphs = Array.from(
      root.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, h5, h6')
    ).filter(el => !el.closest('.flow-anchor-block'));

    // Find the first paragraph whose BOTTOM extends past the figure's top edge.
    // A paragraph that starts before figTop but ends inside the figure also needs
    // to be pushed — otherwise it is partially hidden under the figure.
    for (const p of paragraphs) {
      const pRect     = p.getBoundingClientRect();
      const pTopRel   = pRect.top    - rootRect.top;
      const pBottomRel = pRect.bottom - rootRect.top;

      if (pBottomRel > figTopRel) {
        // Push this paragraph (and everything that follows in normal flow)
        // to start just below the figure bottom.
        const needed = figBottomRel - pTopRel + 8;
        if (needed > 0) {
          p.style.marginTop = `${needed}px`;
        }
        break; // subsequent paragraphs follow automatically in normal flow
      }
    }
  });
}

export function buildFloatedImageHtml(url: string, alt: string): string {
  const safeUrl = escapeAttr(url);
  const safeAlt = escapeAttr(alt);
  const safeCaption = escapeHtmlText(alt);
  return (
    `<figure class="column-inline-figure" contenteditable="false">` +
    `<img src="${safeUrl}" alt="${safeAlt}" class="column-inline-img" draggable="false" />` +
    (alt ? `<figcaption class="column-inline-caption">${safeCaption}</figcaption>` : '') +
    `</figure><p><br></p>`
  );
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
