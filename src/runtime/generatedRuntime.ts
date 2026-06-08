import type {
  AppIdentity,
  EventIntent,
  FacsimileRoute,
  GeneratedBlock,
  GeneratedDocument,
  GeneratedDocumentStage,
  GeneratedResource,
  LaunchIntent,
  PatchEnvelope,
  PatchOperation,
  ResourceManifest,
} from './types';

const allowedBlockTypes = new Set([
  'app-chrome',
  'menu-bar',
  'menu',
  'toolbar',
  'status-bar',
  'split-pane',
  'tab-strip',
  'panel',
  'group-box',
  'dialog',
  'toast',
  'progress',
  'button',
  'text-input',
  'search-input',
  'checkbox',
  'radio-group',
  'select',
  'slider',
  'tree',
  'list',
  'table',
  'form',
  'command-link',
  'text',
  'heading',
  'rich-text-spans',
  'image-placeholder',
  'generated-bitmap',
  'chart',
  'timeline',
  'terminal-transcript',
  'paint-canvas',
  'file-list',
  'property-sheet',
  'facsimile-page',
  'facsimile-address-bar',
  'search-home',
  'search-results',
  'wiki-article',
  'encyclopedia-article',
  'plain-example-page',
  'download-portal',
  'fan-site',
  'corporate-site',
  'forum-thread',
  'classic-software-page',
  'control-panel-page',
  'nested-os-desktop',
]);

const allowedStyleTokens = new Set([
  'win98-window',
  'win98-panel',
  'win98-inset',
  'win98-raised',
  'menu-bar',
  'toolbar',
  'toolbar-button',
  'status-bar',
  'split-pane',
  'group-box',
  'link-blue',
  'google-page',
  'google-result-title',
  'google-url',
  'wiki-page',
  'wiki-sidebar',
  'wiki-infobox',
  'wiki-tabs',
  'encarta-page',
  'encarta-sidebar',
  'download-portal',
  'download-button',
  'file-explorer',
  'file-list-row',
  'paint-shell',
  'paint-canvas',
  'nested-os',
  'nested-taskbar',
  'disabled',
  'badge',
  'todo-list',
  'calculator-grid',
  'warning',
  'muted',
  'tiny',
  'dense',
]);

const maxBlocks = 120;
const maxDepth = 16;
const maxChildren = 48;
const maxTransactionOps = 48;
const maxTextLength = 4000;
const maxItems = 80;
const maxStyleTokens = 8;
const maxResources = 12;
const maxBitmapBytes = 512 * 1024;
const maxBitmapDimension = 1600;

const emptyIdentity: AppIdentity = {
  title: 'VibeOS Program',
  subtitle: 'Preparing local staged surface',
  iconToken: 'generated',
  statusText: 'Opening simulated program...',
};

export function createEmptyDocument(documentId: string, title = 'VibeOS Program'): GeneratedDocument {
  const rootBlock = block('root', 'app-chrome', { title }, [], ['win98-panel']);

  return {
    documentId,
    revision: 0,
    appIdentity: { ...emptyIdentity, title },
    stage: 'booting',
    rootBlockId: rootBlock.id,
    blocks: {
      [rootBlock.id]: rootBlock,
    },
    eventIntents: {},
    resourceManifest: { resources: {} },
  };
}

export function applyPatchEnvelope(document: GeneratedDocument, envelope: PatchEnvelope): GeneratedDocument {
  if (!validateEnvelope(document, envelope)) {
    return document;
  }

  if (envelope.kind === 'error') {
    return {
      ...document,
      stage: 'stale',
      appIdentity: {
        ...document.appIdentity,
        statusText: 'Offline generator unavailable. Showing last valid simulated surface.',
      },
      revision: envelope.resultRevision,
    };
  }

  const ops =
    envelope.kind === 'transaction' && isTransactionPayload(envelope.payload)
      ? envelope.payload.ops
      : isPatchOperation(envelope.payload)
        ? [envelope.payload]
        : [];

  if (!ops.length) {
    return document;
  }

  const working = cloneDocument(document);

  for (const op of ops) {
    if (!validatePatch(working, op)) {
      return document;
    }
    applyPatch(working, op);
  }

  if (!validateBlockGraph(working)) {
    return document;
  }

  if (!validateDocumentResources(working)) {
    return document;
  }

  working.revision = envelope.resultRevision;
  return working;
}

export function createGeneratedPatchStream(sessionId: string, intent: LaunchIntent): PatchEnvelope[] {
  const query = intent.rawQuery.toLowerCase();
  if (query.includes('fail') || query.includes('provider error')) {
    return createFailureStream(sessionId, intent);
  }
  if (query.includes('download')) {
    return createDownloadPortalStream(sessionId, intent);
  }
  if (query.includes('file explorer') || query.includes('folder')) {
    return createFileExplorerStream(sessionId, intent);
  }
  if (query.includes('paint')) {
    return createPaintStream(sessionId, intent);
  }
  if (query.includes('nested os') || query.includes('windows in windows')) {
    return createNestedOsStream(sessionId, intent);
  }
  if (query.includes('encarta')) {
    return createEncartaStream(sessionId, intent);
  }
  if (query.includes('calculator')) {
    return createRudeCalculatorStream(sessionId, intent);
  }
  if (query.includes('control') || query.includes('settings')) {
    return createControlPanelStream(sessionId, intent);
  }
  if (query.includes('todo') || query.includes('task') || query.includes('checklist')) {
    return createTodoStream(sessionId, intent);
  }
  return createGenericAppStream(sessionId, intent);
}

export function createBrowserDocument(address: string): GeneratedDocument {
  const route = classifyBrowserRoute(address);
  const document = createEmptyDocument(`browser-${sanitize(address)}`, route.title);
  let revision = 0;

  const applyOps = (ops: PatchOperation[]) => {
    const next = applyPatchEnvelope(document, {
      protocolVersion: 1,
      sessionId: document.documentId,
      streamId: `${document.documentId}-stream`,
      seq: revision + 1,
      baseRevision: document.revision,
      resultRevision: document.revision + 1,
      kind: 'transaction',
      payload: { transactionId: `${document.documentId}-tx-${revision}`, ops },
    });
    Object.assign(document, next);
    revision += 1;
  };

  applyOps([
    { op: 'setAppIdentity', identity: route.identity },
    { op: 'setStage', stage: 'ready' },
    { op: 'setStatusText', text: route.statusText },
    { op: 'setFacsimileRoute', route: route.facsimileRoute },
  ]);
  applyOps(route.ops);

  return document;
}

export function createBrowserPatchStream(sessionId: string, address: string): PatchEnvelope[] {
  const route = classifyBrowserRoute(address);
  return stagedStream(sessionId, [
    [
      { op: 'setAppIdentity', identity: { ...route.identity, statusText: 'Opening page...' } },
      { op: 'setStage', stage: 'identifying' },
      { op: 'setStatusText', text: 'Opening page...' },
      { op: 'setFacsimileRoute', route: route.facsimileRoute },
    ],
    [
      {
        op: 'createBlock',
        block: block('page-frame', 'facsimile-page', {
          pageKind: route.facsimileRoute.pageKind,
          displayUrl: route.facsimileRoute.displayUrl,
          offlineSimulated: true,
          visualCues: route.facsimileRoute.visualCues,
          title: route.title,
        }, [], route.kind === 'wikipedia' ? ['wiki-page'] : route.kind === 'google' ? ['google-page'] : ['win98-inset']),
      },
      { op: 'insertBlock', parentId: 'root', childId: 'page-frame' },
      { op: 'setStage', stage: 'building-chrome' },
      { op: 'setStatusText', text: 'Offline page chrome ready...' },
    ],
    [
      ...route.ops,
      { op: 'setStage', stage: 'building-content' },
      { op: 'setStatusText', text: route.kind === 'google' ? 'Search complete' : 'Page content filled from simulated cache...' },
    ],
    [
      { op: 'setStage', stage: 'ready' },
      { op: 'setStatusText', text: route.statusText },
    ],
  ]);
}

export function classifyBrowserRoute(address: string) {
  const normalized = address.trim() || 'about:home';
  const lower = normalized.toLowerCase();

  if (lower === 'example.com' || lower.includes('example.com')) {
    const displayUrl = 'http://example.com/';
    return {
      title: 'Example Domain',
      kind: 'example' as const,
      statusText: 'Done - Simulated offline page',
      identity: identity('Example Domain', 'Plain reserved-domain facsimile', 'browser', 'Done'),
      facsimileRoute: facsimile('plain-example-page', displayUrl, ['plain centered text block', 'one paragraph', 'one link']),
      ops: exampleOps(displayUrl),
    };
  }

  if (lower.includes('wikipedia') || lower.startsWith('wiki ')) {
    const topic = titleCase(
      normalized
        .replace(/https?:\/\/(www\.)?wikipedia\.org\/wiki\//i, '')
        .replace(/wikipedia/gi, '')
        .replace(/^wiki\s+/i, '')
        .replace(/_/g, ' ')
        .trim() || 'Alan Turing',
    );
    const displayUrl = `https://en.wikipedia.org/wiki/${topic.replace(/\s+/g, '_')}`;
    return {
      title: topic,
      kind: 'wikipedia' as const,
      statusText: 'Done - Simulated offline article',
      identity: identity(topic, 'Wikipedia-like offline article', 'wiki', 'Done'),
      facsimileRoute: facsimile('wiki-article', displayUrl, ['left navigation', 'article tabs', 'infobox', 'references']),
      ops: wikiOps(topic, displayUrl),
    };
  }

  if (lower === 'about:home' || lower === 'google.com' || !lower.includes('.')) {
    const query = lower === 'about:home' || lower === 'google.com' ? '' : normalized;
    return {
      title: query ? `Google Search: ${query}` : 'Google',
      kind: 'google' as const,
      statusText: query ? 'Search complete - Simulated offline page' : 'Done',
      identity: identity(query ? `Google Search: ${query}` : 'Google', 'Offline search facsimile', 'browser', 'Search complete'),
      facsimileRoute: facsimile('search-results', 'https://www.google.com/search', [
        'white page',
        'blue result titles',
        'green display URLs',
        'black snippets',
      ]),
      ops: googleOps(query),
    };
  }

  const domain = normalized.replace(/^https?:\/\//, '').split('/')[0];
  return {
    title: titleCase(domain.replace(/\..*/, '')),
    kind: 'unknown' as const,
    statusText: 'Done - Simulated offline page',
    identity: identity(titleCase(domain), 'Generated old-web facsimile', 'browser', 'Done'),
    facsimileRoute: facsimile('corporate-site', `http://${domain}/`, ['old web header', 'left navigation', 'status footer']),
    ops: unknownSiteOps(domain),
  };
}

function createTodoStream(sessionId: string, intent: LaunchIntent): PatchEnvelope[] {
  const icon = 'todo';
  return stagedStream(sessionId, [
    [
      { op: 'setAppIdentity', identity: identity('To Do', 'TaskPad 98 generated organizer', icon, 'Resolving task desk identity...') },
      { op: 'setStage', stage: 'identifying' },
      { op: 'setStatusText', text: 'Resolving task desk identity...' },
    ],
    [
      { op: 'createBlock', block: block('menu', 'menu-bar', { items: ['File', 'Edit', 'Tasks', 'View', 'Help'] }, [], ['menu-bar']) },
      { op: 'createBlock', block: block('toolbar', 'toolbar', { buttons: ['New', 'Complete', 'Print', 'Sync?'] }, [], ['toolbar']) },
      { op: 'createBlock', block: block('status', 'status-bar', { text: 'Task database: LOCAL_FAKE_TASKS.DAT' }, [], ['status-bar']) },
      { op: 'insertBlock', parentId: 'root', childId: 'menu' },
      { op: 'insertBlock', parentId: 'root', childId: 'toolbar' },
      { op: 'insertBlock', parentId: 'root', childId: 'status' },
      { op: 'setStage', stage: 'building-chrome' },
    ],
    [
      {
        op: 'createBlock',
        block: block(
          'main',
          'split-pane',
          { orientation: 'horizontal' },
          [],
          ['split-pane', 'win98-inset'],
        ),
      },
      {
        op: 'createBlock',
        block: block('folders', 'tree', {
          items: ['Inbox', 'Today', 'Someday', 'People I Might Call', 'Completed-ish'],
        }, [], ['win98-panel']),
      },
      {
        op: 'createBlock',
        block: block('tasks', 'list', {
          items: [
            { id: 't1', title: 'Write down the thing before it becomes folklore', meta: 'Today 09:15' },
            { id: 't2', title: 'Buy floppy labels', meta: 'Low priority' },
            { id: 't3', title: 'Pretend the sync cable works', meta: 'Blocked' },
          ],
        }, [], ['todo-list', 'win98-inset']),
      },
      { op: 'insertBlock', parentId: 'main', childId: 'folders' },
      { op: 'insertBlock', parentId: 'main', childId: 'tasks' },
      { op: 'insertBlock', parentId: 'root', childId: 'main' },
      { op: 'setStage', stage: 'building-content' },
    ],
    [
      {
        op: 'createBlock',
        block: block('detail', 'panel', {
          title: 'Selected Task',
          text: 'Each click registers a typed event intent. This mock patches details locally.',
        }, [], ['win98-panel']),
      },
      {
        op: 'registerEventIntent',
        intent: eventIntent('complete-task', 'tasks', 'select', 'Select a task and patch the detail pane.'),
      },
      { op: 'insertBlock', parentId: 'root', childId: 'detail' },
      { op: 'setStage', stage: 'ready' },
      { op: 'setStatusText', text: '3 tasks. Offline generated workspace ready.' },
    ],
  ]);
}

function createRudeCalculatorStream(sessionId: string, intent: LaunchIntent): PatchEnvelope[] {
  return stagedStream(sessionId, [
    [
      {
        op: 'setAppIdentity',
        identity: identity(intent.title, 'A calculator-like generated app with opinions', 'calculator', 'Summoning keypad attitude...'),
      },
      { op: 'setStage', stage: 'identifying' },
    ],
    [
      { op: 'createBlock', block: block('menu', 'menu-bar', { items: ['File', 'Insult', 'View', 'Help'] }, [], ['menu-bar']) },
      { op: 'createBlock', block: block('toolbar', 'toolbar', { buttons: ['Clear', 'Memory', 'Apologize'] }, [], ['toolbar']) },
      { op: 'insertBlock', parentId: 'root', childId: 'menu' },
      { op: 'insertBlock', parentId: 'root', childId: 'toolbar' },
      { op: 'setStage', stage: 'building-chrome' },
    ],
    [
      {
        op: 'createBlock',
        block: block('panel', 'panel', {
          title: 'RudeCalc 98',
          display: '0',
          buttons: ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+'],
          caption: 'It can add numbers and lightly judge your formatting.',
        }, [], ['win98-panel', 'calculator-grid']),
      },
      {
        op: 'createBlock',
        block: block('remark', 'text', {
          text: 'Status: Waiting for arithmetic that deserves a window this large.',
        }, [], ['muted']),
      },
      { op: 'insertBlock', parentId: 'root', childId: 'panel' },
      { op: 'insertBlock', parentId: 'root', childId: 'remark' },
      { op: 'setStage', stage: 'building-content' },
    ],
    [
      { op: 'setStage', stage: 'ready' },
      { op: 'setStatusText', text: 'Generated calculator personality ready. Local Calculator remains separate.' },
      { op: 'registerEventIntent', intent: eventIntent('press-generated-key', 'panel', 'click', 'Patch calculator display locally.') },
    ],
  ]);
}

function createEncartaStream(sessionId: string, intent: LaunchIntent): PatchEnvelope[] {
  const topic = titleCase(intent.rawQuery.replace(/encarta\s*98\s*about/i, '').replace(/encarta/i, '').trim() || 'Mark Russinovich');
  return stagedStream(sessionId, [
    [
      {
        op: 'setAppIdentity',
        identity: identity(`Encarta 98 - ${topic}`, 'Offline encyclopedia simulation', 'encarta', 'Loading CD-ROM index...'),
      },
      { op: 'setStage', stage: 'identifying' },
    ],
    [
      { op: 'createBlock', block: block('menu', 'menu-bar', { items: ['File', 'Edit', 'Find', 'Favorites', 'Tools', 'Help'] }, [], ['menu-bar']) },
      { op: 'createBlock', block: block('toolbar', 'toolbar', { buttons: ['Back', 'Forward', 'Contents', 'Index', 'Media'] }, [], ['toolbar']) },
      { op: 'insertBlock', parentId: 'root', childId: 'menu' },
      { op: 'insertBlock', parentId: 'root', childId: 'toolbar' },
      { op: 'setStage', stage: 'building-chrome' },
    ],
    [
      {
        op: 'createBlock',
        block: block('article-shell', 'split-pane', { orientation: 'horizontal' }, [], [
          'split-pane',
          'encarta-page',
        ]),
      },
      {
        op: 'createBlock',
        block: block('index', 'tree', {
          title: 'Index',
          items: ['Computer History', 'Operating Systems', topic, 'Utilities', 'Further Reading'],
        }, [], ['encarta-sidebar']),
      },
      {
        op: 'createBlock',
        block: block('article', 'encyclopedia-article', {
          title: topic,
          lead: `${topic} appears here as a confidently simulated encyclopedia entry, emphasizing tools, systems, and the folklore of Windows internals.`,
          sections: [
            'Overview',
            'Early utilities and diagnostic culture',
            'Notable tools',
            'Legacy in desktop computing',
          ],
          caption: 'Simulated CD-ROM media: portrait placeholder and disk diagram.',
        }, [], ['encarta-page', 'win98-inset']),
      },
      { op: 'insertBlock', parentId: 'article-shell', childId: 'index' },
      { op: 'insertBlock', parentId: 'article-shell', childId: 'article' },
      { op: 'insertBlock', parentId: 'root', childId: 'article-shell' },
      { op: 'setStage', stage: 'building-content' },
    ],
    [
      {
        op: 'createBlock',
        block: block('facts', 'panel', {
          title: 'Article Details',
          text: 'Revision 4.01, media objects: 2, cross-links: 11, offline confidence: theatrical.',
        }, [], ['win98-panel', 'tiny']),
      },
      { op: 'createBlock', block: block('status', 'status-bar', { text: 'Encarta index ready - 42 related topics' }, [], ['status-bar']) },
      { op: 'insertBlock', parentId: 'root', childId: 'facts' },
      { op: 'insertBlock', parentId: 'root', childId: 'status' },
      { op: 'setStage', stage: 'ready' },
      { op: 'setStatusText', text: 'CD-ROM article ready. All links are simulated.' },
    ],
  ]);
}

function createDownloadPortalStream(sessionId: string, intent: LaunchIntent): PatchEnvelope[] {
  const title = intent.title.includes('Download') ? intent.title : `${intent.title} Download Center`;
  return stagedStream(sessionId, [
    [
      { op: 'setAppIdentity', identity: identity(title, 'Old-web download portal simulation', 'browser', 'Reading mirror list...') },
      { op: 'setStage', stage: 'identifying' },
      { op: 'setFacsimileRoute', route: facsimile('download-portal', 'http://downloads.local/vibe/', ['version', 'mirrors', 'system requirements', 'old badges']) },
    ],
    [
      { op: 'createBlock', block: block('menu', 'menu-bar', { items: ['File', 'Edit', 'Mirrors', 'Tools', 'Help'] }, [], ['menu-bar']) },
      { op: 'createBlock', block: block('toolbar', 'toolbar', { buttons: ['Back', 'Top 10', 'Newest', 'Submit Software'] }, [], ['toolbar']) },
      { op: 'insertBlock', parentId: 'root', childId: 'menu' },
      { op: 'insertBlock', parentId: 'root', childId: 'toolbar' },
      { op: 'setStage', stage: 'building-chrome' },
    ],
    [
      {
        op: 'createBlock',
        block: block('portal', 'download-portal', {
          title,
          version: 'Version 4.8.2 for Windows 95/98/ME',
          mirrors: ['Tucows-style Mirror A', 'Campus FTP Mirror', 'Slow but Polite Modem Mirror'],
          requirements: ['Pentium 90 MHz', '16 MB RAM', '8 MB disk space', '256-color display'],
          badges: ['No real download', 'Offline simulated', 'Award: Five tiny stars'],
          ad: 'ADVERTISEMENT: ZipMagic Pro 2001 claims to organize everything.',
        }, [], ['download-portal', 'win98-inset']),
      },
      { op: 'insertBlock', parentId: 'root', childId: 'portal' },
      { op: 'setStage', stage: 'building-content' },
      { op: 'setStatusText', text: '3 mirrors found. All buttons are simulated.' },
    ],
    [
      { op: 'createBlock', block: block('status', 'status-bar', { text: 'Ready - mirror latency is theatrical' }, [], ['status-bar']) },
      { op: 'insertBlock', parentId: 'root', childId: 'status' },
      { op: 'registerEventIntent', intent: eventIntent('choose-mirror', 'portal', 'click', 'Choose a fake download mirror.') },
      { op: 'setStage', stage: 'ready' },
      { op: 'setStatusText', text: 'Download portal ready. No file transfer can occur.' },
    ],
  ]);
}

function createFileExplorerStream(sessionId: string, intent: LaunchIntent): PatchEnvelope[] {
  return stagedStream(sessionId, [
    [
      { op: 'setAppIdentity', identity: identity('File Explorer', 'Generated local file manager facsimile', 'file', 'Indexing fake folders...') },
      { op: 'setStage', stage: 'identifying' },
    ],
    [
      { op: 'createBlock', block: block('menu', 'menu-bar', { items: ['File', 'Edit', 'View', 'Favorites', 'Tools', 'Help'] }, [], ['menu-bar']) },
      { op: 'createBlock', block: block('toolbar', 'toolbar', { buttons: ['Back', 'Up', 'Folders', 'Views', 'Properties'] }, [], ['toolbar']) },
      { op: 'insertBlock', parentId: 'root', childId: 'menu' },
      { op: 'insertBlock', parentId: 'root', childId: 'toolbar' },
      { op: 'setStage', stage: 'building-chrome' },
    ],
    [
      { op: 'createBlock', block: block('explorer-shell', 'split-pane', { orientation: 'horizontal' }, [], ['split-pane', 'file-explorer']) },
      {
        op: 'createBlock',
        block: block('folders', 'tree', {
          title: 'Folders',
          items: ['Desktop', 'My Documents', 'Program Files', 'Vibe Cache', 'Offline Web', 'System'],
        }, [], ['win98-panel']),
      },
      {
        op: 'createBlock',
        block: block('files', 'file-list', {
          path: 'C:\\VIBEOS\\CACHE\\RECENT',
          columns: ['Name', 'Type', 'Size', 'Modified'],
          files: [
            { name: 'todo.session', type: 'Generated Session', size: '18 KB', modified: 'Today 09:15' },
            { name: 'alan_turing.wiki', type: 'Offline Article', size: '42 KB', modified: 'Today 09:18' },
            { name: 'rudecalc.app', type: 'Generated Program', size: '31 KB', modified: 'Today 09:21' },
            { name: 'MARKRUSS.ENC', type: 'Encarta Entry', size: '64 KB', modified: 'Today 09:24' },
          ],
        }, [], ['win98-inset', 'file-explorer']),
      },
      { op: 'insertBlock', parentId: 'explorer-shell', childId: 'folders' },
      { op: 'insertBlock', parentId: 'explorer-shell', childId: 'files' },
      { op: 'insertBlock', parentId: 'root', childId: 'explorer-shell' },
      { op: 'setStage', stage: 'building-content' },
    ],
    [
      { op: 'createBlock', block: block('status', 'status-bar', { text: '4 object(s), 155 KB - simulated folder' }, [], ['status-bar']) },
      { op: 'insertBlock', parentId: 'root', childId: 'status' },
      { op: 'setStage', stage: 'ready' },
      { op: 'setStatusText', text: 'File Explorer facsimile ready. Paths are display text only.' },
    ],
  ]);
}

function createPaintStream(sessionId: string, intent: LaunchIntent): PatchEnvelope[] {
  return stagedStream(sessionId, [
    [
      { op: 'setAppIdentity', identity: identity(intent.title, 'Generated Paint facsimile', 'paint', 'Preparing palette...') },
      { op: 'setStage', stage: 'identifying' },
    ],
    [
      { op: 'createBlock', block: block('menu', 'menu-bar', { items: ['File', 'Edit', 'View', 'Image', 'Colors', 'Help'] }, [], ['menu-bar']) },
      { op: 'createBlock', block: block('toolbar', 'toolbar', { buttons: ['New', 'Open', 'Save', 'Print', 'Undo'] }, [], ['toolbar']) },
      { op: 'insertBlock', parentId: 'root', childId: 'menu' },
      { op: 'insertBlock', parentId: 'root', childId: 'toolbar' },
      { op: 'setStage', stage: 'building-chrome' },
    ],
    [
      {
        op: 'createBlock',
        block: block('paint', 'paint-canvas', {
          tools: ['Pencil', 'Brush', 'Fill', 'Line', 'Text', 'Eraser'],
          colors: ['#000000', '#ffffff', '#c00000', '#008000', '#0000c0', '#ffff00', '#ff00ff', '#00ffff'],
          caption: 'Preloaded simulated drawing: a tiny window inside a window.',
          pixels: [
            '................',
            '..BBBBBBBBBB....',
            '..BWWWWWWWWB....',
            '..BW..RR..WB....',
            '..BWWWWWWWWB....',
            '..BBBBBBBBBB....',
          ],
        }, [], ['paint-shell', 'win98-inset']),
      },
      { op: 'insertBlock', parentId: 'root', childId: 'paint' },
      { op: 'setStage', stage: 'building-content' },
    ],
    [
      { op: 'createBlock', block: block('status', 'status-bar', { text: 'Canvas 320 x 200 px - simulated bitmap' }, [], ['status-bar']) },
      { op: 'insertBlock', parentId: 'root', childId: 'status' },
      { op: 'setStage', stage: 'ready' },
      { op: 'setStatusText', text: 'Paint workspace ready. Bitmap is generated from block props.' },
    ],
  ]);
}

function createNestedOsStream(sessionId: string, intent: LaunchIntent): PatchEnvelope[] {
  return stagedStream(sessionId, [
    [
      { op: 'setAppIdentity', identity: identity(intent.title, 'Nested desktop simulation', 'nested', 'Booting inner shell...') },
      { op: 'setStage', stage: 'identifying' },
    ],
    [
      { op: 'createBlock', block: block('boot', 'panel', { title: 'VibeOS-in-VibeOS', text: 'HIMEM.SYS is politely pretending to load.' }, [], ['win98-panel']) },
      { op: 'insertBlock', parentId: 'root', childId: 'boot' },
      { op: 'setStage', stage: 'building-chrome' },
      { op: 'setStatusText', text: 'Inner desktop boot banner displayed...' },
    ],
    [
      {
        op: 'createBlock',
        block: block('inner-desktop', 'nested-os-desktop', {
          wallpaper: 'inner-teal',
          icons: ['Mini Browser', 'Tiny Paint', 'Recursive Control Panel'],
          windows: [
            { title: 'Mini Browser', text: 'This window is inside the nested OS surface.' },
            { title: 'Boot Log', text: 'No virtualization occurred. Just blocks.' },
          ],
          taskbar: ['Start', 'Mini Browser', '4:53 AM'],
        }, [], ['nested-os', 'win98-inset']),
      },
      { op: 'insertBlock', parentId: 'root', childId: 'inner-desktop' },
      { op: 'setStage', stage: 'building-content' },
    ],
    [
      { op: 'registerEventIntent', intent: eventIntent('open-inner-icon', 'inner-desktop', 'open-dialog', 'Open a simulated inner desktop icon.') },
      { op: 'setStage', stage: 'ready' },
      { op: 'setStatusText', text: 'Nested OS ready. Inner interactions stay simulated.' },
    ],
  ]);
}

function createFailureStream(sessionId: string, intent: LaunchIntent): PatchEnvelope[] {
  const prefix = stagedStream(sessionId, [
    [
      { op: 'setAppIdentity', identity: identity(intent.title, 'Failure fallback proof', 'generated', 'Starting provider request...') },
      { op: 'setStage', stage: 'identifying' },
    ],
    [
      { op: 'createBlock', block: block('menu', 'menu-bar', { items: ['File', 'Retry', 'Regenerate', 'Help'] }, [], ['menu-bar']) },
      { op: 'createBlock', block: block('body', 'panel', { title: 'Last Valid Surface', text: 'This content arrived before the offline stream interruption.' }, [], ['win98-panel']) },
      { op: 'insertBlock', parentId: 'root', childId: 'menu' },
      { op: 'insertBlock', parentId: 'root', childId: 'body' },
      { op: 'setStage', stage: 'building-content' },
      { op: 'setStatusText', text: 'Offline stream interrupted after valid content.' },
    ],
  ]);

  return [
    ...prefix,
    {
      protocolVersion: 1,
      sessionId,
      streamId: `${sessionId}-mock-stream`,
      seq: 3,
      baseRevision: 2,
      resultRevision: 3,
      kind: 'error',
      payload: { message: 'simulated provider failure' },
    },
    {
      protocolVersion: 1,
      sessionId,
      streamId: `${sessionId}-mock-stream`,
      seq: 4,
      baseRevision: 3,
      resultRevision: 4,
      kind: 'transaction',
      payload: {
        transactionId: `${sessionId}-failure-actions`,
        ops: [
          {
            op: 'createBlock',
            block: block('fallback-actions', 'panel', {
              title: 'Offline Fallback',
              text: 'The last valid UI stayed visible. Retry, continue, regenerate, and make-more-realistic are local recovery actions.',
              buttons: ['Retry', 'Continue', 'Regenerate', 'Make More Realistic'],
            }, [], ['win98-panel', 'warning']),
          },
          { op: 'insertBlock', parentId: 'root', childId: 'fallback-actions' },
          { op: 'registerEventIntent', intent: eventIntent('fallback-action', 'fallback-actions', 'click', 'Handle a provider fallback action.') },
          { op: 'setStage', stage: 'stale' },
          { op: 'setStatusText', text: 'Stale offline fallback. Internal errors are hidden.' },
        ],
      },
    },
  ];
}

function createControlPanelStream(sessionId: string, intent: LaunchIntent): PatchEnvelope[] {
  return stagedStream(sessionId, [
    [
      { op: 'setAppIdentity', identity: identity(intent.title, 'Generated Control Panel property sheet', 'settings', 'Opening property pages...') },
      { op: 'setStage', stage: 'identifying' },
    ],
    [
      { op: 'createBlock', block: block('tabs', 'toolbar', { buttons: ['General', 'Advanced', 'Fake Network', 'About'] }, [], ['toolbar']) },
      { op: 'insertBlock', parentId: 'root', childId: 'tabs' },
      { op: 'setStage', stage: 'building-chrome' },
    ],
    [
      {
        op: 'createBlock',
        block: block('sheet', 'property-sheet', {
          groups: [
            { title: 'Simulation', rows: ['Run offline only', 'Use 256-color confidence', 'Disable serious productivity mode'] },
            { title: 'Status', rows: ['Provider: deterministic mock', 'Network: unplugged with dignity'] },
          ],
        }, [], ['win98-panel']),
      },
      { op: 'insertBlock', parentId: 'root', childId: 'sheet' },
      { op: 'setStage', stage: 'ready' },
      { op: 'setStatusText', text: 'Settings are theatrical and local.' },
    ],
  ]);
}

function createGenericAppStream(sessionId: string, intent: LaunchIntent): PatchEnvelope[] {
  return stagedStream(sessionId, [
    [
      {
        op: 'setAppIdentity',
        identity: identity(intent.title, 'Generated Windows-like utility', intent.iconHint, 'Choosing a plausible app costume...'),
      },
      { op: 'setStage', stage: 'identifying' },
    ],
    [
      { op: 'createBlock', block: block('menu', 'menu-bar', { items: ['File', 'Edit', 'View', 'Tools', 'Help'] }, [], ['menu-bar']) },
      { op: 'createBlock', block: block('toolbar', 'toolbar', { buttons: ['New', 'Open', 'Save', 'Inspect'] }, [], ['toolbar']) },
      { op: 'insertBlock', parentId: 'root', childId: 'menu' },
      { op: 'insertBlock', parentId: 'root', childId: 'toolbar' },
      { op: 'setStage', stage: 'building-chrome' },
    ],
    [
      {
        op: 'createBlock',
        block: block('body', 'panel', {
          title: intent.title,
          text: `A deterministic generated app for "${intent.rawQuery}" with fake local data and typed event intents.`,
        }, [], ['win98-panel']),
      },
      {
        op: 'createBlock',
        block: block('table', 'table', {
          columns: ['Item', 'Kind', 'Modified'],
          rows: [
            ['Primary surface', 'Generated block tree', '09:14 AM'],
            ['Offline data', 'Mock runtime', '09:15 AM'],
            ['Interaction plan', 'Event intents', '09:16 AM'],
          ],
        }, [], ['win98-inset', 'dense']),
      },
      { op: 'insertBlock', parentId: 'root', childId: 'body' },
      { op: 'insertBlock', parentId: 'root', childId: 'table' },
      { op: 'setStage', stage: 'building-content' },
    ],
    [
      { op: 'createBlock', block: block('status', 'status-bar', { text: 'Ready - simulated offline app' }, [], ['status-bar']) },
      { op: 'insertBlock', parentId: 'root', childId: 'status' },
      { op: 'setStage', stage: 'ready' },
      { op: 'setStatusText', text: 'Ready. Provider stream replaced by deterministic patch sequence.' },
    ],
  ]);
}

function stagedStream(sessionId: string, stages: PatchOperation[][]): PatchEnvelope[] {
  let revision = 0;
  return stages.map((ops, index) => {
    const envelope: PatchEnvelope = {
      protocolVersion: 1,
      sessionId,
      streamId: `${sessionId}-mock-stream`,
      seq: index + 1,
      baseRevision: revision,
      resultRevision: revision + 1,
      kind: 'transaction',
      payload: {
        transactionId: `${sessionId}-tx-${index + 1}`,
        ops,
      },
    };
    revision += 1;
    return envelope;
  });
}

function googleOps(query: string): PatchOperation[] {
  if (!query) {
    return [
      {
        op: 'createBlock',
        block: block('google-home', 'search-home', {
          brand: 'Google',
          inputValue: '',
          buttons: ['Google Search', "I'm Feeling Lucky"],
          note: 'Offline simulated page. No network request will be made.',
        }, [], ['google-page']),
      },
      { op: 'insertBlock', parentId: 'root', childId: 'google-home' },
    ];
  }

  return [
    {
      op: 'createBlock',
      block: block('google-results', 'search-results', {
        query,
        results: [
          {
            title: `${titleCase(query)} - VibeOS Offline Index`,
            url: `www.vibe-index.local/${sanitize(query)}`,
            snippet: `A simulated result about ${query}, staged locally with blue titles and compact snippets.`,
          },
          {
            title: `Classic web notes for ${query}`,
            url: `archive.local/${sanitize(query)}/notes`,
            snippet: 'Cached-looking metadata, familiar search rhythm, and no real external page fetch.',
          },
          {
            title: `${titleCase(query)} download, reference, and FAQ`,
            url: `oldweb.local/${sanitize(query)}/faq.html`,
            snippet: 'A generated old-web result with enough specificity to feel browsable.',
          },
        ],
      }, [], ['google-page']),
    },
    { op: 'insertBlock', parentId: 'root', childId: 'google-results' },
  ];
}

function wikiOps(topic: string, displayUrl: string): PatchOperation[] {
  return [
    {
      op: 'createBlock',
      block: block('wiki-page', 'wiki-article', {
        title: topic,
        displayUrl,
        contents: ['Early life', 'Career', 'Influence', 'References'],
        lead: `${topic} is presented here as an offline Wikipedia-like facsimile. The article favors visual plausibility over factual authority.`,
        infobox: [
          ['Born', 'Simulated date'],
          ['Known for', 'Generated article structure'],
          ['Status', 'Offline page'],
        ],
        sections: [
          {
            heading: 'Overview',
            text: 'The layout includes the familiar article tabs, left navigation, contents box, and right infobox.',
          },
          {
            heading: 'References',
            text: '1. VibeOS Offline Index. 2. Simulated Encyclopedia Cache.',
          },
        ],
      }, [], ['wiki-page']),
    },
    { op: 'insertBlock', parentId: 'root', childId: 'wiki-page' },
  ];
}

function exampleOps(displayUrl: string): PatchOperation[] {
  return [
    {
      op: 'createBlock',
      block: block('example', 'plain-example-page', {
        title: 'Example Domain',
        paragraph: 'This domain is for use in illustrative examples in documents.',
        linkText: 'More information...',
        displayUrl,
      }, [], ['win98-inset']),
    },
    { op: 'insertBlock', parentId: 'root', childId: 'example' },
  ];
}

function unknownSiteOps(domain: string): PatchOperation[] {
  return [
    {
      op: 'createBlock',
      block: block('unknown-site', 'facsimile-page', {
        pageKind: 'corporate-site',
        displayUrl: `http://${domain}/`,
        offlineSimulated: true,
        visualCues: ['old web header', 'left navigation', 'badges', 'status footer'],
        title: titleCase(domain),
        nav: ['Home', 'Products', 'Download', 'Support', 'Guestbook'],
        body: `Welcome to ${domain}, reconstructed locally as a late-90s web page with no real network access.`,
      }, [], ['win98-inset']),
    },
    { op: 'insertBlock', parentId: 'root', childId: 'unknown-site' },
  ];
}

function applyPatch(document: GeneratedDocument, op: PatchOperation) {
  switch (op.op) {
    case 'createBlock':
      document.blocks[op.block.id] = op.block;
      break;
    case 'insertBlock': {
      const parent = document.blocks[op.parentId];
      const index = op.index ?? parent.children.length;
      parent.children.splice(index, 0, op.childId);
      break;
    }
    case 'replaceBlock':
      document.blocks[op.blockId] = {
        ...op.block,
        id: op.blockId,
      };
      break;
    case 'removeBlock':
      removeBlock(document, op.blockId);
      break;
    case 'moveBlock': {
      for (const blockValue of Object.values(document.blocks)) {
        blockValue.children = blockValue.children.filter((childId) => childId !== op.blockId);
      }
      const parent = document.blocks[op.parentId];
      const index = op.index ?? parent.children.length;
      parent.children.splice(index, 0, op.blockId);
      break;
    }
    case 'setChildren':
      document.blocks[op.blockId].children = [...op.childIds];
      break;
    case 'spliceChildren': {
      const blockValue = document.blocks[op.blockId];
      blockValue.children.splice(op.start, op.deleteCount, ...op.childIds);
      break;
    }
    case 'setProps':
      document.blocks[op.blockId].props = op.props;
      break;
    case 'mergeProps':
      document.blocks[op.blockId].props = { ...document.blocks[op.blockId].props, ...op.props };
      break;
    case 'unsetProp':
      delete document.blocks[op.blockId].props[op.key];
      break;
    case 'setState':
      document.blocks[op.blockId].state = op.state;
      break;
    case 'setStyleTokens':
      document.blocks[op.blockId].styleTokens = [...op.styleTokens];
      break;
    case 'appendText': {
      const blockValue = document.blocks[op.blockId];
      blockValue.props.text = `${String(blockValue.props.text ?? '')}${op.text}`;
      break;
    }
    case 'replaceTextRange': {
      const blockValue = document.blocks[op.blockId];
      const text = String(blockValue.props.text ?? '');
      blockValue.props.text = `${text.slice(0, op.start)}${op.text}${text.slice(op.end)}`;
      break;
    }
    case 'setItems':
      document.blocks[op.blockId].props.items = [...op.items];
      break;
    case 'appendItems': {
      const blockValue = document.blocks[op.blockId];
      const items = Array.isArray(blockValue.props.items) ? blockValue.props.items : [];
      blockValue.props.items = [...items, ...op.items];
      break;
    }
    case 'spliceItems': {
      const blockValue = document.blocks[op.blockId];
      const items = Array.isArray(blockValue.props.items) ? [...blockValue.props.items] : [];
      items.splice(op.start, op.deleteCount, ...op.items);
      blockValue.props.items = items;
      break;
    }
    case 'updateItem': {
      const blockValue = document.blocks[op.blockId];
      const items = Array.isArray(blockValue.props.items) ? blockValue.props.items : [];
      blockValue.props.items = items.map((item) =>
        isItemWithId(item, op.itemId) ? { ...item, ...op.patch, id: op.itemId } : item,
      );
      break;
    }
    case 'removeItem': {
      const blockValue = document.blocks[op.blockId];
      const items = Array.isArray(blockValue.props.items) ? blockValue.props.items : [];
      blockValue.props.items = items.filter((item) => !isItemWithId(item, op.itemId));
      break;
    }
    case 'setAppIdentity':
      document.appIdentity = { ...document.appIdentity, ...op.identity };
      break;
    case 'setStage':
      document.stage = op.stage;
      break;
    case 'setStatusText':
      document.appIdentity.statusText = op.text;
      break;
    case 'setLoadingHint':
      document.loadingHint = op.text;
      break;
    case 'setFacsimileRoute':
      document.facsimileRoute = op.route;
      break;
    case 'setResourceManifest':
      document.resourceManifest = {
        resources: { ...op.manifest.resources },
      };
      break;
    case 'setSelection':
      document.selection = { blockId: op.blockId, value: op.selection };
      break;
    case 'setFocusRequest':
      document.focusRequest = op.blockId;
      break;
    case 'scrollIntoView':
      document.scrollRequest = op.blockId;
      break;
    case 'registerEventIntent':
      document.eventIntents[op.intent.id] = op.intent;
      document.blocks[op.intent.blockId].eventIntents = [
        ...(document.blocks[op.intent.blockId].eventIntents ?? []),
        op.intent.id,
      ];
      break;
    case 'updateEventIntent': {
      const current = document.eventIntents[op.intentId];
      const next = { ...current, ...op.patch, id: op.intentId };
      if (current.blockId !== next.blockId) {
        document.blocks[current.blockId].eventIntents = (document.blocks[current.blockId].eventIntents ?? []).filter(
          (intentId) => intentId !== op.intentId,
        );
        document.blocks[next.blockId].eventIntents = [...(document.blocks[next.blockId].eventIntents ?? []), op.intentId];
      }
      document.eventIntents[op.intentId] = next;
      break;
    }
    case 'unregisterEventIntent': {
      const current = document.eventIntents[op.intentId];
      if (current) {
        document.blocks[current.blockId].eventIntents = (document.blocks[current.blockId].eventIntents ?? []).filter(
          (intentId) => intentId !== op.intentId,
        );
      }
      delete document.eventIntents[op.intentId];
      break;
    }
  }
}

function validatePatch(document: GeneratedDocument, op: PatchOperation) {
  switch (op.op) {
    case 'createBlock':
      return (
        !document.blocks[op.block.id] &&
        allowedBlockTypes.has(op.block.type) &&
        op.block.styleTokens.length <= maxStyleTokens &&
        op.block.styleTokens.every((token) => allowedStyleTokens.has(token)) &&
        op.block.children.length <= maxChildren &&
        op.block.children.every((childId) => Boolean(document.blocks[childId])) &&
        validatePropsForBlock(op.block.type, op.block.props) &&
        validateBlockResourceRefs(document, op.block)
      );
    case 'insertBlock':
      return (
        Boolean(document.blocks[op.parentId] && document.blocks[op.childId]) &&
        canAcceptChild(document, op.parentId, op.childId) &&
        (op.index == null || (Number.isInteger(op.index) && op.index >= 0 && op.index <= document.blocks[op.parentId].children.length))
      );
    case 'replaceBlock':
      return (
        op.blockId !== document.rootBlockId &&
        Boolean(document.blocks[op.blockId]) &&
        op.block.id === op.blockId &&
        allowedBlockTypes.has(op.block.type) &&
        op.block.styleTokens.length <= maxStyleTokens &&
        op.block.styleTokens.every((token) => allowedStyleTokens.has(token)) &&
        op.block.children.length <= maxChildren &&
        op.block.children.every((childId) => Boolean(document.blocks[childId])) &&
        validatePropsForBlock(op.block.type, op.block.props) &&
        validateBlockResourceRefs(document, op.block)
      );
    case 'removeBlock':
      return op.blockId !== document.rootBlockId && Boolean(document.blocks[op.blockId]);
    case 'moveBlock':
      return (
        op.blockId !== document.rootBlockId &&
        Boolean(document.blocks[op.blockId] && document.blocks[op.parentId]) &&
        !isDescendant(document, op.blockId, op.parentId) &&
        (op.index == null || (Number.isInteger(op.index) && op.index >= 0 && op.index <= document.blocks[op.parentId].children.length))
      );
    case 'setChildren':
      return (
        Boolean(document.blocks[op.blockId]) &&
        op.childIds.length <= maxChildren &&
        new Set(op.childIds).size === op.childIds.length &&
        op.childIds.every((childId) => childId !== op.blockId && Boolean(document.blocks[childId]))
      );
    case 'spliceChildren': {
      const blockValue = document.blocks[op.blockId];
      const nextChildren = blockValue
        ? [
            ...blockValue.children.slice(0, op.start),
            ...op.childIds,
            ...blockValue.children.slice(op.start + op.deleteCount),
          ]
        : [];
      return (
        Boolean(blockValue) &&
        Number.isInteger(op.start) &&
        Number.isInteger(op.deleteCount) &&
        op.start >= 0 &&
        op.deleteCount >= 0 &&
        op.start <= blockValue.children.length &&
        op.childIds.every((childId) => childId !== op.blockId && Boolean(document.blocks[childId])) &&
        nextChildren.length <= maxChildren &&
        new Set(nextChildren).size === nextChildren.length
      );
    }
    case 'setProps': {
      const blockValue = document.blocks[op.blockId];
      return Boolean(blockValue) && validatePropsForBlock(blockValue.type, op.props) && validatePropsResourceRefs(document, blockValue.type, op.props);
    }
    case 'mergeProps':
      return validateMergedProps(document, op.blockId, op.props);
    case 'unsetProp':
      return Boolean(document.blocks[op.blockId]) && isSafeKey(op.key);
    case 'setState':
      return Boolean(document.blocks[op.blockId]) && validateStatePatch(op.state);
    case 'setStyleTokens':
      return (
        Boolean(document.blocks[op.blockId]) &&
        op.styleTokens.length <= maxStyleTokens &&
        op.styleTokens.every((token) => allowedStyleTokens.has(token))
      );
    case 'appendText':
      return validateTextMutation(document, op.blockId, op.text);
    case 'replaceTextRange': {
      const text = String(document.blocks[op.blockId]?.props.text ?? '');
      return (
        validateTextMutation(document, op.blockId, op.text) &&
        Number.isInteger(op.start) &&
        Number.isInteger(op.end) &&
        op.start >= 0 &&
        op.end >= op.start &&
        op.end <= text.length
      );
    }
    case 'setItems':
      return validateItemsMutation(document, op.blockId, op.items);
    case 'appendItems': {
      const current = getBlockItems(document, op.blockId);
      if (!current) return false;
      return validateItemsMutation(document, op.blockId, [...current, ...op.items]);
    }
    case 'spliceItems': {
      const current = getBlockItems(document, op.blockId);
      if (!current) return false;
      const next = [...current];
      if (!Number.isInteger(op.start) || !Number.isInteger(op.deleteCount) || op.start < 0 || op.deleteCount < 0 || op.start > next.length) {
        return false;
      }
      next.splice(op.start, op.deleteCount, ...op.items);
      return validateItemsMutation(document, op.blockId, next);
    }
    case 'updateItem': {
      const current = getBlockItems(document, op.blockId);
      if (!current || !validatePropBag(op.patch) || !current.some((item) => isItemWithId(item, op.itemId))) return false;
      const next = current.map((item) => (isItemWithId(item, op.itemId) ? { ...item, ...op.patch, id: op.itemId } : item));
      return validateItemsMutation(document, op.blockId, next);
    }
    case 'removeItem': {
      const current = getBlockItems(document, op.blockId);
      return Boolean(current?.some((item) => isItemWithId(item, op.itemId)));
    }
    case 'setAppIdentity':
      return validateIdentityPatch(op.identity);
    case 'setStage':
      return isValidStage(op.stage);
    case 'setStatusText':
      return op.text.length <= 240;
    case 'setLoadingHint':
      return op.text === null || isLimitedString(op.text, 240);
    case 'setFacsimileRoute':
      return (
        op.route.offlineSimulated === true &&
        op.route.displayUrl.length <= 240 &&
        op.route.visualCues.length <= 16 &&
        op.route.visualCues.every((cue) => typeof cue === 'string' && cue.length <= 80)
      );
    case 'setResourceManifest':
      return validateResourceManifest(op.manifest);
    case 'setSelection':
      return Boolean(document.blocks[op.blockId]) && validateMetadataValue(op.selection);
    case 'setFocusRequest':
    case 'scrollIntoView':
      return Boolean(document.blocks[op.blockId]);
    case 'registerEventIntent':
      return validateEventIntent(document, op.intent);
    case 'updateEventIntent': {
      const current = document.eventIntents[op.intentId];
      if (!current) return false;
      const next = { ...current, ...op.patch, id: op.intentId };
      return validateEventIntent(document, next);
    }
    case 'unregisterEventIntent':
      return Boolean(document.eventIntents[op.intentId]);
  }
}

function validateBlockGraph(document: GeneratedDocument) {
  const seen = new Set<string>();
  const visiting = new Set<string>();
  const parented = new Map<string, string>();
  const visit = (blockId: string, depth: number): boolean => {
    if (depth > maxDepth || visiting.has(blockId)) return false;
    if (seen.has(blockId)) return true;
    const block = document.blocks[blockId];
    if (!block) return false;
    if (new Set(block.children).size !== block.children.length || block.children.length > maxChildren) return false;
    visiting.add(blockId);
    for (const child of block.children) {
      const existingParent = parented.get(child);
      if (existingParent && existingParent !== blockId) return false;
      parented.set(child, blockId);
      if (!visit(child, depth + 1)) return false;
    }
    visiting.delete(blockId);
    seen.add(blockId);
    return true;
  };

  return Object.keys(document.blocks).length <= maxBlocks && visit(document.rootBlockId, 0) && seen.size === Object.keys(document.blocks).length;
}

function validateEnvelope(document: GeneratedDocument, envelope: PatchEnvelope) {
  if (
    envelope.protocolVersion !== 1 ||
    envelope.baseRevision !== document.revision ||
    envelope.resultRevision !== document.revision + 1 ||
    !Number.isInteger(envelope.seq) ||
    envelope.seq <= 0
  ) {
    return false;
  }

  if (envelope.kind === 'transaction') {
    return isTransactionPayload(envelope.payload);
  }

  if (envelope.kind === 'patch') {
    return isPatchOperation(envelope.payload);
  }

  if (envelope.kind === 'error') {
    return typeof envelope.payload === 'object' && envelope.payload !== null && 'message' in envelope.payload;
  }

  return ['lifecycle', 'validation', 'heartbeat', 'done'].includes(envelope.kind);
}

function isPatchOperation(payload: PatchEnvelope['payload']): payload is PatchOperation {
  return typeof payload === 'object' && payload !== null && 'op' in payload;
}

function isTransactionPayload(payload: PatchEnvelope['payload']): payload is { transactionId: string; ops: PatchOperation[] } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'transactionId' in payload &&
    'ops' in payload &&
    typeof payload.transactionId === 'string' &&
    Array.isArray(payload.ops) &&
    payload.ops.length > 0 &&
    payload.ops.length <= maxTransactionOps
  );
}

function isValidStage(stage: string): stage is GeneratedDocumentStage {
  return ['booting', 'identifying', 'building-chrome', 'building-content', 'detailing', 'ready', 'stale', 'errored'].includes(stage);
}

function cloneDocument(document: GeneratedDocument): GeneratedDocument {
  return {
    ...document,
    appIdentity: { ...document.appIdentity },
    blocks: Object.fromEntries(
      Object.entries(document.blocks).map(([id, blockValue]) => [
        id,
        {
          ...blockValue,
          props: { ...blockValue.props },
          children: [...blockValue.children],
          styleTokens: [...blockValue.styleTokens],
          eventIntents: blockValue.eventIntents ? [...blockValue.eventIntents] : undefined,
          state: blockValue.state ? { ...blockValue.state } : undefined,
        },
      ]),
    ),
    eventIntents: { ...document.eventIntents },
    resourceManifest: {
      resources: Object.fromEntries(
        Object.entries(document.resourceManifest.resources).map(([id, resource]) => [id, { ...resource }]),
      ),
    },
    facsimileRoute: document.facsimileRoute ? { ...document.facsimileRoute } : undefined,
    loadingHint: document.loadingHint,
    selection: document.selection ? { ...document.selection } : undefined,
    focusRequest: document.focusRequest,
    scrollRequest: document.scrollRequest,
  };
}

function removeBlock(document: GeneratedDocument, blockId: string) {
  const blockValue = document.blocks[blockId];
  if (!blockValue) return;

  for (const childId of blockValue.children) {
    removeBlock(document, childId);
  }

  for (const parent of Object.values(document.blocks)) {
    parent.children = parent.children.filter((childId) => childId !== blockId);
  }

  for (const intentId of blockValue.eventIntents ?? []) {
    delete document.eventIntents[intentId];
  }

  delete document.blocks[blockId];
}

function canAcceptChild(document: GeneratedDocument, parentId: string, childId: string) {
  const parent = document.blocks[parentId];
  if (!parent || parent.children.includes(childId) || parent.children.length >= maxChildren) return false;

  for (const blockValue of Object.values(document.blocks)) {
    if (blockValue.id !== parentId && blockValue.children.includes(childId)) return false;
  }

  return parentId !== childId;
}

function isDescendant(document: GeneratedDocument, ancestorId: string, candidateId: string): boolean {
  const ancestor = document.blocks[ancestorId];
  if (!ancestor) return false;
  if (ancestor.children.includes(candidateId)) return true;
  return ancestor.children.some((childId) => isDescendant(document, childId, candidateId));
}

function validateMergedProps(document: GeneratedDocument, blockId: string, props: Record<string, unknown>) {
  const blockValue = document.blocks[blockId];
  if (!blockValue) return false;
  const nextProps = { ...blockValue.props, ...props };
  return validatePropsForBlock(blockValue.type, nextProps) && validatePropsResourceRefs(document, blockValue.type, nextProps);
}

function validateTextMutation(document: GeneratedDocument, blockId: string, text: string) {
  const blockValue = document.blocks[blockId];
  if (!blockValue || !['text', 'heading', 'panel', 'group-box', 'terminal-transcript'].includes(blockValue.type)) return false;
  const current = String(blockValue.props.text ?? '');
  return text.length <= maxTextLength && current.length + text.length <= maxTextLength;
}

function getBlockItems(document: GeneratedDocument, blockId: string) {
  const blockValue = document.blocks[blockId];
  if (!blockValue || !Array.isArray(blockValue.props.items)) return undefined;
  return blockValue.props.items;
}

function validateItemsMutation(document: GeneratedDocument, blockId: string, items: unknown[]) {
  const blockValue = document.blocks[blockId];
  if (!blockValue || !['list', 'tree', 'radio-group', 'select', 'tab-strip'].includes(blockValue.type)) return false;
  return items.length <= maxItems && items.every(validateItemValue);
}

function validateStatePatch(state: Record<string, unknown>) {
  return validatePropBag(state) && Object.values(state).every(validateMetadataValue);
}

function validateMetadataValue(value: unknown): boolean {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.length <= 240;
  if (Array.isArray(value)) return value.length <= 24 && value.every(validateMetadataValue);
  if (typeof value === 'object') {
    return validatePropBag(value as Record<string, unknown>) && Object.values(value).every(validateMetadataValue);
  }
  return false;
}

function validateItemValue(item: unknown): boolean {
  if (typeof item === 'string') return item.length <= 160;
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return false;
  return validatePropBag(item as Record<string, unknown>) && Object.values(item).every(validateMetadataValue);
}

function isItemWithId(item: unknown, itemId: string): item is Record<string, unknown> & { id: string } {
  return typeof item === 'object' && item !== null && !Array.isArray(item) && String((item as { id?: unknown }).id) === itemId;
}

function validateIdentityPatch(identityPatch: Partial<AppIdentity>) {
  return (
    (identityPatch.title == null || isLimitedString(identityPatch.title, 120)) &&
    (identityPatch.subtitle == null || isLimitedString(identityPatch.subtitle, 180)) &&
    (identityPatch.iconToken == null || isLimitedString(identityPatch.iconToken, 40)) &&
    (identityPatch.statusText == null || isLimitedString(identityPatch.statusText, 240))
  );
}

function validateEventIntent(document: GeneratedDocument, intent: EventIntent) {
  return (
    Boolean(document.blocks[intent.blockId]) &&
    isLimitedString(intent.id, 80) &&
    isLimitedString(intent.description, 180) &&
    ['click', 'submit', 'change', 'select', 'navigate-simulated', 'open-dialog'].includes(intent.eventType)
  );
}

function validatePropsForBlock(type: GeneratedBlock['type'], props: Record<string, unknown>) {
  if (!validatePropBag(props)) return false;

  switch (type) {
    case 'app-chrome':
      return props.title == null || isLimitedString(props.title, 120);
    case 'menu-bar':
    case 'menu':
      return props.items == null || isStringArray(props.items, 12, 40);
    case 'toolbar':
    case 'tab-strip':
      return props.buttons == null || isStringArray(props.buttons, 20, 60);
    case 'status-bar':
      return props.text == null || isLimitedString(props.text, 240);
    case 'split-pane':
      return props.orientation == null || props.orientation === 'horizontal' || props.orientation === 'vertical';
    case 'tree':
      return (
        (props.title == null || isLimitedString(props.title, 80)) &&
        (props.items == null || isStringArray(props.items, maxItems, 120))
      );
    case 'list':
      return props.items == null || isRecordArray(props.items, maxItems);
    case 'table':
      return (
        (props.columns == null || isStringArray(props.columns, 12, 80)) &&
        (props.rows == null || (Array.isArray(props.rows) && props.rows.length <= maxItems))
      );
    case 'panel':
    case 'group-box':
    case 'dialog':
    case 'toast':
    case 'progress':
      return validatePanelProps(props);
    case 'button':
    case 'command-link':
    case 'checkbox':
    case 'text-input':
    case 'search-input':
    case 'slider':
      return validateControlProps(props);
    case 'radio-group':
    case 'select':
      return validateControlProps(props) && (props.items == null || isStringArray(props.items, maxItems, 120));
    case 'form':
      return validatePanelProps(props) && (props.fields == null || isRecordArray(props.fields, 32));
    case 'text':
    case 'heading':
    case 'terminal-transcript':
      return (
        (props.text == null || isLimitedString(props.text, maxTextLength)) &&
        (props.title == null || isLimitedString(props.title, 160))
      );
    case 'rich-text-spans':
      return props.spans == null || isRecordArray(props.spans, maxItems);
    case 'image-placeholder':
    case 'chart':
    case 'timeline':
      return validatePanelProps(props) && (props.items == null || isRecordArray(props.items, maxItems));
    case 'generated-bitmap':
      return (
        validatePanelProps(props) &&
        isLimitedString(props.resourceId, 80) &&
        (props.altText == null || isLimitedString(props.altText, 240))
      );
    case 'property-sheet':
      return props.groups == null || isRecordArray(props.groups, 16);
    case 'file-list':
      return (
        (props.path == null || isLimitedString(props.path, 240)) &&
        (props.columns == null || isStringArray(props.columns, 12, 80)) &&
        (props.files == null || isRecordArray(props.files, maxItems))
      );
    case 'paint-canvas':
      return (
        (props.tools == null || isStringArray(props.tools, 24, 80)) &&
        (props.colors == null || isStringArray(props.colors, 32, 16)) &&
        (props.caption == null || isLimitedString(props.caption, 240)) &&
        (props.pixels == null || isStringArray(props.pixels, 64, 256))
      );
    case 'download-portal':
      return (
        (props.title == null || isLimitedString(props.title, 160)) &&
        (props.version == null || isLimitedString(props.version, 120)) &&
        (props.mirrors == null || isStringArray(props.mirrors, 20, 120)) &&
        (props.requirements == null || isStringArray(props.requirements, 20, 120)) &&
        (props.badges == null || isStringArray(props.badges, 20, 80)) &&
        (props.ad == null || isLimitedString(props.ad, 240))
      );
    case 'nested-os-desktop':
      return (
        (props.wallpaper == null || isLimitedString(props.wallpaper, 80)) &&
        (props.icons == null || isStringArray(props.icons, 24, 80)) &&
        (props.windows == null || isRecordArray(props.windows, 12)) &&
        (props.taskbar == null || isStringArray(props.taskbar, 16, 80))
      );
    case 'search-home':
      return (
        (props.brand == null || isLimitedString(props.brand, 80)) &&
        (props.inputValue == null || isLimitedString(props.inputValue, 240)) &&
        (props.buttons == null || isStringArray(props.buttons, 8, 80)) &&
        (props.note == null || isLimitedString(props.note, 240))
      );
    case 'search-results':
      return (
        (props.query == null || isLimitedString(props.query, 240)) &&
        (props.results == null || isRecordArray(props.results, maxItems))
      );
    case 'wiki-article':
      return (
        (props.title == null || isLimitedString(props.title, 160)) &&
        (props.displayUrl == null || isLimitedString(props.displayUrl, 240)) &&
        (props.contents == null || isStringArray(props.contents, 24, 120)) &&
        (props.lead == null || isLimitedString(props.lead, maxTextLength)) &&
        (props.infobox == null || Array.isArray(props.infobox)) &&
        (props.sections == null || isRecordArray(props.sections, 32))
      );
    case 'encyclopedia-article':
      return (
        (props.title == null || isLimitedString(props.title, 160)) &&
        (props.lead == null || isLimitedString(props.lead, maxTextLength)) &&
        (props.sections == null || isStringArray(props.sections, 32, 120)) &&
        (props.caption == null || isLimitedString(props.caption, 240))
      );
    case 'plain-example-page':
      return (
        (props.title == null || isLimitedString(props.title, 80)) &&
        (props.paragraph == null || isLimitedString(props.paragraph, 300)) &&
        (props.linkText == null || isLimitedString(props.linkText, 80)) &&
        (props.displayUrl == null || isLimitedString(props.displayUrl, 240))
      );
    case 'facsimile-page':
    case 'facsimile-address-bar':
    case 'fan-site':
    case 'corporate-site':
    case 'forum-thread':
    case 'classic-software-page':
      return validateFacsimileProps(props);
    default:
      return true;
  }
}

function validatePanelProps(props: Record<string, unknown>) {
  return (
    (props.title == null || isLimitedString(props.title, 160)) &&
    (props.text == null || isLimitedString(props.text, maxTextLength)) &&
    (props.caption == null || isLimitedString(props.caption, 240)) &&
    (props.display == null || isLimitedString(props.display, 160)) &&
    (props.buttons == null || isStringArray(props.buttons, 32, 80))
  );
}

function validateControlProps(props: Record<string, unknown>) {
  return (
    (props.label == null || isLimitedString(props.label, 160)) &&
    (props.text == null || isLimitedString(props.text, maxTextLength)) &&
    (props.value == null || validateMetadataValue(props.value)) &&
    (props.disabled == null || typeof props.disabled === 'boolean')
  );
}

function validateFacsimileProps(props: Record<string, unknown>) {
  return (
    (props.pageKind == null || isLimitedString(props.pageKind, 80)) &&
    (props.displayUrl == null || isLimitedString(props.displayUrl, 240)) &&
    (props.offlineSimulated == null || props.offlineSimulated === true) &&
    (props.visualCues == null || isStringArray(props.visualCues, 24, 100)) &&
    (props.title == null || isLimitedString(props.title, 160)) &&
    (props.body == null || isLimitedString(props.body, maxTextLength)) &&
    (props.nav == null || isStringArray(props.nav, 24, 80))
  );
}

function validateBlockResourceRefs(document: GeneratedDocument, blockValue: GeneratedBlock) {
  return validatePropsResourceRefs(document, blockValue.type, blockValue.props);
}

function validatePropsResourceRefs(document: GeneratedDocument, type: GeneratedBlock['type'], props: Record<string, unknown>) {
  if (type !== 'generated-bitmap') return true;
  return typeof props.resourceId === 'string' && Boolean(document.resourceManifest.resources[props.resourceId]);
}

function validateResourceManifest(manifest: ResourceManifest) {
  if (typeof manifest !== 'object' || manifest === null || typeof manifest.resources !== 'object' || manifest.resources === null) {
    return false;
  }

  const entries = Object.entries(manifest.resources);
  return (
    entries.length <= maxResources &&
    entries.every(([id, resource]) => id === resource.id && isSafeKey(id) && validateGeneratedResource(resource))
  );
}

function validateDocumentResources(document: GeneratedDocument) {
  return (
    validateResourceManifest(document.resourceManifest) &&
    Object.values(document.blocks).every((blockValue) => validateBlockResourceRefs(document, blockValue))
  );
}

function validateGeneratedResource(resource: GeneratedResource) {
  if (resource.kind !== 'generated-bitmap') return false;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(resource.mimeType)) return false;
  if (
    !Number.isInteger(resource.width) ||
    !Number.isInteger(resource.height) ||
    resource.width <= 0 ||
    resource.height <= 0 ||
    resource.width > maxBitmapDimension ||
    resource.height > maxBitmapDimension
  ) {
    return false;
  }
  if (!Number.isInteger(resource.byteLength) || resource.byteLength <= 0 || resource.byteLength > maxBitmapBytes) return false;
  if (!/^[a-f0-9]{32,128}$/i.test(resource.hash)) return false;
  if (resource.altText != null && !isLimitedString(resource.altText, 240)) return false;
  if (resource.dataUrl == null) return true;

  return (
    resource.dataUrl.length <= Math.ceil(maxBitmapBytes * 1.4) + 64 &&
    resource.dataUrl.startsWith(`data:${resource.mimeType};base64,`)
  );
}

function validatePropBag(props: Record<string, unknown>) {
  return Object.keys(props).every(isSafeKey);
}

function isSafeKey(key: string) {
  return key !== '__proto__' && key !== 'prototype' && key !== 'constructor' && key.length <= 64;
}

function isLimitedString(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.length <= maxLength;
}

function isStringArray(value: unknown, maxCount: number, maxLength: number) {
  return Array.isArray(value) && value.length <= maxCount && value.every((item) => isLimitedString(item, maxLength));
}

function isRecordArray(value: unknown, maxCount: number) {
  return (
    Array.isArray(value) &&
    value.length <= maxCount &&
    value.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item))
  );
}

function block(
  id: string,
  type: GeneratedBlock['type'],
  props: Record<string, unknown>,
  children: string[] = [],
  styleTokens: string[] = [],
): GeneratedBlock {
  return {
    id,
    type,
    props,
    children,
    styleTokens,
  };
}

function identity(title: string, subtitle: string, iconToken: string, statusText: string): AppIdentity {
  return {
    title,
    subtitle,
    iconToken,
    statusText,
  };
}

function eventIntent(
  id: string,
  blockId: string,
  eventType: EventIntent['eventType'],
  description: string,
): EventIntent {
  return {
    id,
    blockId,
    eventType,
    description,
  };
}

function facsimile(pageKind: string, displayUrl: string, visualCues: string[]): FacsimileRoute {
  return {
    pageKind,
    displayUrl,
    offlineSimulated: true,
    visualCues,
  };
}

function sanitize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'home';
}

function titleCase(value: string) {
  return value
    .split(/[\s.-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
