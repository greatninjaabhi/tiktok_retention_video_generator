/** Best-effort article text for drafting (plain text, capped). Failures just mean "headline only". */
export function htmlToText(html: string, cap = 6000): string {
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|aside)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/h\d>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, '—')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  // Keep paragraph-like lines (drops menus and link lists).
  const paras = body.split('\n').map((l) => l.trim()).filter((l) => l.split(' ').length >= 8);
  return paras.join('\n').slice(0, cap);
}

export async function fetchArticleText(url: string, timeoutMs = 8000): Promise<string | undefined> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'Mozilla/5.0 (research; tiktok-retention-video-generator)' } });
    if (!res.ok) return undefined;
    const text = htmlToText(await res.text());
    return text.length > 200 ? text : undefined;
  } catch {
    return undefined;
  }
}
