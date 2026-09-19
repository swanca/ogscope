import { describe, it, expect } from 'vitest';
import { parseMetadata, resolveUrl } from './metadata';

const BASE = 'https://example.com/blog/post';

describe('resolveUrl', () => {
  it('makes a root-relative path absolute', () => {
    expect(resolveUrl('/img/card.png', BASE)).toBe('https://example.com/img/card.png');
  });

  it('makes a document-relative path absolute', () => {
    expect(resolveUrl('card.png', BASE)).toBe('https://example.com/blog/card.png');
  });

  it('leaves an already-absolute URL alone', () => {
    expect(resolveUrl('https://cdn.example.com/a.png', BASE)).toBe('https://cdn.example.com/a.png');
  });

  it('upgrades a protocol-relative URL using the base protocol', () => {
    expect(resolveUrl('//cdn.example.com/a.png', BASE)).toBe('https://cdn.example.com/a.png');
  });

  it('returns null for junk it cannot resolve', () => {
    expect(resolveUrl('', BASE)).toBeNull();
  });
});

describe('parseMetadata', () => {
  it('reads og tags from the property attribute', () => {
    const tags = parseMetadata('<meta property="og:title" content="Hello">', BASE);
    expect(tags['og:title']).toBe('Hello');
  });

  it('reads twitter tags from the name attribute', () => {
    const tags = parseMetadata('<meta name="twitter:card" content="summary_large_image">', BASE);
    expect(tags['twitter:card']).toBe('summary_large_image');
  });

  // Real pages put the attributes in whatever order they like.
  it('reads a tag whose content attribute comes first', () => {
    const tags = parseMetadata('<meta content="Reversed" property="og:title">', BASE);
    expect(tags['og:title']).toBe('Reversed');
  });

  it('reads the document title element', () => {
    const tags = parseMetadata('<html><head><title>  Page Title  </title></head></html>', BASE);
    expect(tags['title']).toBe('Page Title');
  });

  it('reads the canonical link', () => {
    const tags = parseMetadata('<link rel="canonical" href="/canonical-path">', BASE);
    expect(tags['canonical']).toBe('https://example.com/canonical-path');
  });

  it('resolves a relative og:image to an absolute URL', () => {
    const tags = parseMetadata('<meta property="og:image" content="/card.png">', BASE);
    expect(tags['og:image']).toBe('https://example.com/card.png');
  });

  it('treats property names case-insensitively', () => {
    const tags = parseMetadata('<meta property="OG:TITLE" content="Shouty">', BASE);
    expect(tags['og:title']).toBe('Shouty');
  });

  it('keeps the first value when a tag is duplicated, matching crawler behaviour', () => {
    const tags = parseMetadata(
      '<meta property="og:title" content="First"><meta property="og:title" content="Second">',
      BASE,
    );
    expect(tags['og:title']).toBe('First');
  });

  it('ignores a meta tag with no content attribute', () => {
    const tags = parseMetadata('<meta property="og:title">', BASE);
    expect(tags['og:title']).toBeUndefined();
  });

  it('ignores a meta tag whose content is only whitespace', () => {
    const tags = parseMetadata('<meta property="og:description" content="   ">', BASE);
    expect(tags['og:description']).toBeUndefined();
  });

  it('decodes HTML entities in content', () => {
    const tags = parseMetadata('<meta property="og:title" content="Tips &amp; Tricks">', BASE);
    expect(tags['og:title']).toBe('Tips & Tricks');
  });

  it('reads theme-color, which drives the Slack and Discord accent bar', () => {
    const tags = parseMetadata('<meta name="theme-color" content="#ff0000">', BASE);
    expect(tags['theme-color']).toBe('#ff0000');
  });

  it('returns an empty object for a page with no head metadata', () => {
    expect(parseMetadata('<html><body><p>hi</p></body></html>', BASE)).toEqual({});
  });
});
