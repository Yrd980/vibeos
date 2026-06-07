import { useEffect, useState } from 'react';
import type { DesktopWindow } from '../state/desktopStore';
import { useDesktopStore } from '../state/desktopStore';
import AppWindowContent, { useAppWindowExecution } from './AppWindowContent';

interface WindowFrameProps {
  window: DesktopWindow;
}

export default function WindowFrame({ window }: WindowFrameProps): React.JSX.Element | null {
  const updateWindow = useDesktopStore((state) => state.updateWindow);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const closeWindow = useDesktopStore((state) => state.closeWindow);
  const minimizeWindow = useDesktopStore((state) => state.minimizeWindow);
  const toggleMaximize = useDesktopStore((state) => state.toggleMaximize);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [resize, setResize] = useState<{ startX: number; startY: number; width: number; height: number } | null>(null);
  const execution = useAppWindowExecution(window);
  const isTopWindow = useDesktopStore((state) => {
    const visibleWindows = state.windows.filter((candidate) => !candidate.minimized);
    const topZIndex = Math.max(...visibleWindows.map((candidate) => candidate.zIndex));
    return window.zIndex >= topZIndex;
  });

  useEffect(() => {
    const handleMove = (event: MouseEvent): void => {
      if (drag && !window.maximized) {
        updateWindow(window.windowId, {
          x: Math.max(0, event.clientX - drag.dx),
          y: Math.max(0, event.clientY - drag.dy)
        });
      }
      if (resize && !window.maximized) {
        updateWindow(window.windowId, {
          width: Math.max(320, resize.width + event.clientX - resize.startX),
          height: Math.max(220, resize.height + event.clientY - resize.startY)
        });
      }
    };
    const stop = (): void => {
      setDrag(null);
      setResize(null);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', stop);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', stop);
    };
  }, [drag, resize, updateWindow, window.maximized, window.windowId]);

  if (window.minimized) {
    return null;
  }

  const style = window.maximized
    ? { left: 0, top: 0, width: '100%', height: 'calc(100% - 42px)', zIndex: window.zIndex }
    : {
        left: window.x,
        top: window.y,
        width: window.width,
        height: window.height,
        zIndex: window.zIndex
      };

  async function handleClose(): Promise<void> {
    await execution.closeSession();
    closeWindow(window.windowId);
  }

  function focusIfNeeded(): void {
    if (!isTopWindow) {
      focusWindow(window.windowId);
    }
  }

  return (
    <section className="window-frame" style={style} onMouseDown={focusIfNeeded}>
      <div
        className="window-titlebar"
        onMouseDown={(event) => {
          focusWindow(window.windowId);
          setDrag({ dx: event.clientX - window.x, dy: event.clientY - window.y });
        }}
      >
        <span className="window-title">{window.title}</span>
        {execution.busy || window.loading ? <span className="window-status">Thinking</span> : null}
        <div className="window-controls" onMouseDown={(event) => event.stopPropagation()}>
          <button aria-label="Minimize" title="Minimize" onClick={() => minimizeWindow(window.windowId)}>
            _
          </button>
          <button aria-label="Maximize" title="Maximize" onClick={() => toggleMaximize(window.windowId)}>
            □
          </button>
          <button aria-label="Close" title="Close" onClick={handleClose}>
            X
          </button>
        </div>
      </div>
      <div
        className="window-content"
        onMouseDown={(event) => {
          focusIfNeeded();
          event.stopPropagation();
        }}
      >
        <AppWindowContent window={window} execution={execution} />
      </div>
      {!window.maximized ? (
        <div
          className="window-resizer"
          onMouseDown={(event) => {
            event.preventDefault();
            setResize({ startX: event.clientX, startY: event.clientY, width: window.width, height: window.height });
          }}
        />
      ) : null}
    </section>
  );
}
