import { describe, it, expect } from 'vitest';
import { auditPage, type ImageProbe } from './audit';
import type { MetaTags } from './metadata';

const GOOD_DESCRIPTION =
  'A description that is a reasonable length for search engines and social cards to show without truncating it awkwardly.';

const HEALTHY_TAGS: MetaTags = {
  'og:title': 'A perfectly good title',
  'og:description': GOOD_DESCRIPTION,
  'og:image': 'https://example.com/og.png',
  'og:url': 'https://example.com/',
  'og:type': 'website',
  'og:site_name': 'Example',
  'twitter:card': 'summary_large_image',
  title: 'A perfectly good title',
  description: GOOD_DESCRIPTION,
  canonical: 'https://example.com/',
  'theme-color': '#112233',
};

const HEALTHY_IMAGE: ImageProbe = {
  ok: true,
  url: 'https://example.com/og.png',
  bytes: 180_000,
  width: 1200,
  height: 630,
  contentType: 'image/png',
};

function audit(tags: MetaTags, image: ImageProbe | null = HEALTHY_IMAGE, relativeUrlKeys: string[] = []) {
  return auditPage({ tags, pageUrl: 'https://example.com/', image, relativeUrlKeys });
}

function ids(result: ReturnType<typeof audit>) {
  return result.issues.map((i) => i.id);
}

function omit(tags: MetaTags, ...keys: string[]): MetaTags {
  const copy = { ...tags };
  for (const k of keys) delete copy[k];
  return copy;
}

describe('auditPage scoring', () => {
  it('gives a fully tagged page a perfect score and an A', () => {
    const result = audit(HEALTHY_TAGS);
    expect(result.issues).toEqual([]);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
  });

  it('never returns a score below zero, however broken the page', () => {
    const result = audit({}, { ok: false, url: '', error: 'not found' });
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('scores a page with no metadata at all worse than one missing a single tag', () => {
    const empty = audit({});
    const nearlyFine = audit(omit(HEALTHY_TAGS, 'og:description', 'description'));
    expect(empty.score).toBeLessThan(nearlyFine.score);
  });

  it('orders issues with errors before warnings', () => {
    const result = audit(omit(HEALTHY_TAGS, 'og:image', 'theme-color'));
    const severities = result.issues.map((i) => i.severity);
    const firstWarning = severities.indexOf('warning');
    const lastError = severities.lastIndexOf('error');
    if (firstWarning !== -1 && lastError !== -1) expect(lastError).toBeLessThan(firstWarning);
  });
});

describe('missing tag detection', () => {
  it('flags a missing image as an error', () => {
    const result = audit(omit(HEALTHY_TAGS, 'og:image'), null);
    expect(ids(result)).toContain('missing-image');
    expect(result.issues.find((i) => i.id === 'missing-image')?.severity).toBe('error');
  });

  it('flags a missing title as an error', () => {
    expect(ids(audit(omit(HEALTHY_TAGS, 'og:title', 'title')))).toContain('missing-title');
  });

  it('does not flag a missing og:title when a document title can stand in', () => {
    expect(ids(audit(omit(HEALTHY_TAGS, 'og:title')))).not.toContain('missing-title');
  });

  it('flags a missing description as a warning rather than an error', () => {
    const result = audit(omit(HEALTHY_TAGS, 'og:description', 'description'));
    expect(result.issues.find((i) => i.id === 'missing-description')?.severity).toBe('warning');
  });

  it('flags a missing canonical link', () => {
    expect(ids(audit(omit(HEALTHY_TAGS, 'canonical')))).toContain('missing-canonical');
  });

  it('offers a copy-paste fix for every issue that has one', () => {
    const result = audit({});
    const fixes = result.issues.filter((i) => i.fix !== null);
    expect(fixes.length).toBeGreaterThan(0);
    for (const issue of fixes) expect(issue.fix).toMatch(/^<(meta|link|title)/);
  });
});

describe('twitter card handling', () => {
  it('flags a missing twitter:card because X renders no card without it', () => {
    const result = audit(omit(HEALTHY_TAGS, 'twitter:card'));
    expect(ids(result)).toContain('missing-twitter-card');
    expect(result.issues.find((i) => i.id === 'missing-twitter-card')?.platforms).toContain('x');
  });

  it('flags an unrecognised twitter:card value', () => {
    expect(ids(audit({ ...HEALTHY_TAGS, 'twitter:card': 'big_picture' }))).toContain('invalid-twitter-card');
  });

  it('warns that a summary card shows a small square image instead of a banner', () => {
    expect(ids(audit({ ...HEALTHY_TAGS, 'twitter:card': 'summary' }))).toContain('small-twitter-card');
  });
});

describe('image checks', () => {
  it('flags an image the crawler cannot fetch', () => {
    const result = audit(HEALTHY_TAGS, { ok: false, url: 'https://example.com/og.png', error: '404' });
    expect(ids(result)).toContain('image-unreachable');
  });

  it('flags an image below the minimum size platforms accept', () => {
    expect(ids(audit(HEALTHY_TAGS, { ...HEALTHY_IMAGE, width: 150, height: 150 }))).toContain('image-too-small');
  });

  it('flags an image heavier than the WhatsApp limit', () => {
    const result = audit(HEALTHY_TAGS, { ...HEALTHY_IMAGE, bytes: 900_000 });
    expect(ids(result)).toContain('image-too-heavy');
    expect(result.issues.find((i) => i.id === 'image-too-heavy')?.platforms).toContain('whatsapp');
  });

  it('flags an aspect ratio far from the 1.91:1 the platforms crop to', () => {
    expect(ids(audit(HEALTHY_TAGS, { ...HEALTHY_IMAGE, width: 1200, height: 1200 }))).toContain('image-aspect-ratio');
  });

  it('accepts a ratio that is slightly off without complaining', () => {
    expect(ids(audit(HEALTHY_TAGS, { ...HEALTHY_IMAGE, width: 1200, height: 640 }))).not.toContain(
      'image-aspect-ratio',
    );
  });

  it('flags a webp image because LinkedIn and WhatsApp will not render it', () => {
    const result = audit(
      { ...HEALTHY_TAGS, 'og:image': 'https://example.com/og.webp' },
      { ...HEALTHY_IMAGE, url: 'https://example.com/og.webp', contentType: 'image/webp' },
    );
    expect(ids(result)).toContain('image-webp');
    expect(result.issues.find((i) => i.id === 'image-webp')?.platforms).toContain('linkedin');
  });

  it('flags a relative image path, which Facebook refuses to resolve', () => {
    expect(ids(audit(HEALTHY_TAGS, HEALTHY_IMAGE, ['og:image']))).toContain('relative-image-url');
  });

  it('flags an http image served from an https page', () => {
    const result = audit(
      { ...HEALTHY_TAGS, 'og:image': 'http://example.com/og.png' },
      { ...HEALTHY_IMAGE, url: 'http://example.com/og.png' },
    );
    expect(ids(result)).toContain('insecure-image');
  });
});

describe('length checks', () => {
  it('flags a title long enough for Google to truncate', () => {
    const result = audit({ ...HEALTHY_TAGS, 'og:title': 'x'.repeat(120), title: 'x'.repeat(120) });
    const issue = result.issues.find((i) => i.id === 'title-too-long');
    expect(issue).toBeDefined();
    expect(issue?.platforms).toContain('google');
  });

  it('flags a description long enough to be cut off', () => {
    expect(ids(audit({ ...HEALTHY_TAGS, 'og:description': 'y'.repeat(400) }))).toContain('description-too-long');
  });

  it('flags a description too short to fill the card', () => {
    expect(ids(audit({ ...HEALTHY_TAGS, 'og:description': 'Too short.' }))).toContain('description-too-short');
  });
});

describe('nice to have checks', () => {
  it('reports a missing theme-color as info, not as a real problem', () => {
    const result = audit(omit(HEALTHY_TAGS, 'theme-color'));
    expect(result.issues.find((i) => i.id === 'missing-theme-color')?.severity).toBe('info');
  });

  it('reports a missing og:site_name as info', () => {
    expect(ids(audit(omit(HEALTHY_TAGS, 'og:site_name')))).toContain('missing-site-name');
  });
});
