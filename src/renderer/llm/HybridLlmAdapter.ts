import type { GenerateUiInput, GenerateUiResult, LlmAdapter } from './types';
import { APP_PROFILES } from './appProfiles';
import { DeepSeekLlmAdapter } from './DeepSeekLlmAdapter';
import { MockLlmAdapter } from './MockLlmAdapter';

const BUILT_IN_APPS = new Set(APP_PROFILES.map((profile) => profile.appName));

export class HybridLlmAdapter implements LlmAdapter {
  private readonly localAdapter = new MockLlmAdapter();
  private deepSeekAdapter: DeepSeekLlmAdapter | null = null;

  async generateNextUi(input: GenerateUiInput): Promise<GenerateUiResult> {
    if (BUILT_IN_APPS.has(input.appName)) {
      return this.localAdapter.generateNextUi(input);
    }

    if (shouldStayLocalForGeneratedApp(input)) {
      return this.localAdapter.generateNextUi(input);
    }

    try {
      const result = await this.getDeepSeekAdapter().generateNextUi(input);
      return isProviderErrorResult(result) ? this.localAdapter.generateNextUi(input) : result;
    } catch (error) {
      console.warn(`DeepSeek unavailable; using local VibeOS fallback: ${error instanceof Error ? error.message : String(error)}`);
      return this.localAdapter.generateNextUi(input);
    }
  }

  private getDeepSeekAdapter(): DeepSeekLlmAdapter {
    this.deepSeekAdapter ??= new DeepSeekLlmAdapter();
    return this.deepSeekAdapter;
  }
}

function shouldStayLocalForGeneratedApp(input: GenerateUiInput): boolean {
  if (!isLocalGeneratedState(input.currentState)) {
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

function isLocalGeneratedState(state: unknown): boolean {
  return Boolean(
    state &&
      typeof state === 'object' &&
      ((state as { mode?: unknown }).mode === 'starter' || (state as { mode?: unknown }).mode === 'generated')
  );
}

function isProviderErrorResult(result: GenerateUiResult): boolean {
  return Boolean(
    result.title.includes('Provider Error') ||
      (result.state && typeof result.state === 'object' && 'error' in result.state)
  );
}
