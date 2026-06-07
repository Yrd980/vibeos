/// <reference types="vite/client" />

import type { VibeOsApi } from '../shared/types';

declare global {
  interface Window {
    vibeos: VibeOsApi;
  }
}

export {};
