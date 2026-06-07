import { useMemo, useState } from 'react';
import { APP_ICONS, ASK_VIBEOS_EXAMPLES, BUILT_IN_APP_NAMES, matchesBuiltInAppName } from '../apps/catalog';

interface StartMenuProps {
  recentGeneratedApps: string[];
  onLaunch(appName: string): void;
}

export default function StartMenu({ recentGeneratedApps, onLaunch }: StartMenuProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const filteredApps = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return BUILT_IN_APP_NAMES;
    }
    return BUILT_IN_APP_NAMES.filter((appName) => appName.toLowerCase().includes(normalized));
  }, [query]);
  const visibleRecentApps = useMemo(
    () =>
      recentGeneratedApps.filter(
        (recentAppName, index) =>
          recentAppName &&
          recentGeneratedApps.findIndex(
            (candidateAppName) => candidateAppName.toLowerCase() === recentAppName.toLowerCase()
          ) === index
      ),
    [recentGeneratedApps]
  );
  const customAppName = query.trim();

  return (
    <div className="start-menu">
      <div className="start-menu-rail">VibeOS</div>
      <div className="start-menu-apps">
        <div className="start-menu-section-title">Ask VibeOS</div>
        <form
          className="start-search"
          onSubmit={(event) => {
            event.preventDefault();
            if (customAppName) {
              onLaunch(customAppName);
            }
          }}
        >
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type any app or scene..."
            aria-label="Ask VibeOS"
          />
          <button type="submit">{customAppName ? 'Run' : 'Ask'}</button>
        </form>
        <div className="start-menu-examples" aria-label="Example generated apps">
          {ASK_VIBEOS_EXAMPLES.map((appName) => (
            <button key={appName} className="start-menu-item is-example" onClick={() => onLaunch(appName)}>
              <span className="app-icon">AI</span>
              <span>{appName}</span>
            </button>
          ))}
        </div>
        {visibleRecentApps.length ? (
          <div className="start-menu-recents" aria-label="Recent generated apps">
            <div className="start-menu-section-title">Recent</div>
            {visibleRecentApps.map((appName) => (
              <button key={appName} className="start-menu-item is-recent" onClick={() => onLaunch(appName)}>
                <span className="app-icon">R</span>
                <span>{appName}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="start-menu-section-title">Apps</div>
        {filteredApps.map((appName) => (
          <button key={appName} className="start-menu-item" onClick={() => onLaunch(appName)}>
            <span className="app-icon">{APP_ICONS[appName]}</span>
            <span>{appName}</span>
          </button>
        ))}
        {customAppName && !matchesBuiltInAppName(customAppName) ? (
          <button className="start-menu-item is-generated" onClick={() => onLaunch(customAppName)}>
            <span className="app-icon">AI</span>
            <span>Run "{customAppName}"</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
