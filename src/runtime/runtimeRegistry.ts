import type { LaunchIntent } from './types';

export type RuntimeBinding = {
  sessionKind: 'local' | 'browser' | 'generated' | 'nested';
  runtimeId: string;
  chromeKind: 'win98' | 'browser' | 'dialog' | 'nested';
};

export function resolveRuntimeBinding(intent: LaunchIntent): RuntimeBinding {
  if (intent.kind === 'local-app') {
    return {
      sessionKind: 'local',
      runtimeId: `local:${intent.targetHint ?? intent.iconHint}`,
      chromeKind: 'win98',
    };
  }

  if (intent.kind === 'browser-page') {
    return {
      sessionKind: 'browser',
      runtimeId: 'browser:ie-offline',
      chromeKind: 'browser',
    };
  }

  if (intent.kind === 'nested-os') {
    return {
      sessionKind: 'nested',
      runtimeId: 'generated:mock-patch-stream',
      chromeKind: 'nested',
    };
  }

  return {
    sessionKind: 'generated',
    runtimeId: 'generated:mock-patch-stream',
    chromeKind: 'win98',
  };
}
