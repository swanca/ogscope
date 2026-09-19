import type { APIRoute } from 'astro';
import { PLATFORMS } from '../lib/platforms';

export const prerender = true;

/** Path plus how strongly we want it crawled. Guides carry the organic traffic. */
const PAGES: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/pricing', priority: '0.6', changefreq: 'monthly' },
  { path: '/bot', priority: '0.3', changefreq: 'yearly' },
  ...PLATFORMS.map((p) => ({ path: `/fix/${p.id}`, priority: '0.9', changefreq: 'monthly' })),
];

export const GET: APIRoute = ({ site }) => {
  const origin = (site ?? new URL('https://ogscope.app')).origin;
  const lastmod = new Date().toISOString().slice(0, 10);

  const urls = PAGES.map(
    ({ path, priority, changefreq }) => `  <url>
    <loc>${origin}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
  ).join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`,
    { headers: { 'content-type': 'application/xml; charset=utf-8' } },
  );
};
