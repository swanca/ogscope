import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePage } from './metadata';
import { auditPage } from './audit';

/**
 * Run our own auditor over our own built pages.
 *
 * The first thing anyone will do with this tool is scan the site that made it,
 * so a bad score here is embarrassing in a way a normal bug is not. These tests
 * only run after a build, and skip quietly otherwise.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGES = [
  ['home', 'dist/client/index.html'],
  ['a guide page', 'dist/client/fix/linkedin/index.html'],
  ['pricing', 'dist/client/pricing/index.html'],
] as const;

const built = existsSync(join(ROOT, 'dist/client/index.html'));

describe.skipIf(!built)('our own pages pass our own audit', () => {
  for (const [name, file] of PAGES) {
    it(`grades ${name} an A with no errors or warnings`, () => {
      const html = readFileSync(join(ROOT, file), 'utf8');
      const { tags, relativeUrlKeys } = parsePage(html, 'https://ogscope.app/');

      // The real image is generated on demand, so assert the tag is a fully
      // qualified URL and hand the auditor a healthy probe for it.
      expect(tags['og:image']).toMatch(/^https:\/\//);

      const result = auditPage({
        tags,
        pageUrl: 'https://ogscope.app/',
        relativeUrlKeys,
        image: {
          ok: true,
          url: tags['og:image']!,
          width: 1200,
          height: 630,
          bytes: 49_000,
          contentType: 'image/png',
        },
      });

      const serious = result.issues.filter((i) => i.severity !== 'info');
      expect(serious, serious.map((i) => `${i.severity}: ${i.title}`).join('\n')).toEqual([]);
      expect(result.grade).toBe('A');
    });
  }

  it('sets a canonical URL on every page', () => {
    for (const [, file] of PAGES) {
      const { tags } = parsePage(readFileSync(join(ROOT, file), 'utf8'), 'https://ogscope.app/');
      expect(tags['canonical'], file).toMatch(/^https:\/\//);
    }
  });

  it('gives each page its own title and description', () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const [, file] of PAGES) {
      const { tags } = parsePage(readFileSync(join(ROOT, file), 'utf8'), 'https://ogscope.app/');
      titles.add(tags['og:title'] ?? '');
      descriptions.add(tags['description'] ?? '');
    }
    expect(titles.size).toBe(PAGES.length);
    expect(descriptions.size).toBe(PAGES.length);
  });
});
