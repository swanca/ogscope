import { PLATFORMS } from './platforms';
import { resolveForTags, type MetaTags } from './metadata';

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  id: string;
  severity: Severity;
  title: string;
  /** Why this matters, in plain language. */
  detail: string;
  /** A line of HTML the user can paste into their head, or null. */
  fix: string | null;
  /** Platform ids this actually affects, so we never cry wolf. */
  platforms: string[];
}

export interface ImageProbe {
  ok: boolean;
  url: string;
  bytes?: number;
  width?: number;
  height?: number;
  contentType?: string;
  error?: string;
}

export interface AuditInput {
  tags: MetaTags;
  pageUrl: string;
  image: ImageProbe | null;
  relativeUrlKeys?: string[];
}

export interface AuditResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: Issue[];
}

const VALID_CARD_TYPES = ['summary', 'summary_large_image', 'app', 'player'];

const PENALTY: Record<Severity, number> = { error: 15, warning: 6, info: 2 };
const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/** The widest image dimensions any platform will accept before degrading. */
const MIN_WIDTH = 300;
const MIN_HEIGHT = 157;
/** Platforms crop toward 1.91:1. Outside this band the crop gets ugly. */
const RATIO_MIN = 1.6;
const RATIO_MAX = 2.3;

const ALL = PLATFORMS.map((p) => p.id);

function grade(score: number): AuditResult['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Grade a page against every platform at once.
 *
 * Each check names the platforms it actually affects, which is the whole point:
 * a generic "add Open Graph tags" warning is useless, but "this breaks on
 * WhatsApp and nowhere else" tells you whether to care.
 */
export function auditPage({ tags, pageUrl, image, relativeUrlKeys = [] }: AuditInput): AuditResult {
  const issues: Issue[] = [];
  const add = (issue: Issue) => issues.push(issue);

  const title = resolveForTags(tags, ['og:title', 'title'])?.value ?? null;
  const description = resolveForTags(tags, ['og:description', 'description'])?.value ?? null;
  const imageTag = resolveForTags(tags, [
    'og:image',
    'og:image:secure_url',
    'og:image:url',
    'twitter:image',
    'twitter:image:src',
  ]);
  const card = tags['twitter:card'];

  if (!title) {
    add({
      id: 'missing-title',
      severity: 'error',
      title: 'No title tag',
      detail:
        'Every platform needs a title. Without one your link shows up as a bare URL, which almost nobody clicks.',
      fix: '<meta property="og:title" content="Your page title">',
      platforms: ALL,
    });
  }

  if (!imageTag) {
    add({
      id: 'missing-image',
      severity: 'error',
      title: 'No og:image',
      detail:
        'This is the single biggest difference between a link people click and one they scroll past. Without it every platform falls back to a text only card.',
      fix: '<meta property="og:image" content="https://yoursite.com/og-image.png">',
      platforms: ALL,
    });
  }

  if (!description) {
    add({
      id: 'missing-description',
      severity: 'warning',
      title: 'No description',
      detail:
        'The card still renders, but the space under your title sits empty and Google writes its own snippet instead of yours.',
      fix: '<meta property="og:description" content="A short summary of the page.">',
      platforms: ALL,
    });
  }

  if (!tags['canonical']) {
    add({
      id: 'missing-canonical',
      severity: 'warning',
      title: 'No canonical URL',
      detail:
        'Without a canonical, tracking parameters and trailing slashes create duplicate URLs that split your ranking signals between them.',
      fix: '<link rel="canonical" href="https://yoursite.com/page">',
      platforms: ['google'],
    });
  }

  if (!card) {
    add({
      id: 'missing-twitter-card',
      severity: 'warning',
      title: 'No twitter:card',
      detail:
        'X does not infer a card type from your Open Graph tags. With this tag missing it renders a plain link and ignores your image entirely.',
      fix: '<meta name="twitter:card" content="summary_large_image">',
      platforms: ['x'],
    });
  } else if (!VALID_CARD_TYPES.includes(card)) {
    add({
      id: 'invalid-twitter-card',
      severity: 'warning',
      title: `twitter:card value "${card}" is not recognised`,
      detail: `X accepts only ${VALID_CARD_TYPES.join(', ')}. Anything else is treated as if the tag were missing.`,
      fix: '<meta name="twitter:card" content="summary_large_image">',
      platforms: ['x'],
    });
  } else if (card === 'summary') {
    add({
      id: 'small-twitter-card',
      severity: 'info',
      title: 'Using the small summary card',
      detail:
        'A summary card shows a small square thumbnail beside the text. summary_large_image gives you the full width banner, which draws far more attention.',
      fix: '<meta name="twitter:card" content="summary_large_image">',
      platforms: ['x'],
    });
  }

  // Image checks only make sense once an image tag exists. Reporting a broken
  // image on a page with no image tag would just be noise on top of the error.
  if (imageTag) {
    const relativeImage = relativeUrlKeys.find((k) => k.includes('image'));
    if (relativeImage) {
      add({
        id: 'relative-image-url',
        severity: 'error',
        title: 'og:image uses a relative path',
        detail:
          'Facebook does not resolve relative image paths and drops the image completely. The URL has to be absolute, including https://.',
        fix: '<meta property="og:image" content="https://yoursite.com/og-image.png">',
        platforms: ['facebook', 'whatsapp'],
      });
    }

    if (pageUrl.startsWith('https://') && imageTag.value.startsWith('http://')) {
      add({
        id: 'insecure-image',
        severity: 'warning',
        title: 'Image is served over http from an https page',
        detail:
          'Most crawlers refuse to load mixed content, so the image is dropped even though the URL works in a browser.',
        fix: '<meta property="og:image" content="https://yoursite.com/og-image.png">',
        platforms: ['facebook', 'x', 'linkedin', 'whatsapp'],
      });
    }

    if (image && !image.ok) {
      add({
        id: 'image-unreachable',
        severity: 'error',
        title: 'The image URL could not be fetched',
        detail: `We could not load the image${image.error ? ` (${image.error})` : ''}. Crawlers are anonymous, so an image behind a login, a firewall or hotlink protection fails for them even when it loads for you.`,
        fix: null,
        platforms: ALL,
      });
    }

    if (image?.ok) {
      const { width, height, bytes, contentType, url } = image;

      if (width && height) {
        if (width < MIN_WIDTH || height < MIN_HEIGHT) {
          const affected = PLATFORMS.filter(
            (p) => width < p.image.minimum.width || height < p.image.minimum.height,
          ).map((p) => p.id);
          add({
            id: 'image-too-small',
            severity: 'error',
            title: `Image is only ${width}x${height}`,
            detail:
              'Below the minimum size these platforms accept, the image is dropped and the card falls back to text. Use 1200x630.',
            fix: null,
            platforms: affected.length ? affected : ALL,
          });
        } else if (width < 1200) {
          add({
            id: 'image-below-recommended',
            severity: 'info',
            title: `Image is ${width}px wide, under the recommended 1200px`,
            detail:
              'It will render, but on high density screens it looks soft, and Google needs 1200px to consider it for the large image treatment.',
            fix: null,
            platforms: ['google', 'linkedin'],
          });
        }

        const ratio = width / height;
        if (ratio < RATIO_MIN || ratio > RATIO_MAX) {
          add({
            id: 'image-aspect-ratio',
            severity: 'warning',
            title: `Aspect ratio is ${ratio.toFixed(2)}:1, not the expected 1.91:1`,
            detail:
              'Platforms centre crop to 1.91:1. At this ratio the top and bottom of your image get cut off, which is how logos and text end up sliced in half.',
            fix: null,
            platforms: ALL,
          });
        }
      }

      if (bytes) {
        const tooHeavyFor = PLATFORMS.filter((p) => bytes > p.image.maxBytes).map((p) => p.id);
        if (tooHeavyFor.length) {
          add({
            id: 'image-too-heavy',
            severity: 'warning',
            title: `Image is ${Math.round(bytes / 1024)}KB`,
            detail:
              'WhatsApp enforces a hard 300KB ceiling and silently shows no preview above it. This is the usual reason a card works everywhere except WhatsApp.',
            fix: null,
            platforms: tooHeavyFor,
          });
        }
      }

      const isWebp = contentType?.includes('webp') || url.toLowerCase().endsWith('.webp');
      if (isWebp) {
        add({
          id: 'image-webp',
          severity: 'warning',
          title: 'Image is a WEBP file',
          detail:
            'LinkedIn and WhatsApp do not reliably render WEBP in link previews. Serve a JPG or PNG for the social image even if the rest of the site uses WEBP.',
          fix: null,
          platforms: ['linkedin', 'whatsapp'],
        });
      }
    }
  }

  if (title) {
    const truncatedOn = PLATFORMS.filter((p) => title.length > p.titleLimit).map((p) => p.id);
    if (truncatedOn.length) {
      add({
        id: 'title-too-long',
        severity: 'warning',
        title: `Title is ${title.length} characters`,
        detail: `It gets cut off on ${truncatedOn.length} of ${PLATFORMS.length} platforms. Front load the important words so the meaning survives truncation.`,
        fix: null,
        platforms: truncatedOn,
      });
    }
  }

  if (description) {
    if (description.length > 200) {
      const truncatedOn = PLATFORMS.filter((p) => description.length > p.descriptionLimit).map((p) => p.id);
      add({
        id: 'description-too-long',
        severity: 'warning',
        title: `Description is ${description.length} characters`,
        detail: 'Everything past the limit is replaced with an ellipsis, so the last sentence is usually wasted.',
        fix: null,
        platforms: truncatedOn.length ? truncatedOn : ALL,
      });
    } else if (description.length < 50) {
      add({
        id: 'description-too-short',
        severity: 'info',
        title: `Description is only ${description.length} characters`,
        detail:
          'There is room for around 155. A short description leaves the card looking half empty and wastes free space to sell the click.',
        fix: null,
        platforms: ALL,
      });
    }
  }

  if (!tags['theme-color']) {
    add({
      id: 'missing-theme-color',
      severity: 'info',
      title: 'No theme-color',
      detail:
        'Slack and Discord colour the accent bar of the unfurl with this. Without it you get a default grey stripe instead of your brand colour.',
      fix: '<meta name="theme-color" content="#000000">',
      platforms: ['slack', 'discord'],
    });
  }

  if (!tags['og:site_name']) {
    add({
      id: 'missing-site-name',
      severity: 'info',
      title: 'No og:site_name',
      detail: 'Slack and Facebook show this above the title. It is a free branding slot that most sites leave empty.',
      fix: '<meta property="og:site_name" content="Your Site">',
      platforms: ['slack', 'facebook'],
    });
  }

  if (!tags['og:type']) {
    add({
      id: 'missing-og-type',
      severity: 'info',
      title: 'No og:type',
      detail: 'Defaults to website. Setting it to article unlocks the author and published date fields on some platforms.',
      fix: '<meta property="og:type" content="website">',
      platforms: ['facebook', 'linkedin'],
    });
  }

  if (!tags['og:url']) {
    add({
      id: 'missing-og-url',
      severity: 'info',
      title: 'No og:url',
      detail:
        'This tells platforms which URL to treat as the canonical one when your page is shared with tracking parameters attached.',
      fix: '<meta property="og:url" content="https://yoursite.com/page">',
      platforms: ['facebook', 'linkedin'],
    });
  }

  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const penalty = issues.reduce((sum, i) => sum + PENALTY[i.severity], 0);
  const score = Math.max(0, 100 - penalty);

  return { score, grade: grade(score), issues };
}
