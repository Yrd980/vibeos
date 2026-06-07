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

export type GeneratedUiBlockRole = 'menubar' | 'toolbar' | 'sidebar' | 'main' | 'panel' | 'status' | 'dialog';

export interface GeneratedUiAction {
  id: string;
  label: string;
  value?: string;
  variant?: 'default' | 'primary' | 'danger';
}

export interface GeneratedUiField {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
}

export interface GeneratedUiTable {
  columns: string[];
  rows: string[][];
}

export interface GeneratedUiBlock {
  id: string;
  role: GeneratedUiBlockRole;
  className?: string;
  title?: string;
  text?: string;
  items?: string[];
  actions?: GeneratedUiAction[];
  fields?: GeneratedUiField[];
  table?: GeneratedUiTable;
}

export interface GenerateUiInput {
  appSessionId: string;
  appName: string;
  currentTitle?: string;
  currentBlocks?: GeneratedUiBlock[] | null;
  currentState?: unknown;
  event: AppEvent;
}

export interface GenerateUiResult {
  title: string;
  state: unknown;
  narration?: string | null;
  blocks: GeneratedUiBlock[];
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
