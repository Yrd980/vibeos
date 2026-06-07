import { DeepSeekLlmAdapter } from '../llm/DeepSeekLlmAdapter';
import { HybridLlmAdapter } from '../llm/HybridLlmAdapter';
import { MockLlmAdapter } from '../llm/MockLlmAdapter';
import type { LlmAdapter } from '../llm/types';
import type { AppEvent, GenerateUiInput, GenerateUiResult, VibeOsApi } from '../../shared/types';

const webSessions = new Map<string, WebAppSession>();
const generatedAppCache = new Map<string, GenerateUiResult>();
const adapter = createAdapter();

type WebAppSession = {
  appName: string;
  currentTitle?: string;
  currentHtml?: string;
  currentState?: unknown;
  queue: Promise<unknown>;
};

export function getVibeOsApi(): VibeOsApi {
  return webApi;
}

const webApi: VibeOsApi = {
  async createAppSession(appName) {
    const normalizedAppName = appName.trim();
    const appSessionId = crypto.randomUUID();
    webSessions.set(appSessionId, { appName: normalizedAppName, queue: Promise.resolve() });

    const cachedResult = generatedAppCache.get(cacheKey(normalizedAppName));
    if (cachedResult) {
      const result = cloneGenerateUiResult(cachedResult);
      hydrateSession(appSessionId, result);
      return { appSessionId, result };
    }

    const result = await runQueuedTurn(appSessionId, { type: 'init', appName: normalizedAppName });
    generatedAppCache.set(cacheKey(normalizedAppName), cloneGenerateUiResult(result));
    return { appSessionId, result };
  },
  async sendAppEvent(appSessionId, event) {
    return runQueuedTurn(appSessionId, event);
  },
  async closeAppSession(appSessionId) {
    return { closed: webSessions.delete(appSessionId) };
  }
};

function runQueuedTurn(appSessionId: string, event: AppEvent): Promise<GenerateUiResult> {
  const session = webSessions.get(appSessionId);
  if (!session) {
    throw new Error('Web app session was not found.');
  }

  const next = session.queue
    .catch(() => undefined)
    .then(() => runTurn(appSessionId, event));
  session.queue = next;
  return next;
}

async function runTurn(appSessionId: string, event: AppEvent): Promise<GenerateUiResult> {
  const session = webSessions.get(appSessionId);
  if (!session) {
    throw new Error('Web app session was not found.');
  }

  const input: GenerateUiInput = {
    appSessionId,
    appName: session.appName,
    currentTitle: session.currentTitle,
    currentHtml: session.currentHtml,
    currentState: session.currentState,
    event
  };
  const result = await adapter.generateNextUi(input);
  hydrateSession(appSessionId, result);
  return result;
}

function hydrateSession(appSessionId: string, result: GenerateUiResult): void {
  const session = webSessions.get(appSessionId);
  if (!session) {
    return;
  }
  session.currentTitle = result.title;
  session.currentHtml = result.html;
  session.currentState = result.state;
}

function createAdapter(): LlmAdapter {
  const provider = (import.meta.env.VITE_VIBEOS_LLM_PROVIDER ?? 'hybrid').toLowerCase();
  if (provider === 'deepseek') {
    return new DeepSeekLlmAdapter();
  }
  if (provider === 'hybrid') {
    return new HybridLlmAdapter();
  }
  if (provider !== 'mock') {
    console.warn(`Unknown VITE_VIBEOS_LLM_PROVIDER "${provider}". Falling back to mock.`);
  }
  return new MockLlmAdapter();
}

function cacheKey(appName: string): string {
  return appName.trim().toLowerCase();
}

function cloneGenerateUiResult(result: GenerateUiResult): GenerateUiResult {
  return {
    title: result.title,
    html: result.html,
    state: structuredClone(result.state),
    narration: result.narration ?? null
  };
}
