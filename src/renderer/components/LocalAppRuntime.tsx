import { useMemo, useRef, useState } from 'react';

export type LocalRuntimeAppName = 'Calculator' | 'Browser' | 'Notepad';

export type CalculatorRuntimeState = {
  display: string;
  operand: number | null;
  operator: CalculatorOperator | null;
  waitingForOperand: boolean;
};

export type BrowserRuntimeState = {
  address: string;
  page: string;
  refreshCount: number;
};

export type NotepadRuntimeState = {
  text: string;
};

export type LocalRuntimeState = CalculatorRuntimeState | BrowserRuntimeState | NotepadRuntimeState;

export type LocalRuntimeResult = {
  title: string;
  state: LocalRuntimeState;
  narration: string | null;
  html: string;
};

export interface LocalAppRuntimeProps {
  appName: string;
  state?: unknown;
  onStateChange?(state: LocalRuntimeState): void;
  onResultChange?(result: LocalRuntimeResult): void;
}

type CalculatorOperator = '+' | '-' | '*' | '/';
type CalculatorKey = CalculatorOperator | '=' | 'C' | '.' | `${number}`;
type BrowserPageKind = 'home' | 'search' | 'article' | 'external';

const LOCAL_RUNTIME_APPS: LocalRuntimeAppName[] = ['Calculator', 'Browser', 'Notepad'];
const CALCULATOR_KEYS: CalculatorKey[] = ['C', '/', '*', '-', '7', '8', '9', '+', '4', '5', '6', '=', '1', '2', '3', '0', '.'];

export default function LocalAppRuntime({
  appName,
  state,
  onStateChange,
  onResultChange
}: LocalAppRuntimeProps): React.JSX.Element {
  const normalizedState = useMemo(() => normalizeLocalRuntimeState(appName, state), [appName, state]);
  const [internalState, setInternalState] = useState<LocalRuntimeState>(() => normalizedState);
  const runtimeState = state === undefined ? internalState : normalizedState;

  function commit(nextState: LocalRuntimeState): void {
    setInternalState(nextState);
    onStateChange?.(nextState);
    if (onResultChange && isLocalRuntimeApp(appName)) {
      onResultChange(createLocalRuntimeResult(appName, nextState));
    }
  }

  if (appName === 'Calculator') {
    return <CalculatorRuntime state={normalizeCalculatorState(runtimeState)} onChange={commit} />;
  }

  if (appName === 'Browser') {
    return <BrowserRuntime state={normalizeBrowserState(runtimeState)} onChange={commit} />;
  }

  if (appName === 'Notepad') {
    return <NotepadRuntime state={normalizeNotepadState(runtimeState)} onChange={commit} />;
  }

  return (
    <div className="v-app">
      <div className="v-card">
        <h1>Unsupported local app</h1>
        <p className="v-muted">{appName} does not have a local React runtime.</p>
      </div>
    </div>
  );
}

export function isLocalRuntimeApp(appName: string): appName is LocalRuntimeAppName {
  return LOCAL_RUNTIME_APPS.includes(appName as LocalRuntimeAppName);
}

export function createInitialLocalRuntimeState(appName: LocalRuntimeAppName): LocalRuntimeState {
  switch (appName) {
    case 'Calculator':
      return createInitialCalculatorState();
    case 'Browser':
      return createInitialBrowserState();
    case 'Notepad':
      return createInitialNotepadState();
  }
}

export function createLocalRuntimeResult(appName: LocalRuntimeAppName, state: LocalRuntimeState): LocalRuntimeResult {
  const normalizedState = normalizeLocalRuntimeState(appName, state);
  return {
    title: createLocalRuntimeTitle(appName, normalizedState),
    state: normalizedState,
    narration: null,
    html: ''
  };
}

function CalculatorRuntime({
  state,
  onChange
}: {
  state: CalculatorRuntimeState;
  onChange(state: CalculatorRuntimeState): void;
}): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);

  function pressKey(key: CalculatorKey): void {
    onChange(applyCalculatorKey(state, key));
    rootRef.current?.focus();
  }

  return (
    <div
      ref={rootRef}
      className="v-app v-calc"
      tabIndex={0}
      onKeyDown={(event) => {
        const key = event.key === 'Enter' ? '=' : event.key;
        if (isCalculatorKey(key)) {
          event.preventDefault();
          onChange(applyCalculatorKey(state, key));
        }
      }}
    >
      <div className="v-calc-expression" aria-live="polite">
        {formatCalculatorExpression(state)}
      </div>
      <div className="v-display" role="status" aria-live="polite">
        {state.display}
      </div>
      <div className="v-keypad">
        {CALCULATOR_KEYS.map((key) => (
          <button className={calculatorKeyClassName(key)} key={key} type="button" onClick={() => pressKey(key)}>
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}

function BrowserRuntime({
  state,
  onChange
}: {
  state: BrowserRuntimeState;
  onChange(state: BrowserRuntimeState): void;
}): React.JSX.Element {
  const pageTitle = createBrowserPageTitle(state.address, state.page);

  function updateAddress(address: string): void {
    onChange({ ...state, address });
  }

  function navigate(address: string): void {
    onChange({ ...state, address, page: addressToPage(address) });
  }

  function goHome(): void {
    onChange({ ...state, address: 'vibe://home', page: 'home' });
  }

  function refresh(): void {
    onChange({ ...state, page: addressToPage(state.address), refreshCount: state.refreshCount + 1 });
  }

  return (
    <div className="v-app v-browser">
      <div className="v-toolbar">
        <button className="v-button" type="button" disabled>
          Back
        </button>
        <button className="v-button" type="button" disabled>
          Forward
        </button>
        <button className="v-button" type="button" onClick={refresh}>
          Refresh
        </button>
        <button className="v-button" type="button" onClick={goHome}>
          Home
        </button>
      </div>
      <form
        className="v-row v-address"
        onSubmit={(event) => {
          event.preventDefault();
          const addressInput = event.currentTarget.elements.namedItem('address');
          navigate(addressInput instanceof HTMLInputElement ? addressInput.value : state.address);
        }}
      >
        <input
          className="v-input"
          name="address"
          aria-label="Address"
          value={state.address}
          onChange={(event) => updateAddress(event.currentTarget.value)}
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
          onMouseUp={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              navigate(event.currentTarget.value);
            }
          }}
        />
        <button className="v-button v-primary" type="submit">
          Go
        </button>
      </form>
      <main className="v-browser-page">
        <BrowserPage state={state} pageTitle={pageTitle} onNavigate={navigate} />
        {state.refreshCount > 0 ? <p className="v-muted">Refreshed locally {state.refreshCount} times.</p> : null}
      </main>
    </div>
  );
}

function BrowserPage({
  state,
  pageTitle,
  onNavigate
}: {
  state: BrowserRuntimeState;
  pageTitle: string;
  onNavigate(address: string): void;
}): React.JSX.Element {
  const pageKind = classifyBrowserPage(state.address, state.page);
  const subject = extractBrowserSubject(state.address, state.page);

  if (pageKind === 'home') {
    return (
      <article className="v-web-page v-web-home">
        <header className="v-web-hero">
          <span className="v-fake-logo">VN</span>
          <div>
            <h1>{pageTitle}</h1>
            <p>Offline portal for generated search, encyclopedia pages, and fake websites.</p>
          </div>
        </header>
        <section className="v-web-grid">
          {[
            { title: 'Search the Offline Web', address: 'google.com/search?q=Hanselman+Wikipedia', copy: 'Draws a fake search results page with snippets and cached links.' },
            { title: 'Open an Article', address: 'wikipedia.org/wiki/Mark_Russinovich', copy: 'Builds an encyclopedia-style article layout with a contents rail.' },
            { title: 'Visit a Fake Site', address: 'neocities.example/commander-xe', copy: 'Renders a complete local website shell without network access.' }
          ].map((item) => (
            <button className="v-web-card" type="button" key={item.address} onClick={() => onNavigate(item.address)}>
              <strong>{item.title}</strong>
              <span>{item.copy}</span>
              <em>{item.address}</em>
            </button>
          ))}
        </section>
        <footer className="v-web-status">Local cache ready. No network request will be made.</footer>
      </article>
    );
  }

  if (pageKind === 'article') {
    const facts = createFakeFacts(subject);
    return (
      <article className="v-web-page v-web-article">
        <aside className="v-web-sidebar">
          <strong>Contents</strong>
          {['Overview', 'Career', 'Selected facts', 'See also'].map((item) => (
            <button className="v-button" type="button" key={item}>
              {item}
            </button>
          ))}
        </aside>
        <section className="v-web-content">
          <h1>{subject}</h1>
          <p>
            {subject} is described here by VibeOS as if this were a cached encyclopedia page from a very confident
            alternate internet.
          </p>
          <div className="v-fake-image">Simulated article image</div>
          <h2>Selected facts</h2>
          <ul className="v-list">
            {facts.map((fact) => (
              <li className="v-list-item" key={fact}>
                {fact}
              </li>
            ))}
          </ul>
        </section>
        <aside className="v-web-infobox">
          <strong>{subject}</strong>
          <span>Source: VibeOS offline cache</span>
          <span>Verified: no</span>
          <span>Style: 1998 reference</span>
        </aside>
      </article>
    );
  }

  if (pageKind === 'search') {
    const results = createSearchResults(subject);
    return (
      <article className="v-web-page v-web-search">
        <header className="v-web-search-header">
          <span className="v-fake-logo">VS</span>
          <div>
            <h1>Search results for {subject}</h1>
            <p>This fake search engine confidently found pages that may or may not exist.</p>
          </div>
        </header>
        <section className="v-web-results">
          {results.map((result, index) => (
            <button
              className="v-web-result"
              type="button"
              key={result.title}
              onClick={() => onNavigate(index === 0 ? `wikipedia.org/wiki/${slugify(subject)}` : `vibe://${slugify(result.title)}`)}
            >
              <span className="v-web-url">{result.url}</span>
              <strong>{result.title}</strong>
              <span>{result.summary}</span>
            </button>
          ))}
        </section>
        <aside className="v-web-related">
          <strong>Related searches</strong>
          {createRelatedSearches(subject).map((related) => (
            <button className="v-button" type="button" key={related} onClick={() => onNavigate(`google.com/search?q=${encodeURIComponent(related)}`)}>
              {related}
            </button>
          ))}
        </aside>
      </article>
    );
  }

  return (
    <article className="v-web-page v-web-site">
      <header className="v-web-site-nav">
        <span className="v-fake-logo">{initials(subject)}</span>
        <button className="v-button" type="button">Home</button>
        <button className="v-button" type="button">Archive</button>
        <button className="v-button" type="button">Guestbook</button>
      </header>
      <section className="v-web-site-hero">
        <div>
          <h1>{pageTitle}</h1>
          <p>
            VibeOS rendered a local hallucinated website for <strong>{subject}</strong>. It looks browsable, but it is
            not connected to the internet.
          </p>
        </div>
        <div className="v-fake-image">Offline website preview</div>
      </section>
      <section className="v-web-grid">
        {['Latest update', 'Featured download', 'Visitor counter'].map((item) => (
          <div className="v-web-card" key={item}>
            <strong>{item}</strong>
            <span>{createSiteCopy(subject, item)}</span>
          </div>
        ))}
      </section>
      <footer className="v-web-status">Current local route: {state.page}</footer>
    </article>
  );
}

function NotepadRuntime({
  state,
  onChange
}: {
  state: NotepadRuntimeState;
  onChange(state: NotepadRuntimeState): void;
}): React.JSX.Element {
  return (
    <div className="v-app">
      <div className="v-menu">
        <span>File</span>
        <span>Edit</span>
        <span>Format</span>
        <span>View</span>
        <span>Help</span>
      </div>
      <textarea
        className="v-textarea"
        aria-label="Text"
        value={state.text}
        onChange={(event) => onChange({ text: event.currentTarget.value.slice(0, 10000) })}
      />
      <p className="v-muted">{state.text.length} characters in this simulated document.</p>
    </div>
  );
}

function normalizeLocalRuntimeState(appName: string, state: unknown): LocalRuntimeState {
  switch (appName) {
    case 'Calculator':
      return normalizeCalculatorState(state);
    case 'Browser':
      return normalizeBrowserState(state);
    case 'Notepad':
      return normalizeNotepadState(state);
    default:
      return createInitialNotepadState();
  }
}

function normalizeCalculatorState(state: unknown): CalculatorRuntimeState {
  const fallback = createInitialCalculatorState();
  if (!isRecord(state)) {
    return fallback;
  }

  return {
    display: typeof state.display === 'string' ? state.display : fallback.display,
    operand: typeof state.operand === 'number' && Number.isFinite(state.operand) ? state.operand : null,
    operator: isCalculatorOperator(state.operator) ? state.operator : null,
    waitingForOperand: typeof state.waitingForOperand === 'boolean' ? state.waitingForOperand : fallback.waitingForOperand
  };
}

function normalizeBrowserState(state: unknown): BrowserRuntimeState {
  const fallback = createInitialBrowserState();
  if (!isRecord(state)) {
    return fallback;
  }

  const address = typeof state.address === 'string' ? state.address : fallback.address;
  const page = typeof state.page === 'string' ? state.page : addressToPage(address);
  const refreshCount = typeof state.refreshCount === 'number' && Number.isFinite(state.refreshCount) ? state.refreshCount : fallback.refreshCount;
  return { address, page, refreshCount };
}

function normalizeNotepadState(state: unknown): NotepadRuntimeState {
  const fallback = createInitialNotepadState();
  if (!isRecord(state)) {
    return fallback;
  }

  return {
    text: typeof state.text === 'string' ? state.text : fallback.text
  };
}

function createInitialCalculatorState(): CalculatorRuntimeState {
  return { display: '0', operand: null, operator: null, waitingForOperand: false };
}

function createInitialBrowserState(): BrowserRuntimeState {
  return { address: 'vibe://home', page: 'home', refreshCount: 0 };
}

function createInitialNotepadState(): NotepadRuntimeState {
  return { text: '' };
}

function applyCalculatorKey(state: CalculatorRuntimeState, key: CalculatorKey): CalculatorRuntimeState {
  if (key === 'C' || state.display === 'Error') {
    return key === 'C' ? createInitialCalculatorState() : applyCalculatorKey(createInitialCalculatorState(), key);
  }

  if (/^\d$/.test(key)) {
    const display = state.waitingForOperand || state.display === '0' ? key : `${state.display}${key}`;
    return { ...state, display: display.slice(0, 14), waitingForOperand: false };
  }

  if (key === '.') {
    if (state.waitingForOperand) {
      return { ...state, display: '0.', waitingForOperand: false };
    }
    if (state.display.includes('.')) {
      return state;
    }
    return { ...state, display: `${state.display}.` };
  }

  if (isCalculatorOperator(key)) {
    if (state.operator && state.operand !== null && !state.waitingForOperand) {
      const result = calculate(state.operand, Number(state.display), state.operator);
      return {
        display: formatCalculatorResult(result),
        operand: result,
        operator: key,
        waitingForOperand: true
      };
    }

    return {
      ...state,
      operand: Number(state.display),
      operator: key,
      waitingForOperand: true
    };
  }

  if (key === '=' && state.operator && state.operand !== null) {
    const result = calculate(state.operand, Number(state.display), state.operator);
    return {
      display: formatCalculatorResult(result),
      operand: null,
      operator: null,
      waitingForOperand: true
    };
  }

  return state;
}

function formatCalculatorExpression(state: CalculatorRuntimeState): string {
  if (state.operator && state.operand !== null) {
    return `${formatCalculatorOperand(state.operand)} ${state.operator}${state.waitingForOperand ? '' : ` ${state.display}`}`;
  }
  return 'Ready';
}

function calculate(left: number, right: number, operator: CalculatorOperator): number {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      return right === 0 ? Number.NaN : left / right;
  }
}

function formatCalculatorResult(result: number): string {
  if (!Number.isFinite(result)) {
    return 'Error';
  }

  return String(Number(result.toPrecision(12))).slice(0, 14);
}

function formatCalculatorOperand(value: number): string {
  return String(Number(value.toPrecision(12))).slice(0, 14);
}

function addressToPage(address: string): string {
  const trimmedAddress = address.trim();
  return trimmedAddress.replace(/^vibe:\/\//i, '') || 'home';
}

function createBrowserPageTitle(address: string, page: string): string {
  const kind = classifyBrowserPage(address, page);
  const subject = extractBrowserSubject(address, page);
  if (kind === 'home') {
    return 'VibeNet Home';
  }
  if (kind === 'search') {
    return `Hallucinated search: ${subject}`;
  }
  if (kind === 'article') {
    return `Offline article: ${subject}`;
  }
  return `Offline page: ${page}`;
}

function classifyBrowserPage(address: string, page: string): BrowserPageKind {
  const normalized = `${address} ${page}`.trim().toLowerCase();
  const addressText = address.trim();
  const normalizedAddress = addressText.toLowerCase().replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '');
  const looksLikeUrl = /^[a-z]+:\/\//i.test(addressText) || /^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(addressText);
  if (!normalized || normalized === 'home' || normalized.includes('vibe://home')) {
    return 'home';
  }
  if (
    normalizedAddress.startsWith('wikipedia.org/wiki/') ||
    normalizedAddress.startsWith('en.wikipedia.org/wiki/') ||
    normalizedAddress.startsWith('encarta') ||
    normalizedAddress.includes('/wiki/')
  ) {
    return 'article';
  }
  if (
    normalized.includes('google') ||
    normalized.includes('search') ||
    normalized.includes('?q=') ||
    normalized.includes('bing') ||
    !looksLikeUrl
  ) {
    return 'search';
  }
  return 'external';
}

function extractBrowserSubject(address: string, page: string): string {
  const raw = address.trim() || page.trim() || 'VibeOS';
  const withoutScheme = raw
    .replace(/^https?:\/\//i, '')
    .replace(/^vibe:\/\//i, '')
    .replace(/^www\./i, '');
  const query = withoutScheme.match(/[?&]q=([^&]+)/i)?.[1];
  const subject = decodeURIComponent(query ?? withoutScheme)
    .replace(/^google\.com\/?/i, '')
    .replace(/^bing\.com\/?/i, '')
    .replace(/^wikipedia\.org\/wiki\/?/i, '')
    .replace(/^en\.wikipedia\.org\/wiki\/?/i, '')
    .replace(/[+_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return subject || 'VibeOS';
}

function createSearchResults(subject: string): Array<{ title: string; url: string; summary: string }> {
  const slug = slugify(subject);
  return [
    {
      title: `${subject} - VibePedia, the free made-up encyclopedia`,
      url: `vibepedia.local/wiki/${slug}`,
      summary: `A plausible overview of ${subject}, assembled locally by the hallucinated browser cache.`
    },
    {
      title: `Images of ${subject} from the Offline Web`,
      url: `images.vibenet.local/search/${slug}`,
      summary: 'Thumbnails omitted because VibeOS refuses to fetch real pixels during the demo.'
    },
    {
      title: `${subject} fan site archived in 1998`,
      url: `geocities.local/${slug}/index.html`,
      summary: 'Includes a guestbook, three broken counters, and a suspiciously confident biography.'
    }
  ];
}

function createRelatedSearches(subject: string): string[] {
  return [`${subject} biography`, `${subject} screenshots`, `${subject} 1998 archive`];
}

function createSiteCopy(subject: string, item: string): string {
  switch (item) {
    case 'Latest update':
      return `${subject} was refreshed in the offline cache with three new imaginary links.`;
    case 'Featured download':
      return `A simulated installer for ${subject} is listed but cannot touch the host filesystem.`;
    default:
      return '00001337 visitors, all generated locally for the stage demo.';
  }
}

function createFakeFacts(subject: string): string[] {
  return [
    `${subject} is widely cited inside VibeOS despite the browser having no network connection.`,
    `The simulated archive lists ${subject} as important enough to deserve a left navigation tree.`,
    `A local confidence meter reports 98% retro plausibility and 0% verified sourcing.`
  ];
}

function createLocalRuntimeTitle(appName: LocalRuntimeAppName, state: LocalRuntimeState): string {
  switch (appName) {
    case 'Calculator':
      return 'Calculator';
    case 'Browser': {
      const browserState = normalizeBrowserState(state);
      return `Browser - ${createBrowserPageTitle(browserState.address, browserState.page)}`;
    }
    case 'Notepad': {
      const notepadState = normalizeNotepadState(state);
      return notepadState.text ? `Notepad - ${notepadState.text.slice(0, 18)}` : 'Notepad';
    }
  }
}

function calculatorKeyClassName(key: CalculatorKey): string {
  if (key === 'C') {
    return 'v-button v-calc-clear';
  }
  if (key === '=') {
    return 'v-button v-calc-equals';
  }
  if (isCalculatorOperator(key)) {
    return 'v-button v-calc-operator';
  }
  return 'v-button';
}

function isCalculatorOperator(value: unknown): value is CalculatorOperator {
  return value === '+' || value === '-' || value === '*' || value === '/';
}

function isCalculatorKey(value: string): value is CalculatorKey {
  return value === '=' || value === 'C' || value === '.' || /^\d$/.test(value) || isCalculatorOperator(value);
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'vibeos';
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'VS';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
