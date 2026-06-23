import React, { useCallback, useEffect, useRef } from 'react';
import { Article } from '../../types/Article';
import { Illustration } from '../../utils/api';
import {
  insertHtmlAtPoint,
  insertAnchoredFigureAtPoint,
  applyAnchorWrap,
} from './workspace/columnHtml/insertInColumn';
import { readDnDPayload } from './workspace/columnHtml/readDnDPayload';
import { EMPTY_COLUMN_HTML } from './workspace/columnHtml/columnHtmlModel';

interface ColumnFlowBodyProps {
  html: string;
  columnIndex: number;
  articles: Article[];
  illustrations: Illustration[];
  disabled?: boolean;
  onHtmlChange: (html: string) => void;
  onDeleteArticle?: (articleId: string) => void;
}

const ColumnFlowBody: React.FC<ColumnFlowBodyProps> = ({
  html,
  columnIndex,
  articles,
  illustrations,
  disabled,
  onHtmlChange,
  onDeleteArticle,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const incoming = html?.trim() ? html : EMPTY_COLUMN_HTML;
    if (lastSyncedRef.current === null) {
      el.innerHTML = incoming;
      lastSyncedRef.current = incoming;
      requestAnimationFrame(() => applyAnchorWrap(el));
    } else if (incoming !== lastSyncedRef.current) {
      el.innerHTML = incoming;
      lastSyncedRef.current = incoming;
      requestAnimationFrame(() => applyAnchorWrap(el));
    }
  }, [html]);

  const syncHtml = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    applyAnchorWrap(el);
    const currentHtml = el.innerHTML;
    lastSyncedRef.current = currentHtml;
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
      requestAnimationFrame(() => { if (root) applyAnchorWrap(root); });
      syncHtml();
      return;
    }

    if (action === 'delete-article') {
      const articleId = actionEl.getAttribute('data-article-id');
      if (articleId && onDeleteArticle) {
        // Propagate to workspace — it removes article from ALL columns on ALL pages
        onDeleteArticle(articleId);
      } else {
        // Fallback: remove from this column only
        if (articleId) {
          const escaped = articleId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          root.querySelectorAll(`[data-article-id="${escaped}"]`).forEach(n => n.remove());
        } else {
          actionEl.closest<HTMLElement>('[data-flow-article="1"]')?.remove();
        }
        requestAnimationFrame(() => { if (root) applyAnchorWrap(root); });
        syncHtml();
      }
    }
  }, [disabled, onDeleteArticle, syncHtml]);

  const processDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    const root = editorRef.current;
    if (!root) return;

    const payload = readDnDPayload(e.dataTransfer);

    if (payload.articleId) {
      const article = articles.find(a => a.id === payload.articleId);
      if (!article) return;
      insertHtmlAtPoint(root, buildArticleInsertHtml(article), e.clientX, e.clientY);
      syncHtml();
      return;
    }

    if (payload.illustrationId) {
      const ill = illustrations.find(i => i.id === payload.illustrationId);
      if (!ill) return;
      // Always anchor — avoids flow-object nesting bugs and keeps text flowing around the image
      insertAnchoredFigureAtPoint(root, ill.url, ill.caption || '', e.clientX, e.clientY);
      syncHtml();
      return;
    }

    const imageFile = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
    if (imageFile) {
      const objectUrl = URL.createObjectURL(imageFile);
      insertAnchoredFigureAtPoint(root, objectUrl, imageFile.name, e.clientX, e.clientY);
      syncHtml();
    }
  }, [articles, disabled, illustrations, syncHtml]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, [disabled]);

  return (
    <div
      ref={editorRef}
      className="col-flow-body"
      data-column-index={columnIndex}
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
  Array.from(container.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').trim();
      if (!text) return;
      out.push(buildObjectHtml(`<p>${escapeText(text)}</p>`, 'text', {
        articleId,
        includeArticleDelete: !!articleId && !articleDeletePlaced,
      }));
      articleDeletePlaced = articleDeletePlaced || !!articleId;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
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
  options?: { articleId?: string; includeArticleDelete?: boolean; includeObjectDelete?: boolean }
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
    articleDelete + objectDelete + innerHtml +
    `</div>`
  );
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export default ColumnFlowBody;
