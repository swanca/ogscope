/// <reference types="astro/client" />

declare module '*.wasm' {
  const module: WebAssembly.Module;
  export default module;
}

interface ImportMetaEnv {
  readonly PUBLIC_STRIPE_API_LINK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
