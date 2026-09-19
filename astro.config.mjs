import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://ogscope.app',
  output: 'static',
  adapter: cloudflare({ imageService: 'passthrough' }),
  build: { inlineStylesheets: 'always' },
  vite: {
    resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  },
});
