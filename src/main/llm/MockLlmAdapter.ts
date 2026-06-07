import type { AppEvent, GenerateUiInput, GenerateUiResult, LlmAdapter } from './types';

type CalculatorState = {
  display: string;
  operand: number | null;
  operator: string | null;
  waitingForOperand: boolean;
};

type NotepadState = { text: string };
type BrowserState = { address: string; page: string };
type TerminalState = { lines: string[]; command: string };
type EncartaState = { query: string; article: string };
type PaintState = { tool: string; marks: Array<{ x: number; y: number }> };

export class MockLlmAdapter implements LlmAdapter {
  async generateNextUi(input: GenerateUiInput): Promise<GenerateUiResult> {
    switch (input.appName) {
      case 'Calculator':
        return calculator(input);
      case 'Notepad':
        return notepad(input);
      case 'Browser':
        return browser(input);
      case 'File Explorer':
        return fileExplorer(input);
      case 'Terminal':
        return terminal(input);
      case 'Encarta 98':
        return encarta(input);
      case 'Paint':
        return paint(input);
      case 'Settings':
        return settings(input);
      default:
        return genericApp(input);
    }
  }
}

function textFromEvent(event: AppEvent): string {
  if (event.type === 'click') {
    return event.targetText?.trim() ?? '';
  }
  if (event.type === 'input') {
    return event.value;
  }
  if (event.type === 'submit') {
    return Object.values(event.values ?? {})[0] ?? event.formText ?? '';
  }
  return '';
}

function calculator(input: GenerateUiInput): GenerateUiResult {
  const state = normalizeCalculatorState(input.currentState);
  if (input.event.type === 'init') {
    return renderCalculator(state);
  }

  const key = textFromEvent(input.event);
  const next = applyCalculatorKey(state, key);
  return renderCalculator(next);
}

function normalizeCalculatorState(value: unknown): CalculatorState {
  const fallback: CalculatorState = { display: '0', operand: null, operator: null, waitingForOperand: false };
  if (!value || typeof value !== 'object') {
    return fallback;
  }
  const state = value as Partial<CalculatorState>;
  return {
    display: typeof state.display === 'string' ? state.display : fallback.display,
    operand: typeof state.operand === 'number' ? state.operand : null,
    operator: typeof state.operator === 'string' ? state.operator : null,
    waitingForOperand: Boolean(state.waitingForOperand)
  };
}

function applyCalculatorKey(state: CalculatorState, key: string): CalculatorState {
  if (key === 'C') {
    return { display: '0', operand: null, operator: null, waitingForOperand: false };
  }

  if (/^\d$/.test(key)) {
    const display = state.waitingForOperand || state.display === '0' ? key : `${state.display}${key}`;
    return { ...state, display, waitingForOperand: false };
  }

  if (key === '.') {
    return state.display.includes('.') ? state : { ...state, display: `${state.display}.`, waitingForOperand: false };
  }

  if (['+', '-', '*', '/'].includes(key)) {
    return {
      display: state.display,
      operand: Number(state.display),
      operator: key,
      waitingForOperand: true
    };
  }

  if (key === '=' && state.operator && state.operand !== null) {
    const right = Number(state.display);
    const result = calculate(state.operand, right, state.operator);
    return {
      display: Number.isFinite(result) ? String(result).slice(0, 12) : 'Error',
      operand: null,
      operator: null,
      waitingForOperand: true
    };
  }

  return state;
}

function calculate(left: number, right: number, operator: string): number {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      return right === 0 ? Number.NaN : left / right;
    default:
      return right;
  }
}

function renderCalculator(state: CalculatorState): GenerateUiResult {
  const keys = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+', 'C'];
  return {
    title: 'Calculator',
    state,
    narration: null,
    html: `
      <div class="v-app v-calc">
        <div class="v-display" role="status">${escapeHtml(state.display)}</div>
        <div class="v-keypad">
          ${keys.map((key) => `<button class="v-button" data-vibe-action="press" data-vibe-value="${escapeHtml(key)}" data-vibe-id="calc-${escapeHtml(key)}">${escapeHtml(key)}</button>`).join('')}
        </div>
      </div>`
  };
}

function notepad(input: GenerateUiInput): GenerateUiResult {
  const state = normalizeObject<NotepadState>(input.currentState, { text: '' });
  if (input.event.type === 'input') {
    state.text = input.event.value.slice(0, 10000);
  }
  return {
    title: state.text ? `Notepad - ${state.text.slice(0, 18)}` : 'Notepad',
    state,
    narration: null,
    html: `
      <div class="v-app">
        <div class="v-menu"><span>File</span><span>Edit</span><span>Format</span><span>View</span><span>Help</span></div>
        <textarea class="v-textarea" data-vibe-field="text" data-vibe-id="notepad-text" aria-label="Text">${escapeHtml(state.text)}</textarea>
        <p class="v-muted">${state.text.length} characters in this simulated document.</p>
      </div>`
  };
}

function browser(input: GenerateUiInput): GenerateUiResult {
  const state = normalizeObject<BrowserState>(input.currentState, { address: 'vibe://home', page: 'home' });
  if (input.event.type === 'input') {
    state.address = input.event.value.slice(0, 120);
  }
  if (input.event.type === 'click') {
    const action = textFromEvent(input.event).toLowerCase();
    if (action.includes('home')) {
      state.address = 'vibe://home';
      state.page = 'home';
    } else if (action.includes('go') || action.includes('refresh')) {
      state.page = state.address.replace(/^vibe:\/\//, '') || 'home';
    }
  }
  const pageTitle = state.page === 'home' ? 'VibeNet Home' : `Offline page: ${state.page}`;
  return {
    title: `Browser - ${pageTitle}`,
    state,
    narration: null,
    html: `
      <div class="v-app v-browser">
        <div class="v-toolbar">
          <button class="v-button" data-vibe-action="nav" data-vibe-value="Back">Back</button>
          <button class="v-button" data-vibe-action="nav" data-vibe-value="Forward">Forward</button>
          <button class="v-button" data-vibe-action="nav" data-vibe-value="Refresh">Refresh</button>
          <button class="v-button" data-vibe-action="nav" data-vibe-value="Home">Home</button>
        </div>
        <div class="v-row v-address">
          <input class="v-input" data-vibe-field="address" data-vibe-id="browser-address" aria-label="Address" value="${escapeHtml(state.address)}" />
          <button class="v-button v-primary" data-vibe-action="go" data-vibe-value="Go">Go</button>
        </div>
        <main class="v-card">
          <h1>${escapeHtml(pageTitle)}</h1>
          <p>This is a simulated offline browser page. No network request was made.</p>
          <ul class="v-list">
            <li class="v-list-item">Try vibe://encarta</li>
            <li class="v-list-item">Try vibe://paintbox</li>
            <li class="v-list-item">Try vibe://terminal-news</li>
          </ul>
        </main>
      </div>`
  };
}

function fileExplorer(input: GenerateUiInput): GenerateUiResult {
  const clicked = input.event.type === 'click' ? textFromEvent(input.event) : '';
  const path = clicked && ['Desktop', 'Documents', 'Pictures', 'System'].includes(clicked) ? clicked : 'Desktop';
  const filesByPath: Record<string, string[]> = {
    Desktop: ['Calculator.lnk', 'Notepad.lnk', 'VibeOS Readme.txt'],
    Documents: ['Dream Journal.doc', 'Hallucinated UI Spec.txt', 'Invoices (pretend).xls'],
    Pictures: ['aurora.bmp', 'pixel-logo.gif', 'desktop-wallpaper.png'],
    System: ['kernel-not-real.sys', 'drivers-hallucinated.ini', 'sessions.db']
  };
  const state = { path, selected: clicked || null };
  return {
    title: `File Explorer - ${path}`,
    state,
    narration: null,
    html: `
      <div class="v-app v-explorer">
        <div class="v-toolbar"><span class="v-muted">Simulated filesystem</span></div>
        <div class="v-split">
          <aside class="v-panel">
            ${Object.keys(filesByPath).map((folder) => `<button class="v-button" data-vibe-action="open-folder" data-vibe-value="${folder}">${folder}</button>`).join('')}
          </aside>
          <main class="v-panel">
            <h2>${path}</h2>
            <ul class="v-list">
              ${filesByPath[path].map((file) => `<li class="v-list-item">${file}</li>`).join('')}
            </ul>
          </main>
        </div>
      </div>`
  };
}

function terminal(input: GenerateUiInput): GenerateUiResult {
  const state = normalizeObject<TerminalState>(input.currentState, {
    lines: ['VibeOS Prompt [simulated]', 'Type help for fake commands.'],
    command: ''
  });
  if (input.event.type === 'input') {
    state.command = input.event.value.slice(0, 240);
  }
  if (input.event.type === 'submit') {
    const command = Object.values(input.event.values ?? {})[0] ?? state.command;
    state.lines = runFakeCommand(state.lines, command.trim()).slice(-14);
    state.command = '';
  }
  return {
    title: 'Terminal',
    state,
    narration: null,
    html: `
      <div class="v-app v-terminal">
        <pre class="v-output">${escapeHtml(state.lines.join('\n'))}</pre>
        <div class="v-row">
          <span class="v-muted">C:\\VIBE&gt;</span>
          <input class="v-input" data-vibe-field="command" data-vibe-id="terminal-command" aria-label="Command" value="${escapeHtml(state.command)}" />
        </div>
      </div>`
  };
}

function runFakeCommand(lines: string[], command: string): string[] {
  if (!command) {
    return lines;
  }
  const next = [...lines, `C:\\VIBE> ${command}`];
  const [name, ...rest] = command.split(' ');
  switch (name.toLowerCase()) {
    case 'help':
      return [...next, 'help, dir, echo, date, vibe, clear'];
    case 'dir':
      return [...next, 'DESKTOP  DOCUMENTS  PICTURES  SYSTEM'];
    case 'echo':
      return [...next, rest.join(' ')];
    case 'date':
      return [...next, new Date().toLocaleString()];
    case 'vibe':
      return [...next, 'Hallucinated drivers loaded. Sessions isolated.'];
    case 'clear':
      return ['VibeOS Prompt [simulated]'];
    default:
      return [...next, `'${name}' is simulated as an unknown command.`];
  }
}

function encarta(input: GenerateUiInput): GenerateUiResult {
  const state = normalizeObject<EncartaState>(input.currentState, { query: 'VibeOS', article: 'VibeOS' });
  if (input.event.type === 'input') {
    state.query = input.event.value.slice(0, 120);
  }
  if (input.event.type === 'click') {
    const value = textFromEvent(input.event);
    if (value) {
      state.article = value === 'Search' ? state.query || 'VibeOS' : value;
    }
  }
  return {
    title: `Encarta 98 - ${state.article}`,
    state,
    narration: null,
    html: `
      <div class="v-app v-encarta">
        <div class="v-row">
          <input class="v-input" data-vibe-field="query" data-vibe-id="encarta-query" aria-label="Search" value="${escapeHtml(state.query)}" />
          <button class="v-button v-primary" data-vibe-action="search" data-vibe-value="Search">Search</button>
        </div>
        <div class="v-split">
          <aside class="v-panel">
            ${['VibeOS', 'Artificial Desktop', 'Retro Computing', 'Simulated Files'].map((item) => `<button class="v-button" data-vibe-action="article" data-vibe-value="${item}">${item}</button>`).join('')}
          </aside>
          <article class="v-card">
            <h1>${escapeHtml(state.article)}</h1>
            <p>This simulated encyclopedia entry describes ${escapeHtml(state.article)} in a compact retro reference style.</p>
            <p class="v-muted">Offline hallucinated article. No external source was accessed.</p>
          </article>
        </div>
      </div>`
  };
}

function paint(input: GenerateUiInput): GenerateUiResult {
  const state = normalizeObject<PaintState>(input.currentState, { tool: 'brush', marks: [] });
  if (input.event.type === 'click' && input.event.targetRole === 'canvas') {
    state.marks = [...state.marks, { x: input.event.x ?? 50, y: input.event.y ?? 50 }].slice(-80);
  }
  return {
    title: 'Paint',
    state,
    narration: null,
    html: `
      <div class="v-app v-paint">
        <div class="v-toolbar">
          <button class="v-button v-primary" data-vibe-action="tool" data-vibe-value="Brush">Brush</button>
          <button class="v-button" data-vibe-action="tool" data-vibe-value="Eraser">Eraser</button>
        </div>
        <button class="v-canvas" role="canvas" data-vibe-action="canvas" data-vibe-value="Canvas" aria-label="Canvas">
          ${state.marks.map((mark) => `<span class="v-dot" data-vibe-id="dot-${mark.x}-${mark.y}">${mark.x},${mark.y}</span>`).join('')}
        </button>
      </div>`
  };
}

function settings(input: GenerateUiInput): GenerateUiResult {
  const section = input.event.type === 'click' ? textFromEvent(input.event) || 'About' : 'About';
  const state = { section };
  return {
    title: 'Settings',
    state,
    narration: null,
    html: `
      <div class="v-app v-settings">
        <div class="v-split">
          <aside class="v-panel">
            ${['Theme', 'Sound', 'Display', 'About'].map((item) => `<button class="v-button" data-vibe-action="section" data-vibe-value="${item}">${item}</button>`).join('')}
          </aside>
          <main class="v-card">
            <h1>${escapeHtml(section)}</h1>
            <p>These settings affect only the fictional VibeOS surface.</p>
            <p class="v-muted">Theme: Aurora. Sound: Soft clicks. Display: Virtual CRT.</p>
          </main>
        </div>
      </div>`
  };
}

function genericApp(input: GenerateUiInput): GenerateUiResult {
  const state = normalizeObject<{ mode: string; prompt: string; panels: string[] }>(input.currentState, {
    mode: 'starter',
    prompt: '',
    panels: []
  });
  if (input.event.type === 'input') {
    state.prompt = input.event.value.slice(0, 1000);
  }
  if (input.event.type === 'click') {
    const action = textFromEvent(input.event);
    if (action === 'Add panel') {
      state.panels = [...state.panels, `Panel ${state.panels.length + 1}: ${input.appName} control surface`].slice(-6);
    }
    if (action === 'Show data') {
      state.panels = [...state.panels, `Data snapshot: ${new Date().toLocaleTimeString()} simulated rows ready`].slice(-6);
    }
  }
  return {
    title: input.appName,
    state,
    narration: null,
    html: `
      <div class="v-app v-generated">
        <div class="v-card">
          <h1>${escapeHtml(input.appName)}</h1>
          <p>This generated starter app is usable immediately. Describe what it should do, then press Enter or Dream Up.</p>
          <div class="v-row">
            <input class="v-input" data-vibe-field="prompt" data-vibe-id="generated-prompt" aria-label="Prompt" value="${escapeHtml(state.prompt)}" placeholder="Make this app into..." />
            <button class="v-button v-primary" data-vibe-action="dream" data-vibe-value="Dream Up">Dream Up</button>
          </div>
          <div class="v-panel">
            <h2>Live surface</h2>
            <p class="v-muted">The local shell stays responsive; the model only expands this app when you ask.</p>
            <button class="v-button" data-vibe-action="sample" data-vibe-value="Add panel">Add panel</button>
            <button class="v-button" data-vibe-action="sample" data-vibe-value="Show data">Show data</button>
            <ul class="v-list">
              ${state.panels.map((panel) => `<li class="v-list-item">${escapeHtml(panel)}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>`
  };
}

function normalizeObject<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
  if (!value || typeof value !== 'object') {
    return { ...fallback };
  }
  return { ...fallback, ...(value as Partial<T>) };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
