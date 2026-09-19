/**
 * Per-platform unfurl specifications.
 *
 * This table is the single source of truth for the whole product: the audit
 * engine reads it to grade a page, the preview renderers read it to truncate
 * text the way each platform really does, and the programmatic SEO pages are
 * generated from it. Adding a platform here adds it everywhere.
 *
 * Tag arrays are in resolution order. The first tag present on the page wins,
 * which is how the real crawlers behave.
 */

export interface ImageSpec {
  /** What the platform's own docs recommend. */
  recommended: { width: number; height: number };
  /** Below this the platform degrades to a small/no-image card. */
  minimum: { width: number; height: number };
  aspectRatio: string;
  maxBytes: number;
  formats: string[];
}

export interface Platform {
  id: string;
  name: string;
  /** Short label used in the preview tab strip. */
  short: string;
  brandColor: string;
  titleTags: string[];
  descriptionTags: string[];
  imageTags: string[];
  /** Characters shown before the platform truncates with an ellipsis. */
  titleLimit: number;
  descriptionLimit: number;
  image: ImageSpec;
  /** Whether the card renders at all with no image. */
  degradesWithoutImage: boolean;
  /**
   * The non-obvious failure modes. This is the part people actually search
   * for, and the part the official docs bury.
   */
  gotchas: string[];
  docsUrl: string;
}

const OG_TITLE = ['og:title', 'title'];
const OG_DESC = ['og:description', 'description'];
const OG_IMAGE = ['og:image:secure_url', 'og:image:url', 'og:image'];

export const PLATFORMS: Platform[] = [
  {
    id: 'x',
    name: 'X (Twitter)',
    short: 'X',
    brandColor: '#000000',
    titleTags: ['twitter:title', ...OG_TITLE],
    descriptionTags: ['twitter:description', ...OG_DESC],
    imageTags: ['twitter:image', 'twitter:image:src', ...OG_IMAGE],
    titleLimit: 70,
    descriptionLimit: 200,
    image: {
      recommended: { width: 1200, height: 628 },
      minimum: { width: 300, height: 157 },
      aspectRatio: '1.91:1',
      maxBytes: 5 * 1024 * 1024,
      formats: ['JPG', 'PNG', 'WEBP', 'GIF'],
    },
    degradesWithoutImage: false,
    gotchas: [
      'Without `twitter:card`, X renders a bare link with no card at all. It does not infer the card type from your Open Graph tags.',
      'X retired its public Card Validator, so there is no first-party way left to preview a card before posting.',
      'X caches aggressively and offers no manual purge. Changing an image at the same URL may not take effect for days. Publish at a new filename instead.',
      'Animated GIFs render as a still first frame.',
      'If the page blocks the `Twitterbot` user agent in robots.txt, the card silently fails with no error shown to you.',
    ],
    docsUrl: 'https://developer.x.com/en/docs/x-for-websites/cards/overview/abouts-cards',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    short: 'Facebook',
    brandColor: '#0866FF',
    titleTags: OG_TITLE,
    descriptionTags: OG_DESC,
    imageTags: OG_IMAGE,
    titleLimit: 88,
    descriptionLimit: 300,
    image: {
      recommended: { width: 1200, height: 630 },
      minimum: { width: 200, height: 200 },
      aspectRatio: '1.91:1',
      maxBytes: 8 * 1024 * 1024,
      formats: ['JPG', 'PNG', 'WEBP', 'GIF'],
    },
    degradesWithoutImage: true,
    gotchas: [
      'Facebook caches the first scrape effectively forever. Fixing your tags changes nothing until the cache is purged through the Sharing Debugger.',
      'The Sharing Debugger now requires a logged-in Facebook developer account, so there is no anonymous way to force a re-scrape.',
      'Images under 200x200 are dropped entirely and the link falls back to a text-only card.',
      'A relative `og:image` path is not resolved. The URL must be absolute and include the protocol.',
      'Images behind authentication or hotlink protection fail silently, because the crawler is anonymous.',
    ],
    docsUrl: 'https://developers.facebook.com/docs/sharing/webmasters/',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    short: 'LinkedIn',
    brandColor: '#0A66C2',
    titleTags: OG_TITLE,
    descriptionTags: OG_DESC,
    imageTags: OG_IMAGE,
    titleLimit: 119,
    descriptionLimit: 250,
    image: {
      recommended: { width: 1200, height: 627 },
      minimum: { width: 640, height: 360 },
      aspectRatio: '1.91:1',
      maxBytes: 5 * 1024 * 1024,
      formats: ['JPG', 'PNG', 'GIF'],
    },
    degradesWithoutImage: true,
    gotchas: [
      'LinkedIn caches a URL for roughly 7 days with no way to purge it. Ship your tags before you post, not after.',
      'A trailing `?` or an added UTM parameter creates a new cache entry, which is the usual workaround for a bad cached preview.',
      'LinkedIn ignores `twitter:` tags completely. Open Graph tags are the only ones it reads.',
      'Images narrower than 640px are shown as a small square thumbnail beside the text rather than a full-width banner.',
      'WEBP is not reliably supported. Serve JPG or PNG.',
    ],
    docsUrl: 'https://www.linkedin.com/help/linkedin/answer/a521928',
  },
  {
    id: 'slack',
    name: 'Slack',
    short: 'Slack',
    brandColor: '#4A154B',
    titleTags: OG_TITLE,
    descriptionTags: OG_DESC,
    imageTags: OG_IMAGE,
    titleLimit: 75,
    descriptionLimit: 300,
    image: {
      recommended: { width: 1200, height: 630 },
      minimum: { width: 200, height: 200 },
      aspectRatio: '1.91:1',
      maxBytes: 5 * 1024 * 1024,
      formats: ['JPG', 'PNG', 'GIF', 'WEBP'],
    },
    degradesWithoutImage: true,
    gotchas: [
      'Slack reads Open Graph first but falls back to `twitter:` tags, so a Twitter-only page still unfurls.',
      'The colored bar down the left of the unfurl comes from `theme-color`. Without it the bar is grey.',
      'Slack will not unfurl a link that requires authentication, which is why staging and intranet links appear bare.',
      'Only the first link in a message unfurls when several are posted together.',
      'Slack respects `og:site_name` and shows it above the title. Omitting it wastes a free branding slot.',
    ],
    docsUrl: 'https://api.slack.com/reference/messaging/link-unfurling',
  },
  {
    id: 'discord',
    name: 'Discord',
    short: 'Discord',
    brandColor: '#5865F2',
    titleTags: OG_TITLE,
    descriptionTags: OG_DESC,
    imageTags: OG_IMAGE,
    titleLimit: 80,
    descriptionLimit: 350,
    image: {
      recommended: { width: 1200, height: 630 },
      minimum: { width: 200, height: 200 },
      aspectRatio: '1.91:1',
      maxBytes: 8 * 1024 * 1024,
      formats: ['JPG', 'PNG', 'GIF', 'WEBP'],
    },
    degradesWithoutImage: true,
    gotchas: [
      'The accent stripe on the embed is set by `theme-color`. It is the cheapest branding win available.',
      'Discord needs `twitter:card` set to `summary_large_image` to show a full-width image; with Open Graph alone it renders a small thumbnail.',
      'Embeds are suppressed entirely if the message wraps the URL in angle brackets.',
      'Discord proxies every image through its own CDN, so images that block hotlinking break.',
      'Unlike most platforms Discord renders the description at close to full length, so short descriptions look sparse.',
    ],
    docsUrl: 'https://discord.com/developers/docs/resources/message#embed-object',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    short: 'WhatsApp',
    brandColor: '#25D366',
    titleTags: OG_TITLE,
    descriptionTags: OG_DESC,
    imageTags: OG_IMAGE,
    titleLimit: 65,
    descriptionLimit: 160,
    image: {
      recommended: { width: 1200, height: 630 },
      minimum: { width: 300, height: 200 },
      aspectRatio: '1.91:1',
      maxBytes: 300 * 1024,
      formats: ['JPG', 'PNG'],
    },
    degradesWithoutImage: true,
    gotchas: [
      'WhatsApp enforces a hard ~300KB ceiling on `og:image`. This is by far the most common reason a preview works everywhere else but not here.',
      'Images are re-encoded to a small square thumbnail, so fine text in the image becomes unreadable.',
      'The preview is generated on the sender device before the message is sent, so the sender and receiver can see different previews.',
      'WEBP images are not rendered in link previews.',
      'A page served over plain HTTP often produces no preview on mobile.',
    ],
    docsUrl: 'https://developers.facebook.com/docs/sharing/webmasters/',
  },
  {
    id: 'imessage',
    name: 'iMessage',
    short: 'iMessage',
    brandColor: '#34C759',
    titleTags: OG_TITLE,
    descriptionTags: OG_DESC,
    imageTags: ['og:image', 'twitter:image', 'apple-touch-icon'],
    titleLimit: 60,
    descriptionLimit: 100,
    image: {
      recommended: { width: 1200, height: 630 },
      minimum: { width: 300, height: 200 },
      aspectRatio: '1.91:1',
      maxBytes: 10 * 1024 * 1024,
      formats: ['JPG', 'PNG'],
    },
    degradesWithoutImage: true,
    gotchas: [
      'iMessage shows the title and image but usually suppresses the description, so the title has to carry the whole message.',
      'Fetching is done by the device rather than a central crawler, so there is no shared cache to purge, and no way to force a refresh.',
      'A missing `og:image` falls back to `apple-touch-icon`, which is square and usually looks wrong stretched into a banner.',
      'Very large images delay the preview noticeably on cellular connections.',
      'Link previews are skipped entirely when Low Data Mode is on.',
    ],
    docsUrl: 'https://developer.apple.com/documentation/linkpresentation',
  },
  {
    id: 'google',
    name: 'Google Search',
    short: 'Google',
    brandColor: '#4285F4',
    titleTags: ['title', 'og:title'],
    descriptionTags: ['description', 'og:description'],
    imageTags: OG_IMAGE,
    titleLimit: 60,
    descriptionLimit: 155,
    image: {
      recommended: { width: 1200, height: 630 },
      minimum: { width: 1200, height: 630 },
      aspectRatio: '1.91:1',
      maxBytes: 5 * 1024 * 1024,
      formats: ['JPG', 'PNG', 'WEBP'],
    },
    degradesWithoutImage: true,
    gotchas: [
      'Google treats your title and description as a suggestion and rewrites them for roughly two-thirds of queries.',
      'Titles are truncated by pixel width (~580px), not character count, so wide capitals truncate sooner than the character limit implies.',
      'A missing or self-conflicting `canonical` tag splits ranking signals between duplicate URLs.',
      'Images need to be at least 1200px wide to be eligible for the large image treatment in Discover.',
      'The description is not a ranking factor, but it drives click-through rate, which is.',
    ],
    docsUrl: 'https://developers.google.com/search/docs/appearance/snippet',
  },
];

export const PLATFORM_IDS = PLATFORMS.map((p) => p.id);

export function getPlatform(id: string): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

/**
 * Truncate the way the platforms do: cut at the limit, back off to the last
 * word boundary so we don't slice a word in half, then add an ellipsis.
 */
export function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  const body = lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut;
  return body.trimEnd() + '…';
}
