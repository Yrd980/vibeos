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
type GeneratedState = { mode: string; prompt: string; kind: string; subject: string; panels: string[] };

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
    blocks: [
      {
        id: 'calculator',
        role: 'main',
        className: 'v-app v-calc',
        title: state.display,
        text: 'Calculator fallback surface',
        actions: keys.map((key) => ({ id: `calc-${key}`, label: key, value: key, variant: key === '=' ? 'primary' : 'default' }))
      }
    ]
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
    blocks: [
      {
        id: 'notepad',
        role: 'main',
        className: 'v-app',
        actions: ['File', 'Edit', 'Format', 'View', 'Help'].map((label) => ({ id: `menu-${label.toLowerCase()}`, label })),
        fields: [{ id: 'notepad-text', label: 'Text', value: state.text, multiline: true }],
        text: `${state.text.length} characters in this simulated document.`
      }
    ]
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
    blocks: [
      {
        id: 'browser',
        role: 'main',
        className: 'v-app v-browser',
        title: pageTitle,
        text: 'This is a simulated offline browser page. No network request was made.',
        actions: ['Back', 'Forward', 'Refresh', 'Home', 'Go'].map((label) => ({
          id: label === 'Go' ? 'go' : `nav-${label.toLowerCase()}`,
          label,
          value: label,
          variant: label === 'Go' ? 'primary' : 'default'
        })),
        fields: [{ id: 'browser-address', label: 'Address', value: state.address }],
        items: ['Try vibe://encarta', 'Try vibe://paintbox', 'Try vibe://terminal-news']
      }
    ]
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
    blocks: [
      {
        id: 'file-explorer',
        role: 'main',
        className: 'v-app v-explorer',
        title: path,
        text: 'Simulated filesystem',
        actions: Object.keys(filesByPath).map((folder) => ({ id: `open-${folder.toLowerCase()}`, label: folder, value: folder })),
        items: filesByPath[path]
      }
    ]
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
    blocks: [
      {
        id: 'terminal',
        role: 'main',
        className: 'v-app v-terminal',
        title: 'C:\\VIBE>',
        items: state.lines,
        fields: [{ id: 'terminal-command', label: 'Command', value: state.command }]
      }
    ]
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
    blocks: [
      {
        id: 'encarta',
        role: 'main',
        className: 'v-app v-encarta',
        title: state.article,
        text: `This simulated encyclopedia entry describes ${state.article} in a compact retro reference style.`,
        fields: [{ id: 'encarta-query', label: 'Search', value: state.query }],
        actions: [
          { id: 'search', label: 'Search', value: 'Search', variant: 'primary' },
          ...['VibeOS', 'Artificial Desktop', 'Retro Computing', 'Simulated Files'].map((item) => ({
            id: `article-${slugify(item)}`,
            label: item,
            value: item
          }))
        ],
        items: ['Offline hallucinated article. No external source was accessed.']
      }
    ]
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
    blocks: [
      {
        id: 'paint',
        role: 'main',
        className: 'v-app v-paint',
        title: 'Paint',
        text: `Tool: ${state.tool}`,
        actions: [
          { id: 'tool-brush', label: 'Brush', value: 'Brush', variant: 'primary' },
          { id: 'tool-eraser', label: 'Eraser', value: 'Eraser' },
          { id: 'canvas', label: 'Canvas', value: 'Canvas' }
        ],
        items: state.marks.map((mark) => `${mark.x},${mark.y}`)
      }
    ]
  };
}

function settings(input: GenerateUiInput): GenerateUiResult {
  const section = input.event.type === 'click' ? textFromEvent(input.event) || 'About' : 'About';
  const state = { section };
  return {
    title: 'Settings',
    state,
    narration: null,
    blocks: [
      {
        id: 'settings',
        role: 'main',
        className: 'v-app v-settings',
        title: section,
        text: 'These settings affect only the fictional VibeOS surface.',
        actions: ['Theme', 'Sound', 'Display', 'About'].map((item) => ({ id: `section-${item.toLowerCase()}`, label: item, value: item })),
        items: ['Theme: Aurora', 'Sound: Soft clicks', 'Display: Virtual CRT']
      }
    ]
  };
}

function genericApp(input: GenerateUiInput): GenerateUiResult {
  const state = normalizeObject<GeneratedState>(input.currentState, {
    mode: 'generated',
    prompt: input.appName,
    kind: inferGeneratedKind(input.appName),
    subject: inferGeneratedSubject(input.appName),
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
    if (action === 'Dream Up') {
      state.kind = inferGeneratedKind(state.prompt || input.appName);
      state.subject = inferGeneratedSubject(state.prompt || input.appName);
    }
  }
  const prompt = state.prompt || input.appName;
  const kind = state.kind || inferGeneratedKind(prompt);
  const subject = state.subject || inferGeneratedSubject(prompt);
  const generatedMainBlock = createGeneratedMainBlock(kind, subject, prompt, state.panels);
  return {
    title: input.appName,
    state,
    narration: null,
    blocks: [
      {
        id: 'menu',
        role: 'menubar',
        actions: ['File', 'Edit', 'View', 'Tools', 'Help'].map((label) => ({ id: `menu-${label.toLowerCase()}`, label }))
      },
      {
        id: 'toolbar',
        role: 'toolbar',
        text: 'Offline generated surface',
        actions: [
          { id: 'show-data', label: 'Show data', value: 'Show data', variant: 'primary' },
          { id: 'add-panel', label: 'Add panel', value: 'Add panel' }
        ]
      },
      generatedMainBlock,
      {
        id: 'prompt',
        role: 'panel',
        fields: [{ id: 'generated-prompt', label: 'Prompt', value: state.prompt, placeholder: 'Make this app into...' }],
        actions: [{ id: 'dream', label: 'Dream Up', value: 'Dream Up', variant: 'primary' }]
      },
      {
        id: 'status',
        role: 'status',
        text: 'Simulated by VibeOS. No network, files, accounts, or devices were accessed.'
      }
    ]
  };
}

function createGeneratedMainBlock(kind: string, subject: string, prompt: string, panels: string[]): GenerateUiResult['blocks'][number] {
  if (kind === 'finance') {
    return {
      id: 'main',
      role: 'main',
      className: 'v-app v-generated v-finance',
      title: `${subject} Money 95`,
      text: '$42,318.09 simulated net worth',
      actions: ['Checking', 'Savings', 'Stocks', 'Taxes'].map((name) => ({ id: `account-${name.toLowerCase()}`, label: name, value: name })),
      table: {
        columns: ['Date', 'Memo', 'Amount'],
        rows: [
          ['06/10/98', 'Podcast royalty', '+$850.00'],
          ['06/11/98', 'Vintage keyboard', '-$129.00'],
          ['06/12/98', 'Index fund', '+$1200.00'],
          ['06/13/98', 'Coffee meeting', '-$18.00']
        ]
      },
      items: panels
    };
  }

  if (kind === 'encyclopedia') {
    return {
      id: 'main',
      role: 'main',
      className: 'v-app v-generated v-encarta',
      title: subject,
      text: `${subject} is presented here as a confident offline encyclopedia entry generated for the VibeOS demo.`,
      actions: ['Overview', 'Timeline', 'People', 'See also'].map((name) => ({ id: `article-${slugify(name)}`, label: name, value: name })),
      items: ['Origin: simulated archive note from 1998.', 'Importance: high enough to deserve a fake sidebar.', 'Reliability: theatrical, not factual.', ...panels]
    };
  }

  if (kind === 'paint') {
    return {
      id: 'main',
      role: 'main',
      className: 'v-app v-generated v-paint',
      title: `Preloaded ${subject} scene`,
      text: 'Canvas contains skyline, sun, and tree marks rendered as structured fake paint data.',
      actions: ['Brush', 'Eraser', 'Fill', 'Text', 'Canvas'].map((name) => ({ id: `tool-${slugify(name)}`, label: name, value: name })),
      items: ['skyline', 'sun', 'tree', ...panels]
    };
  }

  if (kind === 'nested') {
    return {
      id: 'main',
      role: 'main',
      className: 'v-app v-generated v-desktop',
      title: `${subject} Simulator`,
      text: 'This is a contained fake desktop running inside the app window.',
      actions: ['Tiny Browser', 'Tiny Paint'].map((name) => ({ id: `open-${slugify(name)}`, label: name, value: name })),
      items: ['Start', subject, '4:04 PM', ...panels]
    };
  }

  if (kind === 'browser') {
    return {
      id: 'main',
      role: 'main',
      className: 'v-app v-generated v-browser',
      title: `Search results for ${subject}`,
      text: `Generated local search result for ${prompt}.`,
      fields: [{ id: 'address', label: 'Address', value: `vibe://${slugify(subject)}` }],
      actions: [
        { id: 'go', label: 'Go', value: 'Go', variant: 'primary' },
        ...['Official-looking home page', 'Archived fan site', 'Offline screenshots'].map((name) => ({
          id: `result-${slugify(name)}`,
          label: name,
          value: name
        }))
      ],
      items: panels
    };
  }

  return {
    id: 'main',
    role: 'main',
    className: 'v-app v-generated',
    title: subject,
    text: `${prompt} has been generated as a complete retro utility surface.`,
    items: ['Control panel', 'Live output', 'Simulated records', ...panels]
  };
}

function inferGeneratedKind(prompt: string): string {
  const normalized = prompt.toLowerCase();
  if (/\b(money|finance|ledger|budget|bank|stock|tax)\b/.test(normalized)) {
    return 'finance';
  }
  if (/\b(encarta|encyclopedia|wiki|article|about|biography|history)\b/.test(normalized)) {
    return 'encyclopedia';
  }
  if (/\b(paint|draw|drawing|canvas|picture|sketch)\b/.test(normalized)) {
    return 'paint';
  }
  if (/\b(nested|os|desktop|simulator|virtual machine|vm)\b/.test(normalized)) {
    return 'nested';
  }
  if (/\b(browser|internet|web|site|search|google|yahoo)\b/.test(normalized)) {
    return 'browser';
  }
  return 'custom';
}

function inferGeneratedSubject(prompt: string): string {
  const match = prompt.match(/\b(?:about|for|of|with)\s+(.+)$/i);
  return (match?.[1] ?? prompt).trim().slice(0, 80) || 'Generated App';
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'generated';
}

function normalizeObject<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
  if (!value || typeof value !== 'object') {
    return { ...fallback };
  }
  return { ...fallback, ...(value as Partial<T>) };
}
