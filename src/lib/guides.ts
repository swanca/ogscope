/**
 * Long form guide content for the per platform pages.
 *
 * Kept apart from the spec table in platforms.ts on purpose: that file is data
 * the audit engine reads, this one is prose people read. They change for
 * different reasons and at different times.
 *
 * The refresh instructions matter more than anything else here. "How do I clear
 * the cache" is the question people arrive with once they have already fixed
 * their tags and nothing changed.
 */

export interface Faq {
  q: string;
  a: string;
}

export interface Guide {
  /** Sentence that opens the page. Written for someone whose preview is broken right now. */
  intro: string;
  /** What to do when the tags are right but the old preview is still showing. */
  refreshTitle: string;
  refreshSteps: string[];
  refreshNote: string;
  faqs: Faq[];
}

export const GUIDES: Record<string, Guide> = {
  x: {
    intro:
      'X is the strictest of the major platforms about one specific thing: it will not build a card from Open Graph tags alone. If your post shows a plain blue link with no image, this is almost always why.',
    refreshTitle: 'Getting X to pick up your changes',
    refreshSteps: [
      'X retired its public Card Validator, so there is no button to press any more.',
      'Post the link in a direct message to yourself first. The card is generated the same way, without publishing anything.',
      'If the old image is stuck, change the image filename rather than replacing the file at the same URL. A new URL bypasses the cache completely.',
      'Check that robots.txt does not block Twitterbot, which is a common side effect of a blanket bot rule.',
    ],
    refreshNote:
      'X caches for roughly a week and offers no way to purge it, so get the tags right before the post goes out.',
    faqs: [
      {
        q: 'Why is my X card not showing an image?',
        a: 'The usual cause is a missing twitter:card tag. X does not fall back to Open Graph to decide the card type, so without twitter:card set to summary_large_image it renders a plain link. The next most common cause is an image under 300x157, which X drops.',
      },
      {
        q: 'What is the correct X card image size?',
        a: 'Use 1200x628 for a summary_large_image card, which is a 1.91:1 ratio. The minimum is 300x157 and the file has to be under 5MB. JPG, PNG, WEBP and GIF all work, though a GIF only shows its first frame.',
      },
      {
        q: 'How do I preview an X card now that the Card Validator is gone?',
        a: 'X shut down its validator and never replaced it. Paste the link into a direct message to yourself to see the real card without posting, or use a third party checker that reads the same tags X does.',
      },
    ],
  },

  facebook: {
    intro:
      'Facebook is unusual in that it caches the very first version of your page it ever sees, more or less permanently. Most Facebook preview problems are not tag problems at all, they are cache problems.',
    refreshTitle: 'Clearing the Facebook cache',
    refreshSteps: [
      'Open the Sharing Debugger at developers.facebook.com/tools/debug.',
      'Paste your URL and press Debug.',
      'Press Scrape Again to force a fresh fetch. The preview updates immediately.',
      'If the image still looks wrong, scrape once more. Facebook sometimes needs a second pass to pick up a new image.',
    ],
    refreshNote:
      'The Sharing Debugger now requires a logged in Facebook developer account, so there is no anonymous way to force a re-scrape.',
    faqs: [
      {
        q: 'Why is Facebook showing an old image for my link?',
        a: 'Facebook caches the first scrape of a URL and keeps it. Updating your og:image does nothing until you force a re-scrape through the Sharing Debugger, or share the link with a query parameter appended so Facebook treats it as a new URL.',
      },
      {
        q: 'What size should a Facebook og:image be?',
        a: 'Use 1200x630, a 1.91:1 ratio, under 8MB. Anything below 200x200 is dropped and the post falls back to a text only card.',
      },
      {
        q: 'Why is my og:image not loading on Facebook?',
        a: 'The three usual causes are a relative path instead of an absolute URL, an image behind authentication or hotlink protection, and mixed content where the page is https but the image is http. The Facebook crawler is anonymous, so anything it cannot fetch without a login simply fails.',
      },
    ],
  },

  linkedin: {
    intro:
      'LinkedIn caches a URL for about seven days and gives you no way to clear it. That single fact causes most LinkedIn preview complaints, and it means the order of operations matters: fix the tags first, post second.',
    refreshTitle: 'Working around the LinkedIn cache',
    refreshSteps: [
      'Run your URL through the Post Inspector at linkedin.com/post-inspector.',
      'If the preview is still wrong, add a query parameter such as ?v=2 to the end of your URL.',
      'LinkedIn treats that as a completely new URL with no cache entry, so it fetches your current tags.',
      'Use the new URL in your post. A tracking parameter you were adding anyway works just as well.',
    ],
    refreshNote:
      'There is no purge button. The query parameter trick is the only reliable way to get a fresh preview inside the seven day window.',
    faqs: [
      {
        q: 'How do I clear the LinkedIn link preview cache?',
        a: 'You cannot clear it directly. LinkedIn holds a preview for roughly seven days. The standard workaround is to append a query parameter such as ?v=2 to the URL, which LinkedIn sees as a new address and scrapes fresh.',
      },
      {
        q: 'What image size does LinkedIn use for link previews?',
        a: 'Use 1200x627 at a 1.91:1 ratio, under 5MB, as JPG or PNG. Below 640px wide LinkedIn switches to a small square thumbnail beside the text instead of a full width banner.',
      },
      {
        q: 'Does LinkedIn read twitter:card tags?',
        a: 'No. LinkedIn reads Open Graph tags only. If your page has twitter:image but no og:image, LinkedIn shows no image at all.',
      },
    ],
  },

  slack: {
    intro:
      'Slack is the most forgiving platform on this list. It reads Open Graph, falls back to Twitter tags, and unfurls almost anything public. When a Slack unfurl fails it is nearly always because the page is not reachable without logging in.',
    refreshTitle: 'Refreshing a Slack unfurl',
    refreshSteps: [
      'Slack caches an unfurl for about 30 minutes, much shorter than the other platforms.',
      'Delete the message and post the link again after the cache expires.',
      'To test immediately, add a harmless query parameter to the URL.',
      'For a private or staging site, Slack cannot unfurl at all unless you install an app that authenticates for it.',
    ],
    refreshNote: 'The short cache means Slack is the fastest platform to iterate against while fixing tags.',
    faqs: [
      {
        q: 'Why is my link not unfurling in Slack?',
        a: 'Most often the page requires authentication, so Slack cannot fetch it. Staging sites, intranet pages and anything behind a login will post as a bare link. Slack also unfurls only the first link when a message contains several.',
      },
      {
        q: 'How do I change the colour of the bar on a Slack unfurl?',
        a: 'Set a theme-color meta tag. Slack uses it for the coloured bar down the left of the unfurl. Without it the bar is grey.',
      },
      {
        q: 'Does Slack support Twitter card tags?',
        a: 'Yes. Slack reads Open Graph first and falls back to twitter: tags, so a page tagged only for X still unfurls correctly in Slack.',
      },
    ],
  },

  discord: {
    intro:
      'Discord renders the richest embed of any platform on this list. It shows more description text than anyone else and colours the embed stripe from your theme-color, which makes it the easiest place to get a branded preview.',
    refreshTitle: 'Refreshing a Discord embed',
    refreshSteps: [
      'Discord caches embeds for a few minutes at most.',
      'Delete and repost the message to trigger a fresh fetch.',
      'If the image still fails, check that your host allows hotlinking, since Discord proxies every image through its own CDN.',
      'Wrapping a URL in angle brackets suppresses the embed entirely, which is worth checking if nothing appears at all.',
    ],
    refreshNote: 'Discord has the shortest cache of any platform here, so changes show up almost immediately.',
    faqs: [
      {
        q: 'Why is my Discord embed showing a small image instead of a large one?',
        a: 'Discord needs twitter:card set to summary_large_image to render a full width image. With Open Graph tags alone it falls back to a small thumbnail on the right of the embed.',
      },
      {
        q: 'How do I set the colour of a Discord embed?',
        a: 'Add a theme-color meta tag to your page. Discord uses it for the vertical accent stripe on the left edge of the embed.',
      },
      {
        q: 'Why does my image not load in a Discord embed?',
        a: 'Discord proxies images through its own CDN, so any host that blocks hotlinking or requires a referer header will fail. Serve the social image from a host that allows anonymous requests.',
      },
    ],
  },

  whatsapp: {
    intro:
      'WhatsApp is where previews break silently. It enforces a hard file size ceiling of around 300KB on og:image, far below every other platform, so a card that looks perfect everywhere else can show nothing at all here.',
    refreshTitle: 'Getting a WhatsApp preview to appear',
    refreshSteps: [
      'Compress your og:image to under 300KB. This alone fixes most WhatsApp preview failures.',
      'Serve JPG or PNG. WhatsApp does not render WEBP in link previews.',
      'Make sure the page is served over https, since plain http often produces no preview on mobile.',
      'Clear the chat or send the link to a different conversation to bypass the local preview cache.',
    ],
    refreshNote:
      'The preview is generated on the sending device, so the sender and the recipient can genuinely see different previews for the same link.',
    faqs: [
      {
        q: 'Why is there no preview when I send my link on WhatsApp?',
        a: 'The most common cause by far is an og:image over roughly 300KB. WhatsApp silently shows no preview rather than reporting an error. Compress the image below 300KB and the preview appears.',
      },
      {
        q: 'What image size works best for WhatsApp link previews?',
        a: 'Keep the dimensions at 1200x630 but compress hard so the file stays under 300KB. WhatsApp re-encodes it to a small square thumbnail anyway, so fine detail and small text are lost.',
      },
      {
        q: 'Does WhatsApp support WEBP images in link previews?',
        a: 'No. Serve a JPG or PNG for og:image even if the rest of your site uses WEBP.',
      },
    ],
  },

  imessage: {
    intro:
      'iMessage builds its preview on the device rather than on a server, and it drops the description entirely. Your title has to carry the whole message, because it is often the only text shown.',
    refreshTitle: 'Refreshing an iMessage preview',
    refreshSteps: [
      'There is no central cache to clear, because each device fetches the page itself.',
      'That also means there is no way to force a refresh on a device you do not control.',
      'On your own device, delete the message and send the link again.',
      'Previews are skipped entirely in Low Data Mode, which is worth ruling out before debugging tags.',
    ],
    refreshNote: 'Device side fetching means previews can differ between two people looking at the same message.',
    faqs: [
      {
        q: 'Why does my iMessage link preview show no description?',
        a: 'iMessage deliberately suppresses the description for most links and shows only the image, title and domain. Write a title that stands on its own rather than relying on the description to finish the thought.',
      },
      {
        q: 'Why is my iMessage preview showing a square icon instead of a banner?',
        a: 'With no og:image, iMessage falls back to your apple-touch-icon, which is square. Add a proper 1200x630 og:image to get the wide banner treatment.',
      },
      {
        q: 'How do I force iMessage to refresh a link preview?',
        a: 'You cannot force it on a device you do not control, since each device fetches the page independently. On your own device, delete the message and resend the link.',
      },
    ],
  },

  google: {
    intro:
      'Google is the one platform here that treats your tags as a suggestion. It rewrites titles and descriptions for a large share of queries based on what the searcher typed, so the goal is to give it something good enough to keep rather than something it feels the need to replace.',
    refreshTitle: 'Getting Google to re-crawl',
    refreshSteps: [
      'Open Google Search Console and use the URL Inspection tool.',
      'Paste your URL and choose Request Indexing.',
      'Recrawls usually happen within a few days, though Google gives no guarantee.',
      'Make sure the page is not blocked in robots.txt and has no noindex tag, or the request will be ignored.',
    ],
    refreshNote:
      'Google rewrites the displayed title for roughly two thirds of queries, so an exact match to your tag is never guaranteed.',
    faqs: [
      {
        q: 'Why is Google showing a different title than the one I set?',
        a: 'Google rewrites titles when it judges another wording to be a better match for the query, or when your title is too long, keyword stuffed, or duplicated across pages. A clear, unique title under about 60 characters is the most likely to survive.',
      },
      {
        q: 'How long should a meta description be?',
        a: 'Around 155 characters. Google truncates by pixel width rather than character count, so wide capitals cut off sooner. The description is not a ranking factor, but it drives click through rate, which is.',
      },
      {
        q: 'Does og:image affect Google Search results?',
        a: 'Not in the standard blue link result, which shows no image from your tags. It does matter for Google Discover, where an image needs to be at least 1200px wide to qualify for the large image treatment.',
      },
    ],
  },
};
