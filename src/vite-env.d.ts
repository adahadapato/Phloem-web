/// <reference types="vite/client" />

/** Settings read from the .env files (see .env.development / .env.production). */
interface ImportMetaEnv {
  /** The Phloem API's address, without a trailing slash, e.g. "https://phloemapi.phloemmarket.com". */
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
