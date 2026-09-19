import type { APIRoute } from 'astro';
import { scanUrl, ScanFailed } from '../../lib/scan';
import { UrlRejected } from '../../lib/safeurl';

export const prerender = false;

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export const GET: APIRoute = async ({ url }) => {
  const target = url.searchParams.get('url');
  if (!target) return json({ error: 'Add a url parameter, for example /api/scan?url=example.com' }, 400);

  try {
    const result = await scanUrl(target);
    // Short cache. Someone fixing their tags will rescan within seconds, so a
    // long cache would make the tool look broken.
    return json(result, 200, { 'Cache-Control': 'public, max-age=30' });
  } catch (err) {
    if (err instanceof UrlRejected) {
      return json({ error: err.message, reason: err.reason }, 400);
    }
    if (err instanceof ScanFailed) {
      return json({ error: err.message, reason: err.code, status: err.status }, 502);
    }
    return json({ error: 'Something went wrong scanning that URL.' }, 500);
  }
};
