import { MockLlmAdapter } from '../../main/llm/MockLlmAdapter';
import type { AppEvent, GenerateUiInput, GenerateUiResult, VibeOsApi } from '../../shared/types';

const browserPreviewSessions = new Map<string, BrowserPreviewSession>();
const browserPreviewAdapter = new MockLlmAdapter();

type BrowserPreviewSession = {
  appName: string;
  currentTitle?: string;
  currentHtml?: string;
  currentState?: unknown;
};

export function getVibeOsApi(): VibeOsApi {
  if (window.vibeos) {
    return window.vibeos;
  }

  return browserPreviewApi;
}

const browserPreviewApi: VibeOsApi = {
  async createAppSession(appName) {
    const appSessionId = crypto.randomUUID();
    browserPreviewSessions.set(appSessionId, { appName });
    const result = await runBrowserPreviewTurn(appSessionId, { type: 'init', appName });
    return { appSessionId, result };
  },
  async sendAppEvent(appSessionId, event) {
    return runBrowserPreviewTurn(appSessionId, event);
  },
  async closeAppSession(appSessionId) {
    return { closed: browserPreviewSessions.delete(appSessionId) };
  }
};

async function runBrowserPreviewTurn(appSessionId: string, event: AppEvent): Promise<GenerateUiResult> {
  const session = browserPreviewSessions.get(appSessionId);
  if (!session) {
    throw new Error('Browser preview session was not found.');
  }

  const input: GenerateUiInput = {
    appSessionId,
    appName: session.appName,
    currentTitle: session.currentTitle,
    currentHtml: session.currentHtml,
    currentState: session.currentState,
    event
  };
  const result = await browserPreviewAdapter.generateNextUi(input);
  session.currentTitle = result.title;
  session.currentHtml = result.html;
  session.currentState = result.state;
  return result;
}
