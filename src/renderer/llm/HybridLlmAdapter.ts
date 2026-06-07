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

    try {
      return await this.getDeepSeekAdapter().generateNextUi(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`DeepSeek unavailable: ${message}`);
      return providerErrorResult(input.appName, message);
    }
  }

  private getDeepSeekAdapter(): DeepSeekLlmAdapter {
    this.deepSeekAdapter ??= new DeepSeekLlmAdapter();
    return this.deepSeekAdapter;
  }
}

function providerErrorResult(appName: string, message: string): GenerateUiResult {
  const safeMessage = message.replace(/[<>&"']/g, '');
  return {
    title: `${appName} - Provider Error`,
    state: { error: safeMessage },
    narration: safeMessage,
    blocks: [
      {
        id: 'provider-error',
        role: 'main',
        className: 'v-app',
        title: 'DeepSeek unavailable',
        text: `VibeOS could not generate this app through DeepSeek. ${safeMessage}`
      }
    ]
  };
}
