export type AppEvent =
  | { type: 'init'; appName: string }
  | {
      type: 'click';
      targetText?: string;
      targetRole?: string;
      selectorPath?: string;
      x?: number;
      y?: number;
    }
  | { type: 'input'; targetLabel?: string; value: string; selectorPath?: string }
  | { type: 'submit'; formText?: string; values?: Record<string, string> }
  | { type: 'keyboard'; key: string; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean };

export interface GenerateUiInput {
  appSessionId: string;
  appName: string;
  currentTitle?: string;
  currentHtml?: string;
  currentState?: unknown;
  event: AppEvent;
}

export interface GenerateUiResult {
  title: string;
  html: string;
  state: unknown;
  narration?: string | null;
}

export interface CreateAppSessionResponse {
  appSessionId: string;
  result: GenerateUiResult;
}

export interface VibeOsApi {
  createAppSession(appName: string): Promise<CreateAppSessionResponse>;
  sendAppEvent(appSessionId: string, event: AppEvent): Promise<GenerateUiResult>;
  closeAppSession(appSessionId: string): Promise<{ closed: boolean }>;
}
