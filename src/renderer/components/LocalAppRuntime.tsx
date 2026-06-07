import { useMemo, useState } from 'react';

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

const LOCAL_RUNTIME_APPS: LocalRuntimeAppName[] = ['Calculator', 'Browser', 'Notepad'];
const CALCULATOR_KEYS: CalculatorKey[] = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+', 'C'];

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
  return (
    <div className="v-app v-calc">
      <div className="v-display" role="status" aria-live="polite">
        {state.display}
      </div>
      <div className="v-keypad">
        {CALCULATOR_KEYS.map((key) => (
          <button className="v-button" key={key} type="button" onClick={() => onChange(applyCalculatorKey(state, key))}>
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
      <main className="v-card">
        <BrowserPage state={state} pageTitle={pageTitle} />
        {state.refreshCount > 0 ? <p className="v-muted">Refreshed locally {state.refreshCount} times.</p> : null}
      </main>
    </div>
  );
}

function BrowserPage({ state, pageTitle }: { state: BrowserRuntimeState; pageTitle: string }): React.JSX.Element {
  const pageKind = classifyBrowserPage(state.address, state.page);
  const subject = extractBrowserSubject(state.address, state.page);

  if (pageKind === 'home') {
    return (
      <>
        <h1>{pageTitle}</h1>
        <p>This is a simulated offline browser page. No network request was made.</p>
        <ul className="v-list">
          <li className="v-list-item">Try google.com and search for Hanselman Wikipedia.</li>
          <li className="v-list-item">Try wikipedia.org/wiki/Mark_Russinovich.</li>
          <li className="v-list-item">Try a plain query like rude file manager for tacos.</li>
        </ul>
        <p className="v-muted">VibeOS local browser shell; page content is hallucinated.</p>
      </>
    );
  }

  if (pageKind === 'article') {
    return (
      <>
        <h1>{subject}</h1>
        <p>
          {subject} is described here by VibeOS as if this were a cached encyclopedia page from a very confident
          alternate internet.
        </p>
        <div className="v-split">
          <aside className="v-panel">
            <strong>Contents</strong>
            {['Overview', 'Career', 'Selected facts', 'See also'].map((item) => (
              <button className="v-button" type="button" key={item}>
                {item}
              </button>
            ))}
          </aside>
          <section className="v-panel">
            <h2>Selected facts</h2>
            <ul className="v-list">
              {createFakeFacts(subject).map((fact) => (
                <li className="v-list-item" key={fact}>
                  {fact}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <p className="v-muted">Offline hallucinated article. No external source was accessed.</p>
      </>
    );
  }

  if (pageKind === 'search') {
    return (
      <>
        <h1>Search results for {subject}</h1>
        <p>This fake search engine confidently found pages that may or may not exist.</p>
        <ul className="v-list">
          {createSearchResults(subject).map((result) => (
            <li className="v-list-item" key={result.title}>
              <strong>{result.title}</strong>
              <br />
              <span>{result.summary}</span>
            </li>
          ))}
        </ul>
        <p className="v-muted">Simulated Google-era web results. No network request was made.</p>
      </>
    );
  }

  return (
    <>
      <h1>{pageTitle}</h1>
      <p>
        VibeOS rendered a local hallucinated page for <strong>{subject}</strong>. It looks browsable, but it is not
        connected to the internet.
      </p>
      <ul className="v-list">
        <li className="v-list-item">Status: cached from imagination</li>
        <li className="v-list-item">Trust level: theatrical demo</li>
        <li className="v-list-item">Recommended action: ask for a more specific fake site or topic</li>
      </ul>
      <p className="v-muted">Current local route: {state.page}</p>
    </>
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

function classifyBrowserPage(address: string, page: string): 'home' | 'search' | 'article' | 'external' {
  const normalized = `${address} ${page}`.trim().toLowerCase();
  if (!normalized || normalized === 'home' || normalized.includes('vibe://home')) {
    return 'home';
  }
  if (
    normalized.includes('google') ||
    normalized.includes('search') ||
    normalized.includes('?q=') ||
    normalized.includes('bing') ||
    !/^[a-z]+:\/\//i.test(address.trim())
  ) {
    return 'search';
  }
  if (normalized.includes('wikipedia') || normalized.includes('wiki/') || normalized.includes('encarta')) {
    return 'article';
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

function createSearchResults(subject: string): Array<{ title: string; summary: string }> {
  return [
    {
      title: `${subject} - VibePedia, the free made-up encyclopedia`,
      summary: `A plausible overview of ${subject}, assembled locally by the hallucinated browser cache.`
    },
    {
      title: `Images of ${subject} from the Offline Web`,
      summary: 'Thumbnails omitted because VibeOS refuses to fetch real pixels during the demo.'
    },
    {
      title: `${subject} fan site archived in 1998`,
      summary: 'Includes a guestbook, three broken counters, and a suspiciously confident biography.'
    }
  ];
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

function isCalculatorOperator(value: unknown): value is CalculatorOperator {
  return value === '+' || value === '-' || value === '*' || value === '/';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
