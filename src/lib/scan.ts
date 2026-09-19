import { parsePage, type MetaTags } from './metadata';
import { auditPage, type AuditResult, type ImageProbe } from './audit';
import { readImageSize } from './imagesize';
import { normalizeUrl } from './safeurl';
import { resolveForTags } from './metadata';

export const USER_AGENT = 'Mozilla/5.0 (compatible; OGScopeBot/1.0; +https://ogscope.app/bot)';

/** Cap on how much of a page we read. Metadata always lives near the top. */
const MAX_HTML_BYTES = 512 * 1024;
/** Enough of an image to cover any header we know how to parse. */
const IMAGE_HEAD_BYTES = 65_536;
const TIMEOUT_MS = 10_000;

export class ScanFailed extends Error {
  constructor(
    public code: 'timeout' | 'network' | 'http' | 'not-html',
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ScanFailed';
  }
}

export interface ScanResult {
  url: string;
  finalUrl: string;
  status: number;
  redirected: boolean;
  tags: MetaTags;
  image: ImageProbe | null;
  audit: AuditResult;
  scannedAt: string;
  durationMs: number;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ScanDeps {
  fetch?: FetchLike;
}

/**
 * Fetch a page, read its metadata, check its image, and grade the result.
 *
 * All the network work lives here so that parsing, grading and image decoding
 * stay pure and independently testable.
 */
export async function scanUrl(input: string, deps: ScanDeps = {}): Promise<ScanResult> {
  const doFetch: FetchLike = deps.fetch ?? ((u, i) => fetch(u, i));
  const url = normalizeUrl(input);
  const started = Date.now();

  let response: Response;
  try {
    response = await doFetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const name = (err as Error)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new ScanFailed('timeout', 'The site took too long to respond.');
    }
    throw new ScanFailed('network', 'We could not reach that URL. Check the domain resolves and is publicly online.');
  }

  if (!response.ok) {
    throw new ScanFailed('http', `The site returned HTTP ${response.status}.`, response.status);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType && !/(text\/html|application\/xhtml|text\/plain)/i.test(contentType)) {
    throw new ScanFailed('not-html', `That URL serves ${contentType.split(';')[0]}, not a web page.`);
  }

  const html = await readCapped(response, MAX_HTML_BYTES);
  const finalUrl = response.url || url;
  const { tags, relativeUrlKeys } = parsePage(html, finalUrl);

  const imageTag = resolveForTags(tags, [
    'og:image',
    'og:image:secure_url',
    'og:image:url',
    'twitter:image',
    'twitter:image:src',
  ]);
  const image = imageTag ? await probeImage(imageTag.value, doFetch) : null;

  const audit = auditPage({ tags, pageUrl: finalUrl, image, relativeUrlKeys });

  return {
    url,
    finalUrl,
    status: response.status,
    redirected: finalUrl !== url,
    tags,
    image,
    audit,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
  };
}

/** Read a response body but stop once we have enough, so one huge page cannot stall us. */
async function readCapped(response: Response, limit: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return await response.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  await reader.cancel().catch(() => {});

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(merged);
}

/**
 * Check the social image the way a crawler would: anonymously, with a range
 * request so we read the header rather than downloading the whole file.
 */
export async function probeImage(url: string, doFetch: FetchLike): Promise<ImageProbe> {
  try {
    const response = await doFetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'image/*',
        Range: `bytes=0-${IMAGE_HEAD_BYTES - 1}`,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok && response.status !== 206) {
      return { ok: false, url, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') ?? undefined;
    const body = new Uint8Array(await response.arrayBuffer());
    const size = readImageSize(body);

    return {
      ok: true,
      url,
      bytes: totalBytes(response, body),
      width: size?.width || undefined,
      height: size?.height || undefined,
      contentType,
    };
  } catch (err) {
    const name = (err as Error)?.name;
    return {
      ok: false,
      url,
      error: name === 'TimeoutError' || name === 'AbortError' ? 'timed out' : 'could not be fetched',
    };
  }
}

/**
 * Work out the real file size. A ranged response reports the full length after
 * the slash in Content-Range; without range support the body we received is the
 * whole file.
 */
function totalBytes(response: Response, body: Uint8Array): number | undefined {
  const range = response.headers.get('content-range');
  if (range) {
    const match = range.match(/\/(\d+)\s*$/);
    if (match) return Number(match[1]);
  }
  if (response.status !== 206) {
    const length = response.headers.get('content-length');
    if (length && Number.isFinite(Number(length))) return Number(length);
    return body.byteLength;
  }
  return undefined;
}
