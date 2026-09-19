import { parse } from 'node-html-parser';

/**
 * Flat map of every metadata value found on a page, keyed by the lowercased
 * tag name: `og:title`, `twitter:card`, `title`, `canonical`, `theme-color`.
 *
 * Keeping this flat rather than nested means the platform table can name the
 * exact tags it reads and look them up directly, with no per platform parsing.
 */
export type MetaTags = Record<string, string>;

/** Keys whose values are URLs and must be made absolute before we use them. */
const URL_KEYS = new Set([
  'og:image',
  'og:image:url',
  'og:image:secure_url',
  'og:url',
  'twitter:image',
  'twitter:image:src',
  'canonical',
  'apple-touch-icon',
  'icon',
]);

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
  '#x27': "'",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, ref: string) => {
    const known = ENTITIES[ref.toLowerCase()];
    if (known) return known;
    if (ref.startsWith('#x') || ref.startsWith('#X')) {
      const code = Number.parseInt(ref.slice(2), 16);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    if (ref.startsWith('#')) {
      const code = Number.parseInt(ref.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return match;
  });
}

/**
 * Turn a possibly relative URL into an absolute one, the way a crawler would.
 * Returns null when the value is empty or cannot be parsed, so callers can
 * treat "missing" and "broken" the same way.
 */
export function resolveUrl(value: string | null | undefined, baseUrl: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

export interface ParsedPage {
  tags: MetaTags;
  /**
   * URL tags whose raw value was written as a relative path. We resolve them
   * so previews render, but several crawlers (Facebook most notably) refuse to
   * resolve them at all, so the audit still needs to know.
   */
  relativeUrlKeys: string[];
}

/** True when a raw attribute value has no scheme and is not protocol relative. */
function isRelative(value: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('//');
}

/**
 * Extract every tag we care about from raw HTML.
 *
 * Deliberately pure: no network, no platform logic. That keeps it fast to test
 * against the malformed markup real sites ship, and lets the scanner layer own
 * all the IO.
 */
export function parsePage(html: string, baseUrl: string): ParsedPage {
  const root = parse(html);
  const tags: MetaTags = {};
  const relativeUrlKeys: string[] = [];

  // First value wins. Crawlers read top down and keep the first tag they see,
  // so a page with duplicate og:title behaves this way in the wild too.
  const set = (rawKey: string, rawValue: string | undefined): void => {
    const key = rawKey.trim().toLowerCase();
    if (!key || key in tags) return;
    const value = decodeEntities((rawValue ?? '').trim());
    if (!value) return;
    if (URL_KEYS.has(key)) {
      const absolute = resolveUrl(value, baseUrl);
      if (!absolute) return;
      if (isRelative(value)) relativeUrlKeys.push(key);
      tags[key] = absolute;
      return;
    }
    tags[key] = value;
  };

  for (const el of root.querySelectorAll('meta')) {
    const key = el.getAttribute('property') ?? el.getAttribute('name');
    if (!key) continue;
    set(key, el.getAttribute('content'));
  }

  const titleEl = root.querySelector('title');
  if (titleEl) set('title', titleEl.text);

  for (const link of root.querySelectorAll('link')) {
    const rel = link.getAttribute('rel')?.trim().toLowerCase();
    const href = link.getAttribute('href');
    if (!rel || !href) continue;
    if (rel === 'canonical') set('canonical', href);
    if (rel === 'apple-touch-icon' || rel === 'apple-touch-icon-precomposed') {
      set('apple-touch-icon', href);
    }
    if (rel === 'icon' || rel === 'shortcut icon') set('icon', href);
  }

  return { tags, relativeUrlKeys };
}

/** Convenience wrapper for callers that only need the tag map. */
export function parseMetadata(html: string, baseUrl: string): MetaTags {
  return parsePage(html, baseUrl).tags;
}

/**
 * Resolve a value for one platform by walking its tag list in priority order.
 * Mirrors how each crawler falls back, so LinkedIn never sees a twitter: tag
 * and X prefers its own tags over Open Graph.
 */
export function resolveForTags(tags: MetaTags, candidates: string[]): { value: string; source: string } | null {
  for (const key of candidates) {
    const value = tags[key];
    if (value) return { value, source: key };
  }
  return null;
}
