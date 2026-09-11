import type { APIRoute } from 'astro';
import { render, CustomFont } from '@cf-wasm/og';
// Astro 6 removed Astro.locals.runtime.env. Bindings now come from here.
import { env } from 'cloudflare:workers';

export const prerender = false;

const WIDTH = 1200;
const HEIGHT = 630;

/** Palette matches the site. Dark by default because it reads better in a feed. */
const THEMES = {
  dark: { bg: '#0b111b', grid: '#1b2537', title: '#ffffff', body: '#98a4b8', accent: '#5b3df5' },
  light: { bg: '#eef1f6', grid: '#dbe1ea', title: '#0b111b', body: '#5a6779', accent: '#5b3df5' },
} as const;

/** Minimal shape of the Workers static assets binding. */
type AssetFetcher = { fetch: (input: Request | string | URL) => Promise<Response> };

/**
 * Every font file starts with one of these four signatures. Checking it turns
 * "Unsupported OpenType signature" deep inside the renderer into an error that
 * says which file was wrong and what arrived instead.
 */
function assertFont(bytes: ArrayBuffer, file: string): ArrayBuffer {
  const head = new Uint8Array(bytes.slice(0, 4));
  const tag = String.fromCharCode(...head);
  const version1 = head[0] === 0x00 && head[1] === 0x01 && head[2] === 0x00 && head[3] === 0x00;
  if (!version1 && !['OTTO', 'true', 'ttcf'].includes(tag)) {
    const preview = new TextDecoder().decode(bytes.slice(0, 60));
    throw new Error(`${file} is not a font. First bytes: ${JSON.stringify(preview)}`);
  }
  return bytes;
}

/**
 * Fonts come from our own static assets rather than the bundle, so they cost
 * nothing against the Worker script size limit and nothing is fetched from a
 * third party at render time.
 *
 * Read through the ASSETS binding rather than by fetching our own URL. A Worker
 * requesting its own origin is answered by the Worker again, not by the asset
 * layer, so that returns the HTML 404 page instead of the font.
 */
function font(assets: AssetFetcher | null, origin: string, file: string, weight: 400 | 700): CustomFont {
  const load = async (): Promise<ArrayBuffer> => {
    const target = new URL(`/fonts/${file}`, origin);
    const response = assets ? await assets.fetch(target) : await fetch(target.toString());
    if (!response.ok) throw new Error(`${file} returned HTTP ${response.status}`);
    return assertFont(await response.arrayBuffer(), file);
  };
  return new CustomFont('Archivo', load, { weight, style: 'normal' });
}

/** Minimal element helper so this file does not need a JSX pipeline. */
type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style, ...(children === undefined ? {} : { children }) },
});

function clamp(value: string | null, max: number, fallback = ''): string {
  const text = (value ?? fallback).trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}...` : text;
}

export const GET: APIRoute = async ({ url, request }) => {
  // Static assets binding. Falls back to an origin fetch if it is ever absent,
  // though on Cloudflare it always is present.
  const assets = (env as unknown as { ASSETS?: AssetFetcher })?.ASSETS ?? null;

  const params = url.searchParams;
  const title = clamp(params.get('title'), 110, 'Untitled');
  const subtitle = clamp(params.get('subtitle'), 160);
  const label = clamp(params.get('label'), 40);
  const theme = THEMES[params.get('theme') === 'light' ? 'light' : 'dark'];
  const accent = /^#[0-9a-f]{6}$/i.test(params.get('accent') ?? '') ? params.get('accent')! : theme.accent;

  // Identical parameters always produce an identical image, so this is worth
  // caching hard. It is also what keeps the unit cost near zero.
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const cached = await cache?.match(request);
  if (cached) return cached;

  try {
    const tree = el(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: '72px 80px',
        backgroundColor: theme.bg,
        // Faint grid, the same device the site uses behind the hero.
        backgroundImage: `linear-gradient(${theme.grid} 1px, transparent 1px), linear-gradient(90deg, ${theme.grid} 1px, transparent 1px)`,
        backgroundSize: '150px 157px',
        fontFamily: 'Archivo',
      },
      [
        el('div', { display: 'flex', alignItems: 'center', height: 44 }, [
          el('div', {
            display: 'flex',
            width: 40,
            height: 30,
            borderRadius: 8,
            border: `5px solid ${accent}`,
          }),
          el(
            'div',
            { display: 'flex', marginLeft: 20, fontSize: 26, fontWeight: 400, color: theme.body },
            label,
          ),
        ]),

        el('div', { display: 'flex', flexDirection: 'column' }, [
          el(
            'div',
            {
              display: 'flex',
              fontSize: title.length > 60 ? 62 : 78,
              fontWeight: 700,
              color: theme.title,
              lineHeight: 1.08,
              letterSpacing: '-0.035em',
              maxWidth: 1000,
            },
            title,
          ),
          el(
            'div',
            {
              display: 'flex',
              marginTop: subtitle ? 26 : 0,
              fontSize: 32,
              fontWeight: 400,
              color: theme.body,
              lineHeight: 1.35,
              maxWidth: 940,
            },
            subtitle,
          ),
        ]),

        el('div', {
          display: 'flex',
          width: 160,
          height: 10,
          borderRadius: 5,
          backgroundColor: accent,
        }),
      ],
    );

    // Render to bytes rather than using ImageResponse. ImageResponse hands back
    // a streaming body, so a failure inside the renderer happens after this
    // function has already returned and never reaches the catch below: the
    // caller just gets an empty 500 with no way to tell what went wrong.
    const { image } = await render(tree as never, {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        font(assets, url.origin, 'Archivo-Bold.ttf', 700),
        font(assets, url.origin, 'Archivo-Regular.ttf', 400),
      ],
    }).asPng();

    // Copy the bytes out of WASM memory before handing them to the platform.
    // The renderer returns a view into the WASM instance's linear memory, and
    // that memory can be freed or grown once this function returns, which
    // detaches the view. The handler then reports success while the response
    // body fails on its way out, producing an empty 500 with no content type.
    const png = new Uint8Array(image);
    console.log(`og: rendered ${png.byteLength} bytes`);

    const response = new Response(png, {
      headers: {
        'content-type': 'image/png',
        'content-length': String(png.byteLength),
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });

    if (cache) await cache.put(request, response.clone());
    return response;
  } catch (err) {
    return new Response(`Could not render the image: ${(err as Error).message}`, {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    });
  }
};
