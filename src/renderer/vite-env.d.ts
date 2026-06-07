/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VIBEOS_LLM_PROVIDER?: 'mock' | 'hybrid' | 'deepseek';
  readonly VITE_DEEPSEEK_API_KEY?: string;
  readonly VITE_DEEPSEEK_MODEL?: string;
  readonly VITE_DEEPSEEK_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
