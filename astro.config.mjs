import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Read PUBLIC_SITE_URL from .env by hand.
 *
 * Astro loads .env into import.meta.env for pages, but this config file runs
 * before that happens, and `site` has to be correct here: canonical tags, og:url
 * and the sitemap are all built from it.
 */
function siteUrl() {
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL;
  if (existsSync('.env')) {
    const match = readFileSync('.env', 'utf8').match(/^PUBLIC_SITE_URL=(.+)$/m);
    if (match) return match[1].trim();
  }
  return 'https://ogscope.app';
}

export default defineConfig({
  site: siteUrl(),
  output: 'static',
  adapter: cloudflare({ imageService: 'passthrough' }),
  build: { inlineStylesheets: 'always' },
  vite: {
    resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  },
});
