import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { DeepSeekLlmAdapter } from './llm/DeepSeekLlmAdapter';
import { HybridLlmAdapter } from './llm/HybridLlmAdapter';
import { MockLlmAdapter } from './llm/MockLlmAdapter';
import { SessionStore } from './llm/sessionStore';
import type { AppEvent, GenerateUiInput, GenerateUiResult, LlmAdapter } from './llm/types';

const AppEventSchema: z.ZodType<AppEvent> = z.union([
  z.object({ type: z.literal('init'), appName: z.string().min(1).max(80) }),
  z.object({
    type: z.literal('click'),
    targetText: z.string().max(240).optional(),
    targetRole: z.string().max(80).optional(),
    selectorPath: z.string().max(160).optional(),
    x: z.number().optional(),
    y: z.number().optional()
  }),
  z.object({
    type: z.literal('input'),
    targetLabel: z.string().max(120).optional(),
    value: z.string().max(10000),
    selectorPath: z.string().max(160).optional()
  }),
  z.object({
    type: z.literal('submit'),
    formText: z.string().max(1000).optional(),
    values: z.record(z.string().max(10000)).optional()
  }),
  z.object({
    type: z.literal('keyboard'),
    key: z.string().max(80),
    ctrlKey: z.boolean().optional(),
    shiftKey: z.boolean().optional(),
    altKey: z.boolean().optional()
  })
]);

const appNameSchema = z.string().min(1).max(80);
const appSessionIdSchema = z.string().uuid();

const store = new SessionStore();
const adapter = createAdapter();
const sessionQueues = new Map<string, Promise<unknown>>();
const generatedAppCache = new Map<string, GenerateUiResult>();

export function registerIpc(): void {
  ipcMain.handle('vibeos:createAppSession', async (event, rawAppName: unknown) => {
    const appName = appNameSchema.parse(rawAppName);
    const session = store.createSession(appName, event.sender.id);
    const cachedResult = generatedAppCache.get(cacheKey(appName));
    if (cachedResult) {
      return {
        appSessionId: session.appSessionId,
        result: store.hydrateSession(session.appSessionId, cloneGenerateUiResult(cachedResult))
      };
    }
    const result = await runQueuedTurn(event, session.appSessionId, { type: 'init', appName });
    generatedAppCache.set(cacheKey(appName), cloneGenerateUiResult(result));
    return {
      appSessionId: session.appSessionId,
      result
    };
  });

  ipcMain.handle('vibeos:sendAppEvent', async (event, rawAppSessionId: unknown, rawAppEvent: unknown) => {
    const appSessionId = appSessionIdSchema.parse(rawAppSessionId);
    const appEvent = AppEventSchema.parse(rawAppEvent);
    return runQueuedTurn(event, appSessionId, appEvent);
  });

  ipcMain.handle('vibeos:closeAppSession', (event, rawAppSessionId: unknown) => {
    const appSessionId = appSessionIdSchema.parse(rawAppSessionId);
    return { closed: store.closeSession(appSessionId, event.sender.id) };
  });

  ipcMain.on('vibeos:rendererDestroyed', (event) => {
    store.closeSessionsForWebContents(event.sender.id);
  });
}

function runQueuedTurn(event: IpcMainInvokeEvent, appSessionId: string, appEvent: AppEvent): Promise<GenerateUiResult> {
  const previous = sessionQueues.get(appSessionId) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => runTurn(event, appSessionId, appEvent))
    .finally(() => {
      if (sessionQueues.get(appSessionId) === next) {
        sessionQueues.delete(appSessionId);
      }
    });
  sessionQueues.set(appSessionId, next);
  return next;
}

async function runTurn(event: IpcMainInvokeEvent, appSessionId: string, appEvent: AppEvent): Promise<GenerateUiResult> {
  const session = store.assertOwnedSession(appSessionId, event.sender.id);
  const requestId = store.beginRequest(appSessionId);
  store.recordEvent(appSessionId, appEvent);

  const input: GenerateUiInput = {
    appSessionId,
    appName: session.appName,
    currentTitle: session.currentTitle,
    currentHtml: session.currentHtml,
    currentState: session.currentState,
    event: appEvent
  };

  const result = await adapter.generateNextUi(input);
  return store.updateSession(appSessionId, requestId, result);
}

function createAdapter(): LlmAdapter {
  const provider = (process.env.VIBEOS_LLM_PROVIDER ?? 'mock').toLowerCase();
  if (provider === 'hybrid') {
    return new HybridLlmAdapter();
  }
  if (provider === 'deepseek') {
    return new HybridLlmAdapter();
  }
  if (provider !== 'mock') {
    console.warn(`Unknown VIBEOS_LLM_PROVIDER "${provider}". Falling back to mock.`);
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
