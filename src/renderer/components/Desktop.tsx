import { DESKTOP_APP_NAMES, getAppIcon, getInitialWindowSize, isBuiltInApp } from '../apps/catalog';
import { useDesktopStore } from '../state/desktopStore';
import { getVibeOsApi } from '../utils/vibeosApi';
import { createInitialLocalRuntimeState, createLocalRuntimeResult, isLocalRuntimeApp } from './LocalAppRuntime';
import StartMenu from './StartMenu';
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
    const isBuiltIn = isBuiltInApp(normalizedAppName);
    const initialWindowSize = getInitialWindowSize(normalizedAppName);
    if (isLocalRuntimeApp(normalizedAppName)) {
      const localState = createInitialLocalRuntimeState(normalizedAppName);
      const localResult = createLocalRuntimeResult(normalizedAppName, localState);
      addWindow({
        windowId,
        appSessionId: windowId,
        appName: normalizedAppName,
        title: localResult.title,
        blocks: [],
        state: localResult.state,
        x: 72 + (index % 5) * 34,
        y: 54 + (index % 5) * 28,
        width: initialWindowSize.width,
        height: initialWindowSize.height,
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
      blocks: isBuiltIn ? openingBlocks(normalizedAppName) : generatingBlocks(normalizedAppName),
      state: {},
      x: 72 + (index % 5) * 34,
      y: 54 + (index % 5) * 28,
      width: initialWindowSize.width,
      height: initialWindowSize.height,
      minimized: false,
      maximized: false,
      loading: true,
      narration: null
    });

    try {
      const session = await getVibeOsApi().createAppSession(normalizedAppName);
      useDesktopStore.getState().updateWindow(windowId, {
        appSessionId: session.appSessionId,
        title: session.result.title,
        blocks: session.result.blocks,
        state: session.result.state,
        narration: session.result.narration ?? null,
        loading: false
      });
    } catch (error) {
      useDesktopStore.getState().updateWindow(windowId, {
        title: `${normalizedAppName} - Error`,
        blocks: [
          {
            id: 'error',
            role: 'main',
            className: 'v-app',
            title: 'Could not start app',
            text: String(error).replace(/[<>&"']/g, '')
          }
        ],
        loading: false
      });
    }
  }

  return (
    <div className="desktop" onClick={() => startMenuOpen && setStartMenuOpen(false)}>
      <div className="desktop-icons">
        {DESKTOP_APP_NAMES.map((appName) => (
          <button key={appName} className="desktop-icon" onClick={(event) => { event.stopPropagation(); void launchApp(appName); }}>
            <span className="desktop-icon-box">{getAppIcon(appName)}</span>
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

function openingBlocks(appName: string) {
  return [
    {
      id: 'opening',
      role: 'main' as const,
      className: 'v-app v-generated',
      title: appName,
      text: 'Loading local app surface...'
    }
  ];
}

function generatingBlocks(appName: string) {
  return [
    {
      id: 'generating-menu',
      role: 'menubar' as const,
      actions: ['File', 'Edit', 'Generate', 'Tools', 'Help'].map((label) => ({ id: `generating-${label.toLowerCase()}`, label }))
    },
    {
      id: 'generating-toolbar',
      role: 'toolbar' as const,
      text: 'VibeOS is hallucinating a new app shell.',
      actions: [
        { id: 'generating-ui', label: 'UI blocks', value: 'UI blocks', variant: 'primary' as const },
        { id: 'generating-data', label: 'Fake data', value: 'Fake data' },
        { id: 'generating-events', label: 'Safe events', value: 'Safe events' }
      ]
    },
    {
      id: 'generating',
      role: 'main' as const,
      className: 'v-app v-generated',
      title: appName,
      text: 'Generating a retro window from the prompt, including invented controls, fake data, and local event wiring.',
      items: ['Reading prompt', 'Choosing 90s app genre', 'Laying out menus and panels', 'Writing simulated status text']
    },
    {
      id: 'generating-status',
      role: 'status' as const,
      text: 'AI generation in progress. This app is simulated inside VibeOS.'
    }
  ];
}
