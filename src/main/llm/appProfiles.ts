export interface AppProfile {
  appName: string;
  visualStyle: string;
  behaviorHints: string[];
  initialState: Record<string, unknown>;
}

const FALLBACK_KINDS = [
  {
    kind: 'finance-ledger',
    words: ['money', 'finance', 'ledger', 'budget', 'bank', 'portfolio', 'stock', 'tax', 'expense'],
    visualStyle: 'Microsoft Money 95-style finance app with ledger rows, account tabs, fake balances, and a status bar',
    behaviorHints: [
      'Invent coherent simulated accounts, balances, budget categories, and transactions.',
      'Use ledger, table, toolbar, and status bar classes for a complete offline finance screen.'
    ]
  },
  {
    kind: 'encyclopedia',
    words: ['encarta', 'encyclopedia', 'wiki', 'article', 'about', 'biography', 'history'],
    visualStyle: 'Encarta 98-style encyclopedia with search results, article pane, index sidebar, and offline citations',
    behaviorHints: [
      'Invent confident but simulated encyclopedia copy, related topics, dates, and captions.',
      'Use article, search result, list, and status bar classes for the offline reference layout.'
    ]
  },
  {
    kind: 'browser-search',
    words: ['browser', 'internet', 'web', 'site', 'search', 'google', 'yahoo'],
    visualStyle: 'Internet Explorer-era browser with classic toolbar, address box, search results, and fake offline pages',
    behaviorHints: [
      'Never access or imply access to the real internet; generate local vibe:// results only.',
      'Show plausible simulated pages, result snippets, bookmarks, and loading/status messages.'
    ]
  },
  {
    kind: 'paint-canvas',
    words: ['paint', 'draw', 'drawing', 'canvas', 'sketch', 'art'],
    visualStyle: 'MS Paint-style drawing program with toolbox, color palette, canvas, and a preloaded fake scene when requested',
    behaviorHints: [
      'Represent drawings with harmless HTML blocks, dots, strokes, swatches, and labels.',
      'If the prompt asks for an existing drawing, render a specific simulated picture immediately.'
    ]
  },
  {
    kind: 'installer-wizard',
    words: ['install', 'installer', 'setup', 'wizard'],
    visualStyle: 'Windows 98 setup wizard with steps, progress meter, component list, and fake install log',
    behaviorHints: [
      'Simulate installation steps only; do not claim to touch files, registry, network, or devices.',
      'Use wizard, progress, list, and status bar classes to make the installer feel complete.'
    ]
  },
  {
    kind: 'nested-desktop',
    words: ['os', 'windows', 'desktop', 'simulator', 'virtual machine', 'vm', 'nested'],
    visualStyle: 'nested retro desktop inside the app window with tiny windows, icons, taskbar, and simulated system chrome',
    behaviorHints: [
      'Create a contained fake desktop; do not claim to boot, control, or inspect the host computer.',
      'Use nested desktop, window, icon, taskbar, toolbar, and status classes for the miniature OS.'
    ]
  },
  {
    kind: 'rude-utility',
    words: ['rude', 'mean', 'snarky', 'commander'],
    visualStyle: 'classic utility program with toolbar, output pane, status bar, and intentionally snarky copy',
    behaviorHints: [
      'Use playful attitude only when requested; keep controls usable and avoid hateful or harassing content.',
      'Invent fake tool output, warnings, and status messages that match the requested personality.'
    ]
  }
] as const;

export const APP_PROFILES: AppProfile[] = [
  {
    appName: 'Calculator',
    visualStyle: 'retro calculator with a large segmented display and compact keypad',
    behaviorHints: ['Use buttons 0-9, +, -, *, /, =, and C.', 'Keep state for display, operand, operator, and waitingForOperand.'],
    initialState: { display: '0', operand: null, operator: null, waitingForOperand: false }
  },
  {
    appName: 'Notepad',
    visualStyle: 'plain text editor with a simple menu bar',
    behaviorHints: ['Use a textarea-like editor.', 'Store text content in state.text.'],
    initialState: { text: '' }
  },
  {
    appName: 'Browser',
    visualStyle: 'fake retro web browser with address bar and offline pages',
    behaviorHints: ['Never access the real internet.', 'Simulate pages and clearly present them as local hallucinated pages.'],
    initialState: { address: 'vibe://home', page: 'home' }
  },
  {
    appName: 'File Explorer',
    visualStyle: 'classic file explorer with folder tree and file list',
    behaviorHints: ['Never access the real filesystem.', 'Use simulated folders like Desktop, Documents, Pictures, and System.'],
    initialState: { path: 'Desktop', selected: null }
  },
  {
    appName: 'Terminal',
    visualStyle: 'fake command prompt with dark output pane',
    behaviorHints: ['Simulate commands only.', 'Support help, dir, echo, date, vibe, and clear.'],
    initialState: { lines: ['VibeOS Prompt [simulated]', 'Type help for fake commands.'], command: '' }
  },
  {
    appName: 'Encarta 98',
    visualStyle: 'encyclopedia article with left navigation and search',
    behaviorHints: ['Simulate offline encyclopedia articles.', 'Use concise retro educational prose.'],
    initialState: { query: 'VibeOS', article: 'VibeOS' }
  },
  {
    appName: 'Paint',
    visualStyle: 'simple paint program with toolbar and canvas',
    behaviorHints: ['Represent brush marks with harmless HTML elements.', 'Store brush marks in state.marks.'],
    initialState: { tool: 'brush', marks: [] }
  },
  {
    appName: 'Settings',
    visualStyle: 'fake system settings panel',
    behaviorHints: ['Show theme, sound, display, and about sections.', 'Do not affect the host system.'],
    initialState: { theme: 'Aurora', sound: 'Soft clicks', display: 'Virtual CRT' }
  }
];

export function getAppProfile(appName: string): AppProfile {
  return APP_PROFILES.find((profile) => profile.appName === appName) ?? buildFallbackProfile(appName);
}

function buildFallbackProfile(appName: string): AppProfile {
  const normalized = appName.toLowerCase();
  const kind = FALLBACK_KINDS.find((candidate) => candidate.words.some((word) => matchesWord(normalized, word)));
  const subject = inferSubject(appName);
  const personality = inferPersonality(normalized);

  return {
    appName,
    visualStyle:
      kind?.visualStyle ??
      'newly hallucinated Windows 95/98 software package with menus, classic toolbar, invented content, practical controls, and a status bar',
    behaviorHints: [
      'Create a complete first screen immediately, as if this arbitrary retro app already exists on VibeOS.',
      'Invent plausible offline data, labels, menus, sample records, tool output, and empty states that fit the prompt.',
      'Use safe semantic controls with data-vibe-action and data-vibe-field attributes.',
      'Never imply real internet, filesystem, terminal, device, or account access; label external facts and live data as simulated.',
      ...(kind?.behaviorHints ?? [
        'Prefer a classic menu or toolbar, one strong content area, useful controls, and a bottom status bar.'
      ]),
      ...(subject ? [`Center the generated content on "${subject}" because the prompt names that subject.`] : []),
      ...(personality ? [`Use a ${personality} personality because the prompt asks for that tone.`] : [])
    ],
    initialState: {
      mode: 'generated',
      prompt: appName,
      kind: kind?.kind ?? 'custom-app',
      subject,
      personality
    }
  };
}

function matchesWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);
}

function inferSubject(appName: string): string | null {
  const match = appName.match(/\b(?:about|for|of|with)\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function inferPersonality(normalizedAppName: string): string | null {
  if (/\b(rude|mean|snarky|sarcastic)\b/.test(normalizedAppName)) {
    return 'snarky';
  }
  if (/\b(personal|personalized|for)\b/.test(normalizedAppName)) {
    return 'personalized';
  }
  if (/\b(kid|kids|child|children)\b/.test(normalizedAppName)) {
    return 'friendly';
  }
  return null;
}
