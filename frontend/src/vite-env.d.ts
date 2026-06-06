/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_MARKET_OPEN_TIME?: string;
  readonly VITE_MARKET_CLOSE_TIME?: string;
  readonly VITE_MARKET_TIMEZONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
