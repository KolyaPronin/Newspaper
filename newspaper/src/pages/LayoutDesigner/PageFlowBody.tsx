import React, { useCallback, useEffect, useRef } from 'react';
import { Article } from '../../types/Article';
import { Illustration } from '../../utils/api';
import { insertHtmlAtPoint, buildFloatedImageHtml } from './workspace/columnHtml/insertInColumn';
import { readDnDPayload } from './workspace/columnHtml/readDnDPayload';
import { EMPTY_COLUMN_HTML } from './workspace/columnHtml/columnHtmlModel';

interface PageFlowBodyProps {
  html: string;
  articles: Article[];
  illustrations: Illustration[];
  disabled?: boolean;
  onHtmlChange: (html: string) => void;
}

const PageFlowBody: React.FC<PageFlowBodyProps> = ({
  html,
  articles,
  illustrations,
  disabled,
  onHtmlChange,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  // Track what we last wrote INTO state so we can detect external (pagination) changes.
  const lastSyncedRef = useRef<string | null>(null);

  // Initialize on first mount, then update when the prop changes from outside
  // (e.g. pagination trimmed the page). Skip update if we ourselves just wrote this value.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const incoming = html?.trim() ? html : EMPTY_COLUMN_HTML;
    if (lastSyncedRef.current === null) {
      // First mount
      el.innerHTML = incoming;
      lastSyncedRef.current = incoming;
    } else if (incoming !== lastSyncedRef.current) {
      // External change (pagination changed this page's content)
      el.innerHTML = incoming;
      lastSyncedRef.current = incoming;
    }
  }, [html]);

  const syncHtml = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const currentHtml = el.innerHTML;
    lastSyncedRef.current = currentHtml; // mark as our own write so effect ignores it
    onHtmlChange(currentHtml);
  }, [onHtmlChange]);

  const blockEdit = useCallback((e: React.SyntheticEvent) => {
    if (disabled) return;
    e.preventDefault();
  }, [disabled]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const root = editorRef.current;
    if (!root) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    const actionEl = target.closest<HTMLElement>('[data-action]');
    if (!actionEl) return;

    const action = actionEl.getAttribute('data-action');
    if (!action) return;

    e.preventDefault();
    e.stopPropagation();

    if (action === 'delete-object') {
      const obj = actionEl.closest<HTMLElement>('[data-flow-object="1"]');
      obj?.remove();
      syncHtml();
      return;
    }

    if (action === 'delete-article') {
      const articleId = actionEl.getAttribute('data-article-id');
      if (articleId) {
        const escaped = cssEscape(articleId);
        root.querySelectorAll(`[data-article-id="${escaped}"]`).forEach((node) => {
          node.remove();
        });
      } else {
        const art = actionEl.closest<HTMLElement>('[data-flow-article="1"]');
        art?.remove();
      }
      syncHtml();
      return;
    }
  }, [disabled, syncHtml]);

  const processDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();

      const root = editorRef.current;
      if (!root) return;

      const dataTransfer = e.dataTransfer;
      if (!dataTransfer) return;

      const payload = readDnDPayload(dataTransfer);

      if (payload.articleId) {
        const article = articles.find(a => a.id === payload.articleId);
        if (!article) return;
        const wrapped = buildArticleInsertHtml(article);
        insertHtmlAtPoint(root, wrapped, e.clientX, e.clientY);
        syncHtml();
        return;
      }

      if (payload.illustrationId) {
        const ill = illustrations.find(i => i.id === payload.illustrationId);
        if (ill) {
          insertHtmlAtPoint(root, buildObjectHtml(buildFloatedImageHtml(ill.url, ill.caption || ''), 'image', { includeObjectDelete: true }), e.clientX, e.clientY);
          syncHtml();
        }
        return;
      }

      const imageFile = Array.from(dataTransfer.files).find(f => f.type.startsWith('image/'));
      if (imageFile) {
        const objectUrl = URL.createObjectURL(imageFile);
        insertHtmlAtPoint(root, buildObjectHtml(buildFloatedImageHtml(objectUrl, imageFile.name), 'image', { includeObjectDelete: true }), e.clientX, e.clientY);
        syncHtml();
      }
    },
    [articles, disabled, illustrations, syncHtml]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, [disabled]);

  return (
    <div
      ref={editorRef}
      className="page-flow-body"
      contentEditable={false}
      suppressContentEditableWarning
      lang="ru"
      onKeyDown={blockEdit}
      onBeforeInput={blockEdit}
      onPaste={blockEdit}
      onClick={handleClick}
      onDrop={processDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
    />
  );
};

function buildArticleInsertHtml(article: Article): string {
  const titleHtml = article.title ? `<h2>${escapeText(article.title)}</h2>` : '';
  const contentHtml = `${titleHtml}${article.content || ''}`;
  return wrapTopLevelElementsAsObjects(contentHtml, article.id);
}

function wrapTopLevelElementsAsObjects(html: string, articleId?: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;

  const out: string[] = [];
  let articleDeletePlaced = false;
  Array.from(container.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').trim();
      if (!text) return;
      const escaped = escapeText(text);
      out.push(buildObjectHtml(`<p>${escaped}</p>`, 'text', {
        articleId,
        includeArticleDelete: !!articleId && !articleDeletePlaced,
      }));
      articleDeletePlaced = articleDeletePlaced || !!articleId;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;

    // Normalize stray figures/blocks into per-object wrapper.
    out.push(buildObjectHtml(el.outerHTML, el.tagName.toLowerCase(), {
      articleId,
      includeArticleDelete: !!articleId && !articleDeletePlaced,
    }));
    articleDeletePlaced = articleDeletePlaced || !!articleId;
  });

  return out.length > 0 ? out.join('') : buildObjectHtml('<p><br></p>', 'empty', {
    articleId,
    includeArticleDelete: !!articleId,
  });
}

function buildObjectHtml(
  innerHtml: string,
  kind: string,
  options?: {
    articleId?: string;
    includeArticleDelete?: boolean;
    includeObjectDelete?: boolean;
  }
): string {
  const articleId = options?.articleId;
  const articleAttr = articleId ? ` data-article-id="${escapeAttr(articleId)}"` : '';
  const articleDelete = options?.includeArticleDelete
    ? `<button type="button" class="flow-delete-btn flow-delete-article" data-action="delete-article" data-article-id="${escapeAttr(articleId || '')}" title="Удалить статью">✕</button>`
    : '';
  const objectDelete = options?.includeObjectDelete
    ? `<button type="button" class="flow-delete-btn flow-delete-object" data-action="delete-object" title="Удалить объект">✕</button>`
    : '';

  return (
    `<div class="flow-object" data-flow-object="1" data-kind="${escapeAttr(kind)}"${articleAttr}>` +
    articleDelete +
    objectDelete +
    innerHtml +
    `</div>`
  );
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function cssEscape(value: string): string {
  // Keep selectors safe in older browsers without CSS.escape.
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export default PageFlowBody;
