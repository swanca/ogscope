import { describe, it, expect } from 'vitest';
import { scanUrl, ScanFailed } from './scan';
import { UrlRejected } from './safeurl';

const PAGE = `<!doctype html><html><head>
  <title>Example Page</title>
  <meta property="og:title" content="Example Page">
  <meta property="og:description" content="A description that is long enough to avoid the too short warning in the audit engine.">
  <meta property="og:image" content="/card.png">
  <meta name="twitter:card" content="summary_large_image">
</head><body>hi</body></html>`;

function pngBody(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(b.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return b;
}

/** A fetch stub that serves the page and its image, and records what was asked for. */
function stubFetch(overrides: { page?: Partial<ResponseInit & { body: string }>; imageStatus?: number } = {}) {
  const calls: string[] = [];
  const fn = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push(url);
    if (url.endsWith('.png')) {
      const status = overrides.imageStatus ?? 206;
      if (status >= 400) return new Response('nope', { status });
      return new Response(pngBody(1200, 630), {
        status,
        headers: { 'content-type': 'image/png', 'content-range': 'bytes 0-23/204800' },
      });
    }
    return new Response(overrides.page?.body ?? PAGE, {
      status: overrides.page?.status ?? 200,
      headers: { 'content-type': 'text/html; charset=utf-8', ...(overrides.page?.headers as object) },
    });
  };
  return { fn, calls };
}

describe('scanUrl', () => {
  it('returns the parsed tags for a healthy page', async () => {
    const { fn } = stubFetch();
    const result = await scanUrl('https://example.com/', { fetch: fn });
    expect(result.tags['og:title']).toBe('Example Page');
    expect(result.status).toBe(200);
  });

  it('resolves a relative og:image against the page URL before fetching it', async () => {
    const { fn, calls } = stubFetch();
    const result = await scanUrl('https://example.com/blog/', { fetch: fn });
    expect(result.tags['og:image']).toBe('https://example.com/card.png');
    expect(calls).toContain('https://example.com/card.png');
  });

  it('reads the image dimensions and real size from a ranged response', async () => {
    const { fn } = stubFetch();
    const result = await scanUrl('https://example.com/', { fetch: fn });
    expect(result.image?.width).toBe(1200);
    expect(result.image?.height).toBe(630);
    expect(result.image?.bytes).toBe(204800);
  });

  it('grades the page and reports the relative image path as a problem', async () => {
    const { fn } = stubFetch();
    const result = await scanUrl('https://example.com/', { fetch: fn });
    expect(result.audit.score).toBeGreaterThan(0);
    expect(result.audit.issues.map((i) => i.id)).toContain('relative-image-url');
  });

  it('records an unreachable image without failing the whole scan', async () => {
    const { fn } = stubFetch({ imageStatus: 404 });
    const result = await scanUrl('https://example.com/', { fetch: fn });
    expect(result.image?.ok).toBe(false);
    expect(result.audit.issues.map((i) => i.id)).toContain('image-unreachable');
  });

  it('skips the image request entirely when the page declares no image', async () => {
    const { fn, calls } = stubFetch({ page: { body: '<html><head><title>Bare</title></head></html>' } });
    const result = await scanUrl('https://example.com/', { fetch: fn });
    expect(result.image).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('refuses a private address before making any request', async () => {
    const { fn, calls } = stubFetch();
    await expect(scanUrl('http://127.0.0.1/', { fetch: fn })).rejects.toBeInstanceOf(UrlRejected);
    expect(calls).toHaveLength(0);
  });

  it('reports an HTTP error from the target site', async () => {
    const { fn } = stubFetch({ page: { status: 500 } });
    await expect(scanUrl('https://example.com/', { fetch: fn })).rejects.toMatchObject({ code: 'http', status: 500 });
  });

  it('rejects a URL that serves something other than a web page', async () => {
    const fn = async () => new Response('%PDF-1.4', { headers: { 'content-type': 'application/pdf' } });
    await expect(scanUrl('https://example.com/doc.pdf', { fetch: fn })).rejects.toMatchObject({ code: 'not-html' });
  });

  it('turns a network failure into a readable error', async () => {
    const fn = async () => {
      throw new TypeError('fetch failed');
    };
    const error = await scanUrl('https://example.com/', { fetch: fn }).catch((e) => e);
    expect(error).toBeInstanceOf(ScanFailed);
    expect(error.code).toBe('network');
  });

  it('turns a timeout into its own error code', async () => {
    const fn = async () => {
      const err = new Error('timed out');
      err.name = 'TimeoutError';
      throw err;
    };
    await expect(scanUrl('https://example.com/', { fetch: fn })).rejects.toMatchObject({ code: 'timeout' });
  });
});
