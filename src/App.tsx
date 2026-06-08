import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  Calculator,
  FileText,
  Globe2,
  Monitor,
  Search,
  Settings,
  Square,
  X,
} from 'lucide-react';
import { createLaunchIntent } from './runtime/intentResolver';
import { RuntimeKernel } from './runtime/kernel';
import type {
  BrowserState,
  GeneratedBlock,
  GeneratedDocument,
  GeneratedSessionState,
  KernelEvent,
  LocalAppState,
  RuntimeSnapshot,
  SearchResult,
  UiEvent,
  WindowState,
} from './runtime/types';

const kernel = new RuntimeKernel();

const iconMap = {
  calculator: Calculator,
  notepad: FileText,
  browser: Globe2,
  wiki: Globe2,
  encarta: Globe2,
  settings: Settings,
  todo: Square,
  file: FileText,
  generated: Monitor,
  nested: Monitor,
  paint: Monitor,
};

export function App() {
  const snapshot = useSyncExternalStore(
    (listener) => kernel.subscribe(listener),
    () => kernel.snapshot(),
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      kernel.dispatch({ type: 'runtime.tick' });
    }, 120);
    return () => window.clearInterval(interval);
  }, []);

  return <Desktop snapshot={snapshot} dispatch={(event) => kernel.dispatch(event)} />;
}

function Desktop({
  snapshot,
  dispatch,
}: {
  snapshot: RuntimeSnapshot;
  dispatch: (event: KernelEvent) => void;
}) {
  const visibleWindows = snapshot.windows.filter((windowState) => windowState.mode !== 'minimized');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if (event.ctrlKey && event.key.toLowerCase() === 'l') {
        const focusedBrowser = snapshot.windows
          .filter((windowState) => windowState.focusState === 'focused')
          .map((windowState) => snapshot.sessions[windowState.sessionId])
          .find((session) => session?.kind === 'browser');
        if (focusedBrowser) {
          event.preventDefault();
          document.querySelector<HTMLInputElement>(`.browser-app[data-session-id="${focusedBrowser.id}"] .address-bar input`)?.focus();
          document.querySelector<HTMLInputElement>(`.browser-app[data-session-id="${focusedBrowser.id}"] .address-bar input`)?.select();
          return;
        }
      }

      if (event.key === 'Escape' && snapshot.shell.appSearchOpen) {
        dispatch({ type: 'shell.closeSearch' });
      }

      if ((event.ctrlKey && event.key.toLowerCase() === 'k') || event.key === 'Meta') {
        event.preventDefault();
        dispatch({ type: 'shell.openSearch' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, snapshot]);

  return (
    <div className="desktop">
      <div className="desktop-icons">
        <DesktopIcon
          icon="browser"
          iconId="browser"
          label="Internet Explorer"
          selected={snapshot.shell.desktopSelectedIconId === 'browser'}
          onSelect={() => dispatch({ type: 'shell.selectDesktopIcon', iconId: 'browser' })}
          onDoubleClick={() => dispatchLaunch('Internet Explorer', dispatch)}
        />
        <DesktopIcon
          icon="notepad"
          iconId="notepad"
          label="Notepad"
          selected={snapshot.shell.desktopSelectedIconId === 'notepad'}
          onSelect={() => dispatch({ type: 'shell.selectDesktopIcon', iconId: 'notepad' })}
          onDoubleClick={() => dispatchLaunch('Notepad', dispatch)}
        />
        <DesktopIcon
          icon="calculator"
          iconId="calculator"
          label="Calculator"
          selected={snapshot.shell.desktopSelectedIconId === 'calculator'}
          onSelect={() => dispatch({ type: 'shell.selectDesktopIcon', iconId: 'calculator' })}
          onDoubleClick={() => dispatchLaunch('Calculator', dispatch)}
        />
        <DesktopIcon
          icon="encarta"
          iconId="encarta"
          label="Encarta 98"
          selected={snapshot.shell.desktopSelectedIconId === 'encarta'}
          onSelect={() => dispatch({ type: 'shell.selectDesktopIcon', iconId: 'encarta' })}
          onDoubleClick={() => dispatchLaunch('Encarta 98 about Mark Russinovich', dispatch, true)}
        />
      </div>

      {(snapshot.shell.startMenuOpen || snapshot.shell.appSearchOpen) && (
        <StartPanel snapshot={snapshot} dispatch={dispatch} />
      )}

      {visibleWindows.map((windowState) => (
        <VibeWindow
          key={windowState.id}
          windowState={windowState}
          snapshot={snapshot}
          dispatch={dispatch}
        />
      ))}

      <Taskbar snapshot={snapshot} dispatch={dispatch} />
    </div>
  );
}

function dispatchLaunch(rawQuery: string, dispatch: (event: KernelEvent) => void, forceGenerated = false) {
  dispatch({ type: 'shell.launchIntent', intent: createLaunchIntent(rawQuery, { source: 'desktop', forceGenerated }) });
}

function DesktopIcon({
  icon,
  iconId,
  label,
  selected,
  onSelect,
  onDoubleClick,
}: {
  icon: keyof typeof iconMap;
  iconId: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
}) {
  const Icon = iconMap[icon];
  return (
    <button className={`desktop-icon ${selected ? 'selected' : ''}`} data-icon-id={iconId} onClick={onSelect} onDoubleClick={onDoubleClick}>
      <span className="desktop-icon-glyph">
        <Icon size={28} strokeWidth={1.6} />
      </span>
      <span>{label}</span>
    </button>
  );
}

function StartPanel({
  snapshot,
  dispatch,
}: {
  snapshot: RuntimeSnapshot;
  dispatch: (event: KernelEvent) => void;
}) {
  return (
    <div className="start-panel">
      <div className="start-rail">VibeOS</div>
      <div className="start-body">
        <div className="start-heading">App Search</div>
        <div className="search-box-row">
          <Search size={16} />
          <input
            className="app-search-input"
            autoFocus
            value={snapshot.shell.searchQuery}
            placeholder="Type an app, site, file, setting, or weird idea"
            onChange={(event) => dispatch({ type: 'shell.setSearchQuery', query: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                dispatch({ type: 'shell.moveSearchSelection', delta: 1 });
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                dispatch({ type: 'shell.moveSearchSelection', delta: -1 });
              } else if (event.key === 'Enter' && event.shiftKey) {
                event.preventDefault();
                dispatch({ type: 'shell.launchRawSearch' });
              } else if (event.key === 'Enter') {
                event.preventDefault();
                dispatch({ type: 'shell.launchSelectedSearch' });
              } else if (event.key === 'Escape') {
                event.preventDefault();
                dispatch({ type: 'shell.closeSearch' });
              }
            }}
          />
        </div>
        <div className="search-results">
          {snapshot.shell.searchResults.map((result, index) => (
            <SearchResultRow
              key={result.id}
              result={result}
              selected={index === snapshot.shell.selectedSearchIndex}
              onMouseEnter={() => dispatch({ type: 'shell.moveSearchSelection', delta: index - snapshot.shell.selectedSearchIndex })}
              onClick={() => dispatch({ type: 'shell.launchIntent', intent: result.intent })}
            />
          ))}
        </div>
        <div className="start-footer">
          Enter opens selected. Shift+Enter invents the raw query.
          {snapshot.shell.semanticStatus !== 'idle' && <span> Async suggestions pending...</span>}
        </div>
      </div>
    </div>
  );
}

function SearchResultRow({
  result,
  selected,
  onMouseEnter,
  onClick,
}: {
  result: SearchResult;
  selected: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  const Icon = iconMap[result.icon as keyof typeof iconMap] ?? Monitor;
  return (
    <button
      className={`search-result ${selected ? 'selected' : ''}`}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <span className="search-result-icon">
        <Icon size={18} />
      </span>
      <span className="search-result-copy">
        <strong>{result.title}</strong>
        <span>{result.kind}</span>
        <small>{result.description}</small>
      </span>
    </button>
  );
}

function Taskbar({
  snapshot,
  dispatch,
}: {
  snapshot: RuntimeSnapshot;
  dispatch: (event: KernelEvent) => void;
}) {
  const time = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(snapshot.now),
    [snapshot.now],
  );

  return (
    <div className="taskbar">
      <button className={`start-button ${snapshot.shell.startMenuOpen ? 'pressed' : ''}`} onClick={() => dispatch({ type: 'shell.toggleStart' })}>
        <Monitor size={16} />
        Start
      </button>
      <div className="taskbar-items">
        {snapshot.windows.map((windowState) => {
          const Icon = iconMap[windowState.iconToken as keyof typeof iconMap] ?? Monitor;
          return (
            <button
              key={windowState.id}
              className={`taskbar-item ${windowState.focusState === 'focused' && windowState.mode !== 'minimized' ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'taskbar.toggleWindow', windowId: windowState.id })}
            >
              <Icon size={14} />
              <span>{windowState.title}</span>
            </button>
          );
        })}
      </div>
      <button className="taskbar-search" onClick={() => dispatch({ type: 'shell.openSearch' })}>
        <Search size={15} />
        Search
      </button>
      <div className="tray">{time}</div>
    </div>
  );
}

function VibeWindow({
  windowState,
  snapshot,
  dispatch,
}: {
  windowState: WindowState;
  snapshot: RuntimeSnapshot;
  dispatch: (event: KernelEvent) => void;
}) {
  const session = snapshot.sessions[windowState.sessionId];
  const maxed = windowState.mode === 'maximized';
  const style = maxed
    ? { left: 0, top: 0, width: '100vw', height: 'calc(100vh - 34px)', zIndex: windowState.zIndex }
    : {
        left: windowState.rect.x,
        top: windowState.rect.y,
        width: windowState.rect.width,
        height: windowState.rect.height,
        zIndex: windowState.zIndex,
      };

  return (
    <section
      className={`window ${windowState.focusState === 'focused' ? 'focused' : ''} ${windowState.chromeKind}`}
      style={style}
      onMouseDown={() => dispatch({ type: 'window.focus', windowId: windowState.id })}
    >
      <WindowTitlebar windowState={windowState} dispatch={dispatch} />
      <div className="window-content">
        {session?.kind === 'local' && (
          <LocalApp sessionId={session.id} state={snapshot.localApps[session.id]} dispatch={dispatch} />
        )}
        {session?.kind === 'browser' && (
          <BrowserApp sessionId={session.id} state={snapshot.browserApps[session.id]} dispatch={dispatch} />
        )}
        {(session?.kind === 'generated' || session?.kind === 'nested') && (
          <GeneratedApp sessionId={session.id} state={snapshot.generatedApps[session.id]} dispatch={dispatch} />
        )}
      </div>
      {windowState.mode === 'normal' && (
        <ResizeHandle windowState={windowState} dispatch={dispatch} />
      )}
    </section>
  );
}

function WindowTitlebar({
  windowState,
  dispatch,
}: {
  windowState: WindowState;
  dispatch: (event: KernelEvent) => void;
}) {
  const Icon = iconMap[windowState.iconToken as keyof typeof iconMap] ?? Monitor;
  const dragStart = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | undefined>(undefined);

  return (
    <div
      className="titlebar"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('button')) return;
        dragStart.current = {
          pointerX: event.clientX,
          pointerY: event.clientY,
          x: windowState.rect.x,
          y: windowState.rect.y,
        };
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragStart.current || windowState.mode !== 'normal') return;
        dispatch({
          type: 'window.move',
          windowId: windowState.id,
          x: dragStart.current.x + event.clientX - dragStart.current.pointerX,
          y: dragStart.current.y + event.clientY - dragStart.current.pointerY,
        });
      }}
      onPointerUp={() => {
        dragStart.current = undefined;
      }}
      onDoubleClick={() =>
        dispatch({
          type: windowState.mode === 'maximized' ? 'window.restore' : 'window.maximize',
          windowId: windowState.id,
        })
      }
    >
      <div className="titlebar-title">
        <Icon size={14} />
        <span>{windowState.title}</span>
      </div>
      <div className="titlebar-controls">
        <button onClick={() => dispatch({ type: 'window.minimize', windowId: windowState.id })}>_</button>
        <button onClick={() => dispatch({ type: windowState.mode === 'maximized' ? 'window.restore' : 'window.maximize', windowId: windowState.id })}>
          □
        </button>
        <button onClick={() => dispatch({ type: 'window.close', windowId: windowState.id })}>
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

function ResizeHandle({
  windowState,
  dispatch,
}: {
  windowState: WindowState;
  dispatch: (event: KernelEvent) => void;
}) {
  const resizeStart = useRef<
    | {
        pointerX: number;
        pointerY: number;
        rect: WindowState['rect'];
      }
    | undefined
  >(undefined);

  return (
    <div
      className="resize-handle"
      onPointerDown={(event) => {
        resizeStart.current = {
          pointerX: event.clientX,
          pointerY: event.clientY,
          rect: windowState.rect,
        };
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!resizeStart.current) return;
        dispatch({
          type: 'window.resize',
          windowId: windowState.id,
          rect: {
            ...resizeStart.current.rect,
            width: resizeStart.current.rect.width + event.clientX - resizeStart.current.pointerX,
            height: resizeStart.current.rect.height + event.clientY - resizeStart.current.pointerY,
          },
        });
      }}
      onPointerUp={() => {
        resizeStart.current = undefined;
      }}
    />
  );
}

function LocalApp({
  sessionId,
  state,
  dispatch,
}: {
  sessionId: string;
  state?: LocalAppState;
  dispatch: (event: KernelEvent) => void;
}) {
  if (!state) return <div className="app-body">Local runtime missing.</div>;

  if (state.type === 'notepad') {
    return (
      <div className="notepad">
        <div className="menu-line">File Edit Search Help</div>
        <textarea
          value={state.text}
          onChange={(event) => dispatch({ type: 'local.notepadChange', sessionId, text: event.target.value })}
        />
      </div>
    );
  }

  const keys = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+', 'C'];
  return (
    <div className="calculator-local">
      <div className="menu-line">Edit View Help</div>
      <output>{state.display}</output>
      <div className="calculator-buttons">
        {keys.map((key) => (
          <button key={key} onClick={() => dispatch({ type: 'local.calculatorPress', sessionId, key })}>
            {key}
          </button>
        ))}
      </div>
      <div className="status-line">Local Calculator runtime</div>
    </div>
  );
}

function BrowserApp({
  sessionId,
  state,
  dispatch,
}: {
  sessionId: string;
  state?: BrowserState;
  dispatch: (event: KernelEvent) => void;
}) {
  if (!state) return <div className="app-body">Browser runtime missing.</div>;

  return (
    <div className="browser-app" data-session-id={sessionId}>
      <div className="browser-menu">File Edit View Favorites Tools Help</div>
      <div className="browser-toolbar">
        <button onClick={() => dispatch({ type: 'browser.back', sessionId })}>Back</button>
        <button onClick={() => dispatch({ type: 'browser.forward', sessionId })}>Forward</button>
        <button onClick={() => dispatch({ type: 'browser.stop', sessionId })}>Stop</button>
        <button onClick={() => dispatch({ type: 'browser.refresh', sessionId })}>Refresh</button>
        <button onClick={() => dispatch({ type: 'browser.navigate', sessionId, address: 'about:home' })}>Home</button>
        <button onClick={() => dispatch({ type: 'browser.navigate', sessionId, address: state.addressDraft || 'google.com' })}>Search</button>
        <button>Favorites</button>
      </div>
      <form
        className="address-bar"
        onSubmit={(event) => {
          event.preventDefault();
          dispatch({ type: 'browser.navigate', sessionId, address: state.addressDraft });
        }}
      >
        <label>Address</label>
        <input
          value={state.addressDraft}
          onChange={(event) => dispatch({ type: 'browser.setAddressDraft', sessionId, value: event.target.value })}
          onKeyDown={(event) => {
            if (event.ctrlKey && event.key.toLowerCase() === 'l') {
              event.currentTarget.select();
            }
          }}
        />
        <button>Go</button>
      </form>
      <div className="browser-page-surface">
        <GeneratedDocumentView document={state.page.document} sessionId={sessionId} dispatch={dispatch} browser />
      </div>
      <div className="browser-status">{state.page.statusText}</div>
    </div>
  );
}

function GeneratedApp({
  sessionId,
  state,
  dispatch,
}: {
  sessionId: string;
  state?: GeneratedSessionState;
  dispatch: (event: KernelEvent) => void;
}) {
  if (!state) return <div className="app-body">Generated runtime missing.</div>;

  return (
    <div className="generated-app">
      <div className="generation-identity">
        <strong>{state.visibleDocument.appIdentity.title}</strong>
        <span>{state.visibleDocument.appIdentity.subtitle}</span>
        <small>Stage: {state.visibleDocument.stage}</small>
      </div>
      <GeneratedDocumentView document={state.visibleDocument} sessionId={sessionId} dispatch={dispatch} />
      <div className="generated-status">{state.visibleDocument.appIdentity.statusText}</div>
    </div>
  );
}

function GeneratedDocumentView({
  document,
  sessionId,
  dispatch,
  browser = false,
}: {
  document: GeneratedDocument;
  sessionId: string;
  dispatch: (event: KernelEvent) => void;
  browser?: boolean;
}) {
  const root = document.blocks[document.rootBlockId];
  return (
    <div className={`document-stage stage-${document.stage} ${browser ? 'browser-document' : ''}`}>
      {root.children.length ? (
        root.children.map((childId) => (
          <BlockView
            key={childId}
            block={document.blocks[childId]}
            document={document}
            sessionId={sessionId}
            dispatch={dispatch}
            browser={browser}
          />
        ))
      ) : (
        <div className="placeholder-build">
          <strong>{document.appIdentity.title}</strong>
          <span>{document.appIdentity.statusText}</span>
        </div>
      )}
    </div>
  );
}

function BlockView({
  block,
  document,
  sessionId,
  dispatch,
  browser = false,
}: {
  block?: GeneratedBlock;
  document: GeneratedDocument;
  sessionId: string;
  dispatch: (event: KernelEvent) => void;
  browser?: boolean;
}) {
  if (!block) return null;
  const className = `block block-${block.type} ${block.styleTokens.join(' ')}`;

  if (block.type === 'menu-bar') {
    return <div className={className}>{getArray(block.props.items).map((item) => <span key={item}>{item}</span>)}</div>;
  }

  if (block.type === 'toolbar') {
    return (
      <div className={className}>
        {getArray(block.props.buttons).map((button) => (
          <button key={button}>{button}</button>
        ))}
      </div>
    );
  }

  if (block.type === 'tab-strip') {
    const selected = String(block.state?.selected ?? block.props.value ?? getArray(block.props.buttons)[0] ?? '');
    return (
      <div className={className}>
        {getArray(block.props.buttons).map((tab) => (
          <button
            key={tab}
            className={tab === selected ? 'selected' : ''}
            onClick={() => dispatchBlockIntent(block, document, sessionId, dispatch, 'select', tab)}
          >
            {tab}
          </button>
        ))}
      </div>
    );
  }

  if (block.type === 'status-bar') {
    return <div className={className}>{String(block.props.text ?? '')}</div>;
  }

  if (block.type === 'split-pane') {
    return (
      <div className={className}>
        {block.children.map((childId) => (
          <BlockView key={childId} block={document.blocks[childId]} document={document} sessionId={sessionId} dispatch={dispatch} browser={browser} />
        ))}
      </div>
    );
  }

  if (block.type === 'tree') {
    return (
      <div className={className}>
        {block.props.title != null && <strong>{String(block.props.title)}</strong>}
        {getArray(block.props.items).map((item) => (
          <div className="tree-row" key={item}>
            <span>&gt;</span>
            {item}
          </div>
        ))}
      </div>
    );
  }

  if (block.type === 'list') {
    const intentId = block.eventIntents?.[0];
    return (
      <div className={className}>
        {getItems(block.props.items).map((item) => (
          <button
            key={item.id}
            className="list-row"
            onClick={() =>
              intentId &&
              dispatch({
                type: 'generated.uiEvent',
                event: {
                  sessionId,
                  baseRevision: document.revision,
                  blockId: block.id,
                  intentId,
                  eventType: 'select',
                  value: item.title,
                },
              })
            }
          >
            <span>{item.title}</span>
            <small>{item.meta}</small>
          </button>
        ))}
      </div>
    );
  }

  if (block.type === 'button' || block.type === 'command-link') {
    return (
      <button
        className={className}
        disabled={block.props.disabled === true}
        onClick={() => dispatchBlockIntent(block, document, sessionId, dispatch, 'click', block.props.value ?? block.props.label)}
      >
        <strong>{String(block.props.label ?? block.props.text ?? 'Command')}</strong>
        {block.props.text != null && block.props.label != null && <span>{String(block.props.text)}</span>}
      </button>
    );
  }

  if (block.type === 'checkbox') {
    return (
      <label className={className}>
        <input
          type="checkbox"
          checked={block.props.value === true}
          disabled={block.props.disabled === true}
          onChange={(event) => dispatchBlockIntent(block, document, sessionId, dispatch, 'change', event.currentTarget.checked)}
        />
        <span>{String(block.props.label ?? block.props.text ?? '')}</span>
      </label>
    );
  }

  if (block.type === 'radio-group') {
    const value = String(block.props.value ?? '');
    return (
      <fieldset className={className}>
        {block.props.label != null && <legend>{String(block.props.label)}</legend>}
        {getArray(block.props.items).map((item) => (
          <label key={item}>
            <input
              type="radio"
              name={`${sessionId}-${block.id}`}
              checked={item === value}
              disabled={block.props.disabled === true}
              onChange={() => dispatchBlockIntent(block, document, sessionId, dispatch, 'change', item)}
            />
            {item}
          </label>
        ))}
      </fieldset>
    );
  }

  if (block.type === 'select') {
    return (
      <label className={className}>
        <span>{String(block.props.label ?? '')}</span>
        <select
          value={String(block.props.value ?? '')}
          disabled={block.props.disabled === true}
          onChange={(event) => dispatchBlockIntent(block, document, sessionId, dispatch, 'change', event.currentTarget.value)}
        >
          {getArray(block.props.items).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>
    );
  }

  if (block.type === 'slider') {
    return (
      <label className={className}>
        <span>{String(block.props.label ?? '')}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={typeof block.props.value === 'number' ? block.props.value : 50}
          disabled={block.props.disabled === true}
          onChange={(event) => dispatchBlockIntent(block, document, sessionId, dispatch, 'change', Number(event.currentTarget.value))}
        />
      </label>
    );
  }

  if (block.type === 'text-input' || block.type === 'search-input') {
    return (
      <label className={className}>
        <span>{String(block.props.label ?? '')}</span>
        <input
          value={String(block.props.value ?? '')}
          placeholder={String(block.props.text ?? '')}
          disabled={block.props.disabled === true}
          readOnly
          onClick={() => dispatchBlockIntent(block, document, sessionId, dispatch, 'click', block.props.value)}
        />
      </label>
    );
  }

  if (block.type === 'form') {
    const fields = Array.isArray(block.props.fields) ? block.props.fields : [];
    return (
      <form
        className={className}
        onSubmit={(event) => {
          event.preventDefault();
          dispatchBlockIntent(block, document, sessionId, dispatch, 'submit', block.props.title);
        }}
      >
        {block.props.title != null && <h3>{String(block.props.title)}</h3>}
        {fields.map((field, index) => {
          if (!isFormField(field)) return null;
          return (
            <label key={`${field.label}-${index}`}>
              <span>{field.label}</span>
              <input value={field.value} readOnly disabled={field.disabled} />
            </label>
          );
        })}
        {block.props.text != null && <p>{String(block.props.text)}</p>}
        <button type="submit" disabled={block.props.disabled === true}>Submit</button>
      </form>
    );
  }

  if (block.type === 'panel' || block.type === 'group-box') {
    return (
      <div className={className}>
        {block.props.title != null && <h3>{String(block.props.title)}</h3>}
        {block.props.display != null && <div className="generated-display">{String(block.props.display)}</div>}
        {block.props.caption != null && <p>{String(block.props.caption)}</p>}
        {block.props.text != null && <p>{String(block.props.text)}</p>}
        {Array.isArray(block.props.buttons) && (
          <div className="generated-button-grid">
            {getArray(block.props.buttons).map((button) => (
              <button
                key={button}
                onClick={() => {
                  const intentId = block.eventIntents?.[0];
                  if (!intentId) return;
                  dispatch({
                    type: 'generated.uiEvent',
                    event: {
                      sessionId,
                      baseRevision: document.revision,
                      blockId: block.id,
                      intentId,
                      eventType: 'click',
                      value: button,
                    },
                  });
                }}
              >
                {button}
              </button>
            ))}
          </div>
        )}
        {block.children.map((childId) => (
          <BlockView key={childId} block={document.blocks[childId]} document={document} sessionId={sessionId} dispatch={dispatch} browser={browser} />
        ))}
      </div>
    );
  }

  if (block.type === 'dialog' || block.type === 'toast' || block.type === 'progress') {
    return (
      <div className={className} role={block.type === 'dialog' ? 'dialog' : 'status'}>
        {block.props.title != null && <h3>{String(block.props.title)}</h3>}
        {block.props.text != null && <p>{String(block.props.text)}</p>}
        {block.type === 'progress' && (
          <div className="progress-meter">
            {Array.from({ length: 10 }, (_, index) => (
              <span key={index} className={index < Math.ceil(boundedPercent(block.props.value) / 10) ? 'filled' : ''} />
            ))}
          </div>
        )}
        {Array.isArray(block.props.buttons) && (
          <div className="generated-button-row">
            {getArray(block.props.buttons).map((button) => (
              <button key={button} onClick={() => dispatchBlockIntent(block, document, sessionId, dispatch, 'click', button)}>
                {button}
              </button>
            ))}
          </div>
        )}
        {block.children.map((childId) => (
          <BlockView key={childId} block={document.blocks[childId]} document={document} sessionId={sessionId} dispatch={dispatch} browser={browser} />
        ))}
      </div>
    );
  }

  if (block.type === 'table') {
    const columns = getArray(block.props.columns);
    const rows = Array.isArray(block.props.rows) ? block.props.rows : [];
    return (
      <table className={className}>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              onClick={() => dispatchBlockIntent(block, document, sessionId, dispatch, 'select', row)}
            >
              {Array.isArray(row) && row.map((cell, cellIndex) => <td key={cellIndex}>{String(cell)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (block.type === 'property-sheet') {
    const groups = Array.isArray(block.props.groups) ? block.props.groups : [];
    return (
      <div className={className}>
        {groups.map((group, index) => {
          if (!isGroup(group)) return null;
          return (
            <fieldset key={index}>
              <legend>{group.title}</legend>
              {group.rows.map((row) => (
                <label key={row}>
                  <input type="checkbox" checked readOnly />
                  {row}
                </label>
              ))}
            </fieldset>
          );
        })}
      </div>
    );
  }

  if (block.type === 'file-list') {
    const files = Array.isArray(block.props.files) ? block.props.files : [];
    return (
      <div className={className}>
        <div className="file-path">{String(block.props.path ?? '')}</div>
        <table>
          <thead>
            <tr>{getArray(block.props.columns).map((column) => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {files.map((file, index) => {
              if (!isFileItem(file)) return null;
              return (
                <tr key={index}>
                  <td>{file.name}</td>
                  <td>{file.type}</td>
                  <td>{file.size}</td>
                  <td>{file.modified}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === 'paint-canvas') {
    return (
      <div className={className}>
        <div className="paint-tools">
          {getArray(block.props.tools).map((tool) => <button key={tool}>{tool}</button>)}
        </div>
        <div className="paint-main">
          <div className="paint-bitmap">
            {getArray(block.props.pixels).map((row, y) => (
              <div key={y}>
                {row.split('').map((pixel, x) => <span key={`${x}-${pixel}`} className={`pixel ${pixelClass(pixel)}`} />)}
              </div>
            ))}
          </div>
          <p>{String(block.props.caption ?? '')}</p>
        </div>
        <div className="paint-palette">
          {getArray(block.props.colors).map((color) => <span key={color} className={swatchClass(color)} />)}
        </div>
      </div>
    );
  }

  if (block.type === 'image-placeholder' || block.type === 'generated-bitmap') {
    const resource = block.type === 'generated-bitmap' && typeof block.props.resourceId === 'string'
      ? document.resourceManifest.resources[block.props.resourceId]
      : undefined;
    return (
      <figure className={className}>
        {resource?.dataUrl ? (
          <img
            src={resource.dataUrl}
            width={resource.width}
            height={resource.height}
            alt={String(block.props.altText ?? resource.altText ?? block.props.caption ?? 'Generated bitmap')}
          />
        ) : (
          <div className="bitmap-placeholder">
            <Monitor size={28} />
            <span>{String(block.props.title ?? 'Generated image placeholder')}</span>
          </div>
        )}
        {(block.props.caption != null || resource?.hash) && (
          <figcaption>{String(block.props.caption ?? `Resource ${resource?.hash.slice(0, 12)}`)}</figcaption>
        )}
      </figure>
    );
  }

  if (block.type === 'rich-text-spans') {
    const spans = Array.isArray(block.props.spans) ? block.props.spans : [];
    return (
      <p className={className}>
        {spans.map((span, index) => (
          <span key={index}>{isTextSpan(span) ? span.text : ''}</span>
        ))}
      </p>
    );
  }

  if (block.type === 'chart' || block.type === 'timeline') {
    const items = Array.isArray(block.props.items) ? block.props.items : [];
    return (
      <div className={className}>
        {block.props.title != null && <h3>{String(block.props.title)}</h3>}
        {items.map((item, index) => (
          <div key={index} className="timeline-row">
            {isLabelValueItem(item) ? (
              <>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </>
            ) : (
              <span>{String(index + 1)}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (block.type === 'terminal-transcript') {
    return (
      <pre className={className}>{String(block.props.text ?? '')}</pre>
    );
  }

  if (block.type === 'download-portal') {
    return (
      <div className={className}>
        <header>
          <h1>{String(block.props.title ?? '')}</h1>
          <span>{String(block.props.version ?? '')}</span>
        </header>
        <div className="download-layout">
          <main>
            <h2>Download Mirrors</h2>
            {getArray(block.props.mirrors).map((mirror) => (
              <button
                key={mirror}
                className="download-button"
                onClick={() => dispatchBlockIntent(block, document, sessionId, dispatch, 'click', mirror)}
              >
                {mirror}
              </button>
            ))}
            <h2>System Requirements</h2>
            <ul>{getArray(block.props.requirements).map((item) => <li key={item}>{item}</li>)}</ul>
          </main>
          <aside>
            {getArray(block.props.badges).map((badge) => <span key={badge} className="old-badge">{badge}</span>)}
            <p>{String(block.props.ad ?? '')}</p>
          </aside>
        </div>
      </div>
    );
  }

  if (block.type === 'nested-os-desktop') {
    const windows = Array.isArray(block.props.windows) ? block.props.windows : [];
    return (
      <div className={className}>
        <div className="nested-icons">
          {getArray(block.props.icons).map((icon) => (
            <button key={icon} onClick={() => dispatchBlockIntent(block, document, sessionId, dispatch, 'open-dialog', icon)}>
              <Monitor size={20} />{icon}
            </button>
          ))}
        </div>
        <div className="nested-windows">
          {windows.map((innerWindow, index) => {
            if (!isNestedWindow(innerWindow)) return null;
            return (
              <section key={index} className="nested-window">
                <strong>{innerWindow.title}</strong>
                <p>{innerWindow.text}</p>
              </section>
            );
          })}
        </div>
        <div className="nested-taskbar">{getArray(block.props.taskbar).map((item) => <span key={item}>{item}</span>)}</div>
      </div>
    );
  }

  if (block.type === 'search-home') {
    return (
      <div className={className}>
        <div className="google-logo">{String(block.props.brand ?? 'Google')}</div>
        <input value={String(block.props.inputValue ?? '')} readOnly />
        <div>
          {getArray(block.props.buttons).map((button) => (
            <button key={button}>{button}</button>
          ))}
        </div>
        <p>{String(block.props.note ?? '')}</p>
      </div>
    );
  }

  if (block.type === 'search-results') {
    const results = Array.isArray(block.props.results) ? block.props.results : [];
    return (
      <div className={className}>
        <div className="google-search-line">
          <strong>Google</strong>
          <input value={String(block.props.query ?? '')} readOnly />
        </div>
        {results.map((result, index) => {
          if (!isSearchItem(result)) return null;
          return (
            <div className="google-result" key={index}>
              <button
                className="facsimile-link"
                onClick={() => dispatchSimulatedNavigation(sessionId, dispatch, result.url)}
              >
                {result.title}
              </button>
              <cite>{result.url}</cite>
              <p>{result.snippet}</p>
            </div>
          );
        })}
      </div>
    );
  }

  if (block.type === 'wiki-article') {
    const contents = getArray(block.props.contents);
    const sections = Array.isArray(block.props.sections) ? block.props.sections : [];
    return (
      <article className={className}>
        <aside className="wiki-left">Navigation<br />Main page<br />Contents<br />Random article</aside>
        <main>
          <div className="wiki-tabs">Article Discussion Edit History</div>
          <h1>{String(block.props.title ?? '')}</h1>
          <div className="wiki-content-box">
            <strong>Contents</strong>
            {contents.map((item, index) => <span key={item}>{index + 1}. {item}</span>)}
          </div>
          <p>{String(block.props.lead ?? '')}</p>
          {sections.map((section, index) => {
            if (!isArticleSection(section)) return null;
            return (
              <section key={index}>
                <h2>{section.heading}</h2>
                <p>{section.text}</p>
              </section>
            );
          })}
        </main>
        <aside className="wiki-infobox">
          <strong>{String(block.props.title ?? '')}</strong>
          {Array.isArray(block.props.infobox) &&
            block.props.infobox.map((row, index) => (
              <div key={index}>{Array.isArray(row) ? `${row[0]}: ${row[1]}` : String(row)}</div>
            ))}
        </aside>
      </article>
    );
  }

  if (block.type === 'encyclopedia-article') {
    return (
      <article className={className}>
        <div className="encarta-media">Media<br />{String(block.props.caption ?? '')}</div>
        <div>
          <h1>{String(block.props.title ?? '')}</h1>
          <p>{String(block.props.lead ?? '')}</p>
          {getArray(block.props.sections).map((section) => (
            <h2 key={section}>{section}</h2>
          ))}
        </div>
      </article>
    );
  }

  if (block.type === 'plain-example-page') {
    return (
      <div className={className}>
        <div className="example-domain-box">
          <h1>{String(block.props.title ?? 'Example Domain')}</h1>
          <p>{String(block.props.paragraph ?? '')}</p>
          <button
            className="facsimile-link"
            onClick={() => dispatchSimulatedNavigation(sessionId, dispatch, 'https://www.iana.org/domains/example')}
          >
            {String(block.props.linkText ?? 'More information...')}
          </button>
        </div>
      </div>
    );
  }

  if (block.type === 'facsimile-page') {
    return (
      <div className={className}>
        <h1>{String(block.props.title ?? block.props.displayUrl ?? '')}</h1>
        <p>{String(block.props.body ?? 'Simulated offline page.')}</p>
        {Array.isArray(block.props.nav) && (
          <nav>
            {getArray(block.props.nav).map((item) => (
              <button key={item} onClick={() => dispatchSimulatedNavigation(sessionId, dispatch, `${String(block.props.displayUrl ?? '')}${item}`)}>
                {item}
              </button>
            ))}
          </nav>
        )}
      </div>
    );
  }

  if (block.type === 'facsimile-address-bar') {
    return (
      <div className={className}>
        <span>Address</span>
        <input value={String(block.props.displayUrl ?? '')} readOnly />
        <button onClick={() => {
          if (browser) {
            dispatchSimulatedNavigation(sessionId, dispatch, block.props.displayUrl);
            return;
          }
          dispatchBlockIntent(block, document, sessionId, dispatch, 'navigate-simulated', block.props.displayUrl);
        }}>
          Go
        </button>
      </div>
    );
  }

  if (
    block.type === 'fan-site' ||
    block.type === 'corporate-site' ||
    block.type === 'forum-thread' ||
    block.type === 'classic-software-page' ||
    block.type === 'control-panel-page'
  ) {
    return (
      <div className={className}>
        <header>
          <h1>{String(block.props.title ?? block.props.displayUrl ?? '')}</h1>
          {block.props.displayUrl != null && <small>{String(block.props.displayUrl)}</small>}
        </header>
        {Array.isArray(block.props.nav) && (
          <nav>
            {getArray(block.props.nav).map((item) => (
              <button key={item} onClick={() => dispatchSimulatedNavigation(sessionId, dispatch, `${String(block.props.displayUrl ?? '')}${item}`)}>
                {item}
              </button>
            ))}
          </nav>
        )}
        <p>{String(block.props.body ?? block.props.text ?? '')}</p>
        {block.children.map((childId) => (
          <BlockView key={childId} block={document.blocks[childId]} document={document} sessionId={sessionId} dispatch={dispatch} browser={browser} />
        ))}
      </div>
    );
  }

  if (block.type === 'text' || block.type === 'heading') {
    return <div className={className}>{String(block.props.text ?? block.props.title ?? '')}</div>;
  }

  return (
    <div className={className}>
      {block.children.map((childId) => (
        <BlockView key={childId} block={document.blocks[childId]} document={document} sessionId={sessionId} dispatch={dispatch} browser={browser} />
      ))}
    </div>
  );
}

function getArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function dispatchBlockIntent(
  block: GeneratedBlock,
  document: GeneratedDocument,
  sessionId: string,
  dispatch: (event: KernelEvent) => void,
  eventType: UiEvent['eventType'],
  value: unknown,
) {
  const intentId = block.eventIntents?.find((id) => document.eventIntents[id]?.eventType === eventType) ?? block.eventIntents?.[0];
  if (!intentId) return;
  const intent = intentId ? document.eventIntents[intentId] : undefined;
  if (!intent || intent.eventType !== eventType) return;
  dispatch({
    type: 'generated.uiEvent',
    event: {
      sessionId,
      baseRevision: document.revision,
      blockId: block.id,
      intentId,
      eventType: intent.eventType,
      value,
    },
  });
}

function dispatchSimulatedNavigation(
  sessionId: string,
  dispatch: (event: KernelEvent) => void,
  address: unknown,
) {
  const nextAddress = String(address ?? '').trim();
  if (!nextAddress) return;
  dispatch({ type: 'browser.navigate', sessionId, address: nextAddress });
}

function boundedPercent(value: unknown) {
  const numeric = typeof value === 'number' ? value : 35;
  return Math.max(0, Math.min(100, numeric));
}

function getItems(value: unknown): Array<{ id: string; title: string; meta: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (typeof item === 'object' && item !== null && 'title' in item) {
      return [
        {
          id: String('id' in item ? item.id : index),
          title: String(item.title),
          meta: String('meta' in item ? item.meta : ''),
        },
      ];
    }
    return [];
  });
}

function isSearchItem(value: unknown): value is { title: string; url: string; snippet: string } {
  return typeof value === 'object' && value !== null && 'title' in value && 'url' in value && 'snippet' in value;
}

function isArticleSection(value: unknown): value is { heading: string; text: string } {
  return typeof value === 'object' && value !== null && 'heading' in value && 'text' in value;
}

function isGroup(value: unknown): value is { title: string; rows: string[] } {
  return typeof value === 'object' && value !== null && 'title' in value && 'rows' in value && Array.isArray(value.rows);
}

function isFileItem(value: unknown): value is { name: string; type: string; size: string; modified: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'type' in value &&
    'size' in value &&
    'modified' in value
  );
}

function isNestedWindow(value: unknown): value is { title: string; text: string } {
  return typeof value === 'object' && value !== null && 'title' in value && 'text' in value;
}

function isFormField(value: unknown): value is { label: string; value: string; disabled?: boolean } {
  return typeof value === 'object' && value !== null && 'label' in value && 'value' in value;
}

function isTextSpan(value: unknown): value is { text: string } {
  return typeof value === 'object' && value !== null && 'text' in value;
}

function isLabelValueItem(value: unknown): value is { label: string; value: string } {
  return typeof value === 'object' && value !== null && 'label' in value && 'value' in value;
}

function pixelClass(pixel: string) {
  if (pixel === 'B') return 'pixel-blue';
  if (pixel === 'W') return 'pixel-window';
  if (pixel === 'R') return 'pixel-red';
  return 'pixel-empty';
}

function swatchClass(color: string) {
  const key = color.toLowerCase();
  if (key === '#000000') return 'swatch-black';
  if (key === '#ffffff') return 'swatch-white';
  if (key === '#c00000') return 'swatch-red';
  if (key === '#008000') return 'swatch-green';
  if (key === '#0000c0') return 'swatch-blue';
  if (key === '#ffff00') return 'swatch-yellow';
  if (key === '#ff00ff') return 'swatch-magenta';
  if (key === '#00ffff') return 'swatch-cyan';
  return 'swatch-white';
}
