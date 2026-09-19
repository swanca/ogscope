import type { APIRoute } from 'astro';
import { ImageResponse, CustomFont } from '@cf-wasm/og';

export const prerender = false;

const WIDTH = 1200;
const HEIGHT = 630;

/** Palette matches the site. Dark by default because it reads better in a feed. */
const THEMES = {
  dark: { bg: '#0b111b', grid: '#1b2537', title: '#ffffff', body: '#98a4b8', accent: '#5b3df5' },
  light: { bg: '#eef1f6', grid: '#dbe1ea', title: '#0b111b', body: '#5a6779', accent: '#5b3df5' },
} as const;

/**
 * Fonts come from our own static assets rather than the bundle, so they cost
 * nothing against the Worker script size limit and nothing is fetched from a
 * third party at render time.
 */
function font(origin: string, file: string, weight: 400 | 700): CustomFont {
  return new CustomFont('Archivo', () => fetch(new URL(`/fonts/${file}`, origin)).then((r) => r.arrayBuffer()), {
    weight,
    style: 'normal',
  });
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

    const response = await ImageResponse.async(tree as never, {
      width: WIDTH,
      height: HEIGHT,
      format: 'png',
      fonts: [font(url.origin, 'Archivo-Bold.ttf', 700), font(url.origin, 'Archivo-Regular.ttf', 400)],
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
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
