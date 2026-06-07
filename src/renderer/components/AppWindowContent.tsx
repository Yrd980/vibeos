import { useState } from 'react';
import type { AppEvent } from '../../shared/types';
import type { DesktopWindow } from '../state/desktopStore';
import { useDesktopStore } from '../state/desktopStore';
import { getVibeOsApi } from '../utils/vibeosApi';
import AppViewport from './AppViewport';
import LocalAppRuntime, { isLocalRuntimeApp } from './LocalAppRuntime';

interface AppWindowContentProps {
  window: DesktopWindow;
  execution: AppWindowExecution;
}

interface AppWindowExecution {
  busy: boolean;
  closeSession(): Promise<void>;
  sendAppEvent(event: AppEvent): Promise<void>;
}

export function useAppWindowExecution(window: DesktopWindow): AppWindowExecution {
  const updateWindow = useDesktopStore((state) => state.updateWindow);
  const updateWindowResult = useDesktopStore((state) => state.updateWindowResult);
  const [busy, setBusy] = useState(false);

  async function sendAppEvent(event: AppEvent): Promise<void> {
    const busyTimer = globalThis.setTimeout(() => {
      setBusy(true);
      updateWindow(window.windowId, { loading: true });
    }, 250);

    try {
      const result = await getVibeOsApi().sendAppEvent(window.appSessionId, event);
      globalThis.clearTimeout(busyTimer);
      setBusy(false);
      updateWindowResult(window.windowId, result);
    } catch (error) {
      globalThis.clearTimeout(busyTimer);
      setBusy(false);
      updateWindowResult(window.windowId, {
        title: `${window.appName} - Error`,
        state: { error: String(error) },
        narration: String(error),
        blocks: [
          {
            id: 'error',
            role: 'main',
            className: 'v-app',
            title: 'Session error',
            text: 'The app session could not update.'
          }
        ]
      });
    }
  }

  async function closeSession(): Promise<void> {
    if (!isLocalRuntimeApp(window.appName)) {
      await getVibeOsApi().closeAppSession(window.appSessionId).catch(() => ({ closed: false }));
    }
  }

  return { busy, closeSession, sendAppEvent };
}

export default function AppWindowContent({ window, execution }: AppWindowContentProps): React.JSX.Element {
  const updateWindowResult = useDesktopStore((state) => state.updateWindowResult);

  if (isLocalRuntimeApp(window.appName)) {
    return (
      <LocalAppRuntime
        appName={window.appName}
        state={window.state}
        onResultChange={(result) => updateWindowResult(window.windowId, result)}
      />
    );
  }

  return <AppViewport blocks={window.blocks} loading={execution.busy || window.loading} onEvent={execution.sendAppEvent} />;
}
