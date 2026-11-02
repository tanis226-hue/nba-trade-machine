/**
 * Keep the source's player ID. ESPN full portraits already have enough pixels
 * for dense displays; only the known NBA thumbnail path needs a larger source.
 */
export function headshotSources(src?: string | null): string[] {
  if (!src) return [];
  try {
    const url = new URL(src);
    if (url.protocol === 'https:' && url.hostname === 'cdn.nba.com' && !url.port &&
      /^\/headshots\/nba\/latest\/260x190\/\d+\.png$/.test(url.pathname)) {
      url.pathname = url.pathname.replace('/260x190/', '/1040x760/');
      return [url.href, src];
    }
  } catch {
    // Local paths and unfamiliar sources remain exactly as supplied.
  }
  return [src];
}

/** These providers publish a centered head-and-shoulders portrait, not a face crop. */
export function headshotZoom(src: string): number {
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' || url.port) return 1;
    if (url.hostname === 'a.espncdn.com' &&
      /^\/i\/headshots\/nba\/players\/full\/\d+\.png$/.test(url.pathname)) return 1.35;
    if (url.hostname === 'cdn.nba.com' &&
      /^\/headshots\/nba\/latest\/(?:260x190|1040x760)\/\d+\.png$/.test(url.pathname)) return 1.2;
  } catch {
    // Do not impose a provider-specific crop on unknown images.
  }
  return 1;
}
