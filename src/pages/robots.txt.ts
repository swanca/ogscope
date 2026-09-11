import type { APIRoute } from 'astro';

export const prerender = true;

/**
 * Generated rather than kept as a static file, so the sitemap line always
 * matches wherever the site is actually deployed. A hardcoded domain here
 * silently points Google at a sitemap that does not exist.
 */
export const GET: APIRoute = ({ site }) => {
  const origin = (site ?? new URL('https://example.com')).origin;
  return new Response(
    `User-agent: *\nAllow: /\n\n# Results are generated per request and hold no content worth indexing.\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`,
    { headers: { 'content-type': 'text/plain; charset=utf-8' } },
  );
};
