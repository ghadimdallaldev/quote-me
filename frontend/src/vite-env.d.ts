/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface IdleRequestCallback {
  (deadline: { didTimeout: boolean; timeRemaining: () => number }): void;
}

interface Window {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: { timeout?: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
}
