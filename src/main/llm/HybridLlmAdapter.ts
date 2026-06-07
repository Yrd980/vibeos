import type { GenerateUiInput, GenerateUiResult, LlmAdapter } from './types';
import { APP_PROFILES } from './appProfiles';
import { DeepSeekLlmAdapter } from './DeepSeekLlmAdapter';
import { MockLlmAdapter } from './MockLlmAdapter';

const BUILT_IN_APPS = new Set(APP_PROFILES.map((profile) => profile.appName));

export class HybridLlmAdapter implements LlmAdapter {
  private readonly localAdapter = new MockLlmAdapter();
  private readonly deepSeekAdapter = new DeepSeekLlmAdapter();

  async generateNextUi(input: GenerateUiInput): Promise<GenerateUiResult> {
    if (BUILT_IN_APPS.has(input.appName)) {
      return this.localAdapter.generateNextUi(input);
    }

    if (input.event.type === 'init' || shouldStayLocalInStarter(input)) {
      return this.localAdapter.generateNextUi(input);
    }

    return this.deepSeekAdapter.generateNextUi(input);
  }
}

function shouldStayLocalInStarter(input: GenerateUiInput): boolean {
  if (!isStarterState(input.currentState)) {
    return false;
  }
  if (input.event.type === 'input') {
    return true;
  }
  if (input.event.type === 'click') {
    return input.event.targetText !== 'Dream Up';
  }
  return false;
}

function isStarterState(state: unknown): boolean {
  return Boolean(state && typeof state === 'object' && (state as { mode?: unknown }).mode === 'starter');
}
