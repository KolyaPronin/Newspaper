export interface DnDPayload {
  articleId?: string;
  illustrationId?: string;
}

export function readDnDPayload(dataTransfer: DataTransfer): DnDPayload {
  const articleId = dataTransfer.getData('articleId');
  if (articleId) return { articleId };

  const illustrationId = dataTransfer.getData('illustrationId');
  if (illustrationId) return { illustrationId };

  try {
    const raw = dataTransfer.getData('application/x-newspaper-dnd');
    if (raw) {
      const parsed = JSON.parse(raw) as { kind?: string; articleId?: string; illustrationId?: string };
      if (parsed.kind === 'article' && parsed.articleId) return { articleId: parsed.articleId };
      if (parsed.kind === 'illustration' && parsed.illustrationId) return { illustrationId: parsed.illustrationId };
      if (parsed.kind === 'ad' && parsed.illustrationId) return { illustrationId: parsed.illustrationId };
    }
  } catch {
    // ignore
  }

  const plain = dataTransfer.getData('text/plain')?.trim();
  if (plain && /^[a-f0-9]{24}$/i.test(plain)) {
    return { illustrationId: plain };
  }

  return {};
}
