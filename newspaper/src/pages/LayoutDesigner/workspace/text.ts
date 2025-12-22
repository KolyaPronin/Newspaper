import { Article } from '../../../types/Article';

export function getPlainText(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

export function buildArticleTextIndex(articles: Article[]): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    if (!map.has(a.id)) {
      map.set(a.id, getPlainText(a.content));
    }
  }
  return map;
}

export function inferArticleIdFromHtml(html: string, articleTextIndex: Map<string, string>): string | undefined {
  const text = getPlainText(html);
  if (!text) return undefined;
  const probe = text.slice(0, Math.min(80, text.length));
  if (probe.length < 30) return undefined;

  const entries = Array.from(articleTextIndex.entries());
  for (let i = 0; i < entries.length; i++) {
    const id = entries[i][0];
    const fullText = entries[i][1];
    if (fullText.includes(probe)) return id;
  }
  return undefined;
}
