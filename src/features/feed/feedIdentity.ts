const IGNORED_FEED_QUERY_PARAMS = new Set([
  'prismTest',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
]);

export function createFeedIdentityKey(feedUrl?: string | null): string | null {
  if (!feedUrl) return null;

  try {
    const url = new URL(feedUrl.trim());

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.hash = '';

    for (const param of [...url.searchParams.keys()]) {
      if (IGNORED_FEED_QUERY_PARAMS.has(param) || param.toLowerCase().startsWith('utm_')) {
        url.searchParams.delete(param);
      }
    }

    const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    url.search = '';
    for (const [key, value] of params) {
      url.searchParams.append(key, value);
    }

    let pathname = url.pathname.replace(/\/+$/, '');
    if (!pathname) pathname = '/';

    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${pathname}${url.search}`;
  } catch {
    return feedUrl.trim().toLowerCase();
  }
}

export function areSameFeedUrl(left?: string | null, right?: string | null): boolean {
  const leftKey = createFeedIdentityKey(left);
  const rightKey = createFeedIdentityKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}
