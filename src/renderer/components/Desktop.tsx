import { useDesktopStore } from '../state/desktopStore';
import { createInitialLocalRuntimeState, createLocalRuntimeResult, isLocalRuntimeApp } from './LocalAppRuntime';
import StartMenu, { APPS, ICONS } from './StartMenu';
import Taskbar from './Taskbar';
import WindowFrame from './WindowFrame';

export default function Desktop(): React.JSX.Element {
  const windows = useDesktopStore((state) => state.windows);
  const addWindow = useDesktopStore((state) => state.addWindow);
  const recentGeneratedApps = useDesktopStore((state) => state.recentGeneratedApps);
  const recordGeneratedAppLaunch = useDesktopStore((state) => state.recordGeneratedAppLaunch);
  const startMenuOpen = useDesktopStore((state) => state.startMenuOpen);
  const setStartMenuOpen = useDesktopStore((state) => state.setStartMenuOpen);

  async function launchApp(appName: string): Promise<void> {
    const normalizedAppName = appName.trim();
    if (!normalizedAppName) {
      return;
    }
    setStartMenuOpen(false);
    const index = windows.length;
    const windowId = crypto.randomUUID();
    const isBuiltIn = APPS.includes(normalizedAppName);
    if (isLocalRuntimeApp(normalizedAppName)) {
      const localState = createInitialLocalRuntimeState(normalizedAppName);
      const localResult = createLocalRuntimeResult(normalizedAppName, localState);
      addWindow({
        windowId,
        appSessionId: windowId,
        appName: normalizedAppName,
        title: localResult.title,
        html: localResult.html,
        state: localResult.state,
        x: 72 + (index % 5) * 34,
        y: 54 + (index % 5) * 28,
        width: normalizedAppName === 'Browser' ? 720 : 520,
        height: normalizedAppName === 'Browser' ? 460 : 380,
        minimized: false,
        maximized: false,
        loading: false,
        narration: null
      });
      return;
    }
    recordGeneratedAppLaunch(normalizedAppName);

    addWindow({
      windowId,
      appSessionId: windowId,
      appName: normalizedAppName,
      title: isBuiltIn ? `Opening ${normalizedAppName}` : `Generating ${normalizedAppName}`,
      html: isBuiltIn ? openingHtml(normalizedAppName) : generatingHtml(normalizedAppName),
      state: {},
      x: 72 + (index % 5) * 34,
      y: 54 + (index % 5) * 28,
      width: normalizedAppName === 'Encarta 98' || normalizedAppName === 'Browser' || !isBuiltIn ? 720 : 520,
      height: normalizedAppName === 'Encarta 98' || normalizedAppName === 'Browser' || !isBuiltIn ? 460 : 380,
      minimized: false,
      maximized: false,
      loading: true,
      narration: null
    });

    try {
      const session = await window.vibeos.createAppSession(normalizedAppName);
      useDesktopStore.getState().updateWindow(windowId, {
        appSessionId: session.appSessionId,
        title: session.result.title,
        html: session.result.html,
        state: session.result.state,
        narration: session.result.narration ?? null,
        loading: false
      });
    } catch (error) {
      useDesktopStore.getState().updateWindow(windowId, {
        title: `${normalizedAppName} - Error`,
        html: `
          <div class="v-app">
            <div class="v-card">
              <h1>Could not start app</h1>
              <p class="v-muted">${String(error).replace(/[<>&"']/g, '')}</p>
            </div>
          </div>`,
        loading: false
      });
    }
  }

  return (
    <div className="desktop" onClick={() => startMenuOpen && setStartMenuOpen(false)}>
      <div className="desktop-icons">
        {APPS.slice(0, 6).map((appName) => (
          <button key={appName} className="desktop-icon" onClick={(event) => { event.stopPropagation(); void launchApp(appName); }}>
            <span className="desktop-icon-box">{ICONS[appName]}</span>
            <span>{appName}</span>
          </button>
        ))}
      </div>

      <div className="window-layer">
        {windows.map((appWindow) => (
          <WindowFrame key={appWindow.windowId} window={appWindow} />
        ))}
      </div>

      {startMenuOpen ? (
        <div onClick={(event) => event.stopPropagation()}>
          <StartMenu recentGeneratedApps={recentGeneratedApps} onLaunch={(appName) => void launchApp(appName)} />
        </div>
      ) : null}

      <Taskbar onStartClick={() => setStartMenuOpen(!startMenuOpen)} onAsk={(appName) => void launchApp(appName)} />
    </div>
  );
}

function openingHtml(appName: string): string {
  return `<div class="v-app v-generated"><h1>${escapeHtml(appName)}</h1><p class="v-muted">Loading local app surface...</p></div>`;
}

function generatingHtml(appName: string): string {
  return `
    <div class="v-app v-generated">
      <div class="v-card">
        <h1>${escapeHtml(appName)}</h1>
        <p>VibeOS is hallucinating a new app shell.</p>
        <ul class="v-list">
          <li class="v-list-item">Sketching controls</li>
          <li class="v-list-item">Inventing state model</li>
          <li class="v-list-item">Binding safe HTML events</li>
        </ul>
        <p class="v-muted">Built-in apps are instant; generated apps use the model.</p>
      </div>
    </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
