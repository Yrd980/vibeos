import { applyPatchEnvelope } from './generatedRuntime';
import type { BrowserState, GeneratedSessionState } from './types';

export type StageStepResult = {
  advanced: boolean;
  title?: string;
  iconToken?: string;
};

export function advanceGeneratedStage(state: GeneratedSessionState): StageStepResult {
  if (state.nextPatchIndex >= state.stream.length) {
    return { advanced: false };
  }

  const nextDocument = applyPatchEnvelope(state.document, state.stream[state.nextPatchIndex]);
  const accepted = nextDocument !== state.document;
  state.document = nextDocument;
  if (accepted) {
    state.visibleDocument = nextDocument;
    state.stagePlan.lastVisibleRevision = nextDocument.revision;
  }
  state.nextPatchIndex += 1;
  state.modelState = state.nextPatchIndex >= state.stream.length ? 'complete' : 'streaming';

  return {
    advanced: accepted,
    title: state.document.appIdentity.title,
    iconToken: state.document.appIdentity.iconToken,
  };
}

export function advanceBrowserStage(state: BrowserState): StageStepResult {
  if (state.nextPatchIndex >= state.stream.length) {
    return { advanced: false };
  }

  state.page.document = applyPatchEnvelope(state.page.document, state.stream[state.nextPatchIndex]);
  state.page.title = state.page.document.appIdentity.title;
  state.page.statusText = state.page.document.appIdentity.statusText;
  state.history[state.historyIndex] = state.page;
  state.nextPatchIndex += 1;

  return {
    advanced: true,
    title: `Internet Explorer - ${state.page.title}`,
    iconToken: 'browser',
  };
}
