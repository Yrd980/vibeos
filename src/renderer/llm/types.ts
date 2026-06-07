export type {
  AppEvent,
  CreateAppSessionResponse,
  GenerateUiInput,
  GenerateUiResult,
  VibeOsApi
} from '../../shared/types';

import type { GenerateUiInput, GenerateUiResult } from '../../shared/types';

export interface LlmAdapter {
  generateNextUi(input: GenerateUiInput): Promise<GenerateUiResult>;
}
