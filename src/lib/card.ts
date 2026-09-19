import { truncate, type Platform } from './platforms';
import { resolveForTags, type MetaTags } from './metadata';

export interface CardData {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  domain: string;
  themeColor: string | null;
  cardType: string | null;
}

/** Escape everything that goes into markup. All of this is attacker controlled. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only ever put an http(s) image into the DOM, never a javascript: or data: URL. */
function safeImage(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Resolve what one specific platform would show, following its own tag
 * priority. This is why LinkedIn never picks up a twitter: tag and why X
 * prefers its own: each platform reads a different list.
 */
export function cardDataFor(platform: Platform, tags: MetaTags, pageUrl: string): CardData {
  const title = resolveForTags(tags, platform.titleTags)?.value ?? null;
  const description = resolveForTags(tags, platform.descriptionTags)?.value ?? null;
  const image = safeImage(resolveForTags(tags, platform.imageTags)?.value ?? null);

  return {
    title,
    description,
    image,
    siteName: tags['og:site_name'] ?? null,
    domain: hostOf(tags['og:url'] ?? pageUrl),
    themeColor: /^#[0-9a-f]{3,8}$/i.test(tags['theme-color'] ?? '') ? tags['theme-color']! : null,
    cardType: tags['twitter:card'] ?? null,
  };
}

function imageBlock(data: CardData, className: string): string {
  if (!data.image) {
    return `<div class="${className} uf-noimg"><span>No og:image</span></div>`;
  }
  return `<div class="${className}"><img src="${escapeHtml(data.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>`;
}

/**
 * Render one platform's unfurl.
 *
 * Each platform gets its own markup rather than a shared card with a skin,
 * because the differences are the entire point of the tool: X hides the
 * description, Google shows no image at all, Discord goes dark.
 */
export function renderCard(platform: Platform, data: CardData): string {
  const title = data.title ? escapeHtml(truncate(data.title, platform.titleLimit)) : '';
  const desc = data.description ? escapeHtml(truncate(data.description, platform.descriptionLimit)) : '';
  const domain = escapeHtml(data.domain);
  const site = data.siteName ? escapeHtml(data.siteName) : domain;
  const accent = data.themeColor ? escapeHtml(data.themeColor) : '#5b6779';

  const missingTitle = `<span class="uf-missing">No title tag</span>`;
  const t = title || missingTitle;

  switch (platform.id) {
    case 'x': {
      // X shows no description at all on a large image card, and overlays the
      // domain on the image itself.
      const large = data.cardType !== 'summary';
      if (!data.cardType) {
        return `<div class="uf uf-x uf-x-bare"><div class="uf-x-plain">https://${domain}</div>
          <p class="uf-nocard">X renders no card at all without <code>twitter:card</code>.</p></div>`;
      }
      if (!large) {
        return `<div class="uf uf-x uf-x-small">
          ${imageBlock(data, 'uf-x-thumb')}
          <div class="uf-x-body"><span class="uf-domain">${domain}</span><div class="uf-title">${t}</div><div class="uf-desc">${desc}</div></div>
        </div>`;
      }
      return `<div class="uf uf-x">
        ${imageBlock(data, 'uf-x-img')}
        <div class="uf-x-overlay">${domain}</div>
        <div class="uf-x-foot"><div class="uf-title">${t}</div></div>
      </div>`;
    }

    case 'facebook':
      return `<div class="uf uf-fb">
        ${imageBlock(data, 'uf-fb-img')}
        <div class="uf-fb-body">
          <span class="uf-domain">${domain.toUpperCase()}</span>
          <div class="uf-title">${t}</div>
          <div class="uf-desc">${desc}</div>
        </div>
      </div>`;

    case 'linkedin':
      return `<div class="uf uf-li">
        ${imageBlock(data, 'uf-li-img')}
        <div class="uf-li-body">
          <div class="uf-title">${t}</div>
          <span class="uf-domain">${domain}</span>
        </div>
      </div>`;

    case 'slack':
      return `<div class="uf uf-slack" style="--accent:${accent}">
        <div class="uf-slack-body">
          <div class="uf-slack-site">${site}</div>
          <div class="uf-title">${t}</div>
          <div class="uf-desc">${desc}</div>
          ${imageBlock(data, 'uf-slack-img')}
        </div>
      </div>`;

    case 'discord':
      return `<div class="uf uf-dc" style="--accent:${accent}">
        <div class="uf-dc-body">
          <div class="uf-dc-site">${site}</div>
          <div class="uf-title">${t}</div>
          <div class="uf-desc">${desc}</div>
          ${imageBlock(data, 'uf-dc-img')}
        </div>
      </div>`;

    case 'whatsapp':
      return `<div class="uf uf-wa">
        <div class="uf-wa-bubble">
          <div class="uf-wa-card">
            ${imageBlock(data, 'uf-wa-img')}
            <div class="uf-wa-body">
              <div class="uf-title">${t}</div>
              <div class="uf-desc">${desc}</div>
              <span class="uf-domain">${domain}</span>
            </div>
          </div>
          <div class="uf-wa-link">https://${domain}</div>
        </div>
      </div>`;

    case 'imessage':
      // iMessage suppresses the description, so the title carries everything.
      return `<div class="uf uf-im">
        <div class="uf-im-bubble">
          ${imageBlock(data, 'uf-im-img')}
          <div class="uf-im-body">
            <div class="uf-title">${t}</div>
            <span class="uf-domain">${domain}</span>
          </div>
        </div>
      </div>`;

    case 'google':
      // No image in the main result. Title, breadcrumb, snippet.
      return `<div class="uf uf-g">
        <div class="uf-g-head">
          <span class="uf-g-favicon"></span>
          <div><div class="uf-g-site">${site}</div><div class="uf-g-url">https://${domain}</div></div>
        </div>
        <div class="uf-g-title">${data.title ? escapeHtml(truncate(data.title, platform.titleLimit)) : 'No title tag'}</div>
        <div class="uf-g-desc">${desc || '<span class="uf-missing">Google will write its own snippet.</span>'}</div>
      </div>`;

    default:
      return `<div class="uf"><div class="uf-title">${t}</div></div>`;
  }
}
