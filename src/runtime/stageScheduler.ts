import { applyPatchEnvelope } from './generatedRuntime';
import type { BrowserState, GeneratedSessionState } from './types';

export type StageStepResult = {
  advanced: boolean;
  title?: string;
  iconToken?: string;
};

export function advanceGeneratedStage(state: GeneratedSessionState): StageStepResult {
  const maxSteps = generatedStepBudget(state);
  let advanced = false;

  for (let step = 0; step < maxSteps && state.nextPatchIndex < state.stream.length; step += 1) {
    const nextDocument = applyPatchEnvelope(state.document, state.stream[state.nextPatchIndex]);
    const accepted = nextDocument !== state.document;
    state.nextPatchIndex += 1;

    if (!accepted) break;

    state.document = nextDocument;
    state.visibleDocument = nextDocument;
    state.stagePlan.lastVisibleRevision = nextDocument.revision;
    advanced = true;
  }

  state.modelState = state.nextPatchIndex >= state.stream.length ? 'complete' : 'streaming';

  return {
    advanced,
    title: state.document.appIdentity.title,
    iconToken: state.document.appIdentity.iconToken,
  };
}

function generatedStepBudget(state: GeneratedSessionState) {
  if (state.stagePlan.mode === 'cache-replay') return Math.max(1, state.stream.length - state.nextPatchIndex);
  if (state.stagePlan.mode === 'fallback') return 2;
  return 1;
}

export function advanceBrowserStage(state: BrowserState): StageStepResult {
  if (state.nextPatchIndex >= state.stream.length) {
    return { advanced: false };
  }

  const nextDocument = applyPatchEnvelope(state.page.document, state.stream[state.nextPatchIndex]);
  const accepted = nextDocument !== state.page.document;
  if (accepted) {
    state.page.document = nextDocument;
    state.page.title = state.page.document.appIdentity.title;
    state.page.statusText = state.page.document.appIdentity.statusText;
    state.history[state.historyIndex] = state.page;
  }
  state.nextPatchIndex += 1;

  return {
    advanced: accepted,
    title: `Internet Explorer - ${state.page.title}`,
    iconToken: 'browser',
  };
}
