import { useEffect, useState } from 'react';
import { getAppIcon } from '../apps/catalog';
import { useDesktopStore } from '../state/desktopStore';

interface TaskbarProps {
  onStartClick(): void;
  onAsk(appName: string): void;
}

export default function Taskbar({ onStartClick, onAsk }: TaskbarProps): React.JSX.Element {
  const windows = useDesktopStore((state) => state.windows);
  const restoreWindow = useDesktopStore((state) => state.restoreWindow);
  const minimizeWindow = useDesktopStore((state) => state.minimizeWindow);
  const [askQuery, setAskQuery] = useState('');
  const [clock, setClock] = useState(() => new Date());
  const trimmedAskQuery = askQuery.trim();

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <footer className="taskbar">
      <button className="start-button" onClick={onStartClick}>
        <span className="start-glyph">V</span>
        Start
      </button>
      <form
        className="taskbar-ask"
        onSubmit={(event) => {
          event.preventDefault();
          if (!trimmedAskQuery) {
            return;
          }
          onAsk(trimmedAskQuery);
          setAskQuery('');
        }}
      >
        <input
          value={askQuery}
          onChange={(event) => setAskQuery(event.target.value)}
          placeholder="Ask VibeOS..."
          aria-label="Ask VibeOS"
        />
        <button type="submit">Ask</button>
      </form>
      <div className="taskbar-windows">
        {windows.map((appWindow) => (
          <button
            key={appWindow.windowId}
            className={`taskbar-item ${appWindow.minimized ? 'is-minimized' : ''}`}
            onClick={() => (appWindow.minimized ? restoreWindow(appWindow.windowId) : minimizeWindow(appWindow.windowId))}
          >
            <span className="mini-icon">{getAppIcon(appWindow.appName)}</span>
            <span>{appWindow.title}</span>
          </button>
        ))}
      </div>
      <div className="system-tray">
        <span className="ai-led">AI</span>
        <span>{clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </footer>
  );
}
