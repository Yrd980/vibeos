import type { LaunchIntent, SearchResult } from './types';

let intentCounter = 0;

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');

const slug = (value: string) =>
  normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'untitled';

const nextIntentId = (query: string) => {
  intentCounter += 1;
  return `intent-${slug(query)}-${intentCounter}`;
};

type ResolveOptions = {
  source: LaunchIntent['source'];
  forceGenerated?: boolean;
};

export function createLaunchIntent(rawQuery: string, options: ResolveOptions): LaunchIntent {
  const query = normalize(rawQuery) || 'new generated desk accessory';
  const lower = query.toLowerCase();
  const exactBuiltIn = lower === 'calculator' || lower === 'calc' || lower === 'notepad';
  const browserBuiltIn = lower === 'browser' || lower === 'internet explorer';
  const looksLikeUrl =
    lower === 'example.com' ||
    lower.includes('.') ||
    lower.startsWith('http://') ||
    lower.startsWith('https://');
  const looksLikeWiki =
    lower.includes('wikipedia') ||
    lower.startsWith('wiki ') ||
    lower.includes('encyclopedia') ||
    lower.includes('encarta');

  if (!options.forceGenerated && exactBuiltIn) {
    const isCalculator = lower === 'calculator' || lower === 'calc';
    return {
      id: nextIntentId(query),
      source: options.source,
      kind: 'local-app',
      rawQuery: query,
      title: isCalculator ? 'Calculator' : 'Notepad',
      prompt: query,
      seed: slug(query),
      iconHint: isCalculator ? 'calculator' : 'notepad',
      targetHint: isCalculator ? 'calculator' : 'notepad',
      generationMode: 'instant',
    };
  }

  if (!options.forceGenerated && (browserBuiltIn || looksLikeUrl || looksLikeWiki)) {
    return {
      id: nextIntentId(query),
      source: options.source,
      kind: 'browser-page',
      rawQuery: query,
      title: browserBuiltIn ? 'Internet Explorer' : query,
      prompt: query,
      seed: slug(query),
      iconHint: 'browser',
      browserAddress: browserBuiltIn ? 'about:home' : query,
      generationMode: 'staged',
    };
  }

  const nested = lower.includes('nested os') || lower.includes('windows in windows');
  const fileLike = lower.includes('file explorer') || lower.includes('folder') || lower.includes('file') || lower.includes('document');
  const systemTool = lower.includes('control panel') || lower.includes('settings');

  return {
    id: nextIntentId(query),
    source: options.source,
    kind: nested ? 'nested-os' : systemTool ? 'system-tool' : fileLike ? 'file-like' : 'generated-app',
    rawQuery: query,
    title: titleFromQuery(query),
    prompt: query,
    seed: slug(query),
    iconHint: iconFromQuery(lower),
    generationMode: 'staged',
  };
}

export function resolveSearchResults(query: string, recents: LaunchIntent[]): SearchResult[] {
  const normalized = normalize(query);
  const lower = normalized.toLowerCase();
  const results: SearchResult[] = [];

  const add = (title: string, kind: string, description: string, rawQuery: string, icon: string) => {
    results.push({
      id: `result-${results.length}-${slug(rawQuery)}`,
      icon,
      title,
      kind,
      description,
      intent: createLaunchIntent(rawQuery, { source: 'search' }),
    });
  };

  if (!normalized) {
    add('Internet Explorer', 'Local browser', 'Open the simulated offline web.', 'Internet Explorer', 'browser');
    add('Calculator', 'Local app', 'Classic local calculator. No generated behavior.', 'Calculator', 'calculator');
    add('Notepad', 'Local app', 'A local scratchpad inside VibeOS.', 'Notepad', 'notepad');
    add('Control Panel', 'Generated system tool', 'Classic settings panes and property sheets.', 'Control Panel', 'settings');
  } else {
    const matchingRecent = recents.find((intent) => intent.rawQuery.toLowerCase() === lower);
    if (matchingRecent) {
      results.push({
        id: `recent-${matchingRecent.id}`,
        icon: matchingRecent.iconHint,
        title: matchingRecent.title,
        kind: 'Recent session',
        description: `Replay cached staged construction for "${matchingRecent.rawQuery}".`,
        intent: { ...matchingRecent, id: nextIntentId(matchingRecent.rawQuery), source: 'search', generationMode: 'cached' },
      });
    }

    if ('todo'.startsWith(lower) || lower.includes('todo') || lower.includes('to do')) {
      add('To Do', 'Generated app', 'A simple generated task list for notes and reminders.', 'todo', 'todo');
      add('TaskPad 98', 'Generated app', 'Classic Windows task organizer with old status panes.', 'TaskPad 98', 'todo');
      add('Checklist', 'Generated app', 'Step-by-step list builder.', 'Checklist', 'todo');
      add('Reminder Desk', 'Generated app', 'Sticky-note reminders for the simulated desktop.', 'Reminder Desk', 'todo');
    }

    if (lower === 'calculator' || lower === 'calc') {
      add('Calculator', 'Local app', 'Classic local calculator. No model latency.', 'Calculator', 'calculator');
    }

    if (lower === 'browser' || lower === 'internet explorer') {
      add('Internet Explorer', 'Local browser', 'Open the simulated offline web.', 'Internet Explorer', 'browser');
    }

    if (lower.includes('calculator') && lower !== 'calculator' && lower !== 'calc') {
      results.push({
        id: `generated-calculator-${slug(normalized)}`,
        icon: 'calculator',
        title: titleFromQuery(normalized),
        kind: 'Generated app',
        description: 'A calculator-like hallucinated program, not the local Calculator.',
        intent: createLaunchIntent(normalized, { source: 'search', forceGenerated: true }),
      });
    }

    if (lower === 'notepad') {
      add('Notepad', 'Local app', 'A local scratchpad inside VibeOS.', 'Notepad', 'notepad');
    }

    if (lower.includes('wikipedia') || lower.startsWith('wiki ')) {
      add(titleFromQuery(normalized), 'Offline browser page', 'Open a Wikipedia-like simulated article.', normalized, 'wiki');
    }

    if (lower.includes('encarta')) {
      results.push({
        id: `encarta-${slug(normalized)}`,
        icon: 'encarta',
        title: titleFromQuery(normalized),
        kind: 'Generated encyclopedia',
        description: 'CD-ROM encyclopedia layout with side index, media pane, and staged details.',
        intent: createLaunchIntent(normalized, { source: 'search', forceGenerated: true }),
      });
    }

    if (lower.includes('file explorer') || lower.includes('folder')) {
      results.push({
        id: `file-explorer-${slug(normalized)}`,
        icon: 'file',
        title: 'File Explorer',
        kind: 'Generated file manager',
        description: 'Classic tree, path, file list, modified date, size, and status text.',
        intent: createLaunchIntent(normalized, { source: 'search', forceGenerated: true }),
      });
    }

    if (lower.includes('paint')) {
      results.push({
        id: `paint-${slug(normalized)}`,
        icon: 'paint',
        title: titleFromQuery(normalized),
        kind: 'Generated paint program',
        description: 'Tool palette, color swatches, canvas, and status bar.',
        intent: createLaunchIntent(normalized, { source: 'search', forceGenerated: true }),
      });
    }

    if (lower.includes('download')) {
      results.push({
        id: `download-${slug(normalized)}`,
        icon: 'browser',
        title: titleFromQuery(normalized),
        kind: 'Generated download portal',
        description: 'Old mirror buttons, system requirements, badges, ads, and version notes.',
        intent: createLaunchIntent(normalized, { source: 'search', forceGenerated: true }),
      });
    }

    if (lower.includes('nested os') || lower.includes('windows in windows')) {
      results.push({
        id: `nested-${slug(normalized)}`,
        icon: 'nested',
        title: titleFromQuery(normalized),
        kind: 'Nested OS',
        description: 'An inner desktop, taskbar, icons, and fake boot/opening behavior.',
        intent: createLaunchIntent(normalized, { source: 'search', forceGenerated: true }),
      });
    }

    if (lower.includes('fail') || lower.includes('provider error')) {
      results.push({
        id: `failure-${slug(normalized)}`,
        icon: 'generated',
        title: titleFromQuery(normalized),
        kind: 'Failure fallback',
        description: 'Simulate provider failure while preserving the last valid staged UI.',
        intent: createLaunchIntent(normalized, { source: 'search', forceGenerated: true }),
      });
    }

    if (lower === 'example.com') {
      add('example.com', 'Offline browser page', 'Simple Example Domain facsimile.', 'example.com', 'browser');
    }

    if (lower.includes('.') && lower !== 'example.com') {
      add(normalized, 'Offline browser page', 'Open a simulated page for this display URL.', normalized, 'browser');
    }

    add(`Create "${normalized}"`, 'Generated app', 'Invent a small Windows-like app for this prompt.', normalized, 'generated');
    add(`Search the offline web for "${normalized}"`, 'Browser search', 'Open in Internet Explorer.', normalized, 'browser');
    add(`${titleFromQuery(normalized)}.vdoc`, 'Fake file', 'Open a simulated desktop document.', `${normalized} file`, 'file');
    add(`${titleFromQuery(normalized)} Settings`, 'System tool', 'Open a generated Control Panel-style property sheet.', `${normalized} settings`, 'settings');
  }

  return dedupeResults(results).slice(0, 9);
}

export function resolveSemanticSuggestions(query: string): SearchResult[] {
  const normalized = normalize(query);
  if (!normalized) return [];

  const lower = normalized.toLowerCase();
  const suggestions: Array<{ title: string; kind: string; description: string; rawQuery: string; icon: string }> = [];

  if (!lower.includes('download')) {
    suggestions.push({
      title: `${titleFromQuery(normalized)} Download Archive`,
      kind: 'Async suggestion',
      description: 'A generated old-web download portal suggestion.',
      rawQuery: `download portal for ${normalized}`,
      icon: 'browser',
    });
  }

  if (!lower.includes('paint')) {
    suggestions.push({
      title: `Paint ${titleFromQuery(normalized)}`,
      kind: 'Async suggestion',
      description: 'Paint-like generated workspace with a simulated canvas.',
      rawQuery: `paint ${normalized}`,
      icon: 'paint',
    });
  }

  if (!lower.includes('wiki') && !lower.includes('wikipedia')) {
    suggestions.push({
      title: `Wikipedia ${titleFromQuery(normalized)}`,
      kind: 'Async suggestion',
      description: 'Open an offline encyclopedia-style browser article.',
      rawQuery: `wikipedia ${normalized}`,
      icon: 'wiki',
    });
  }

  return suggestions.map((suggestion, index) => ({
    id: `semantic-${index}-${slug(suggestion.rawQuery)}`,
    icon: suggestion.icon,
    title: suggestion.title,
    kind: suggestion.kind,
    description: suggestion.description,
    intent: createLaunchIntent(suggestion.rawQuery, { source: 'search', forceGenerated: suggestion.icon !== 'wiki' }),
  }));
}

function dedupeResults(results: SearchResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.title}-${result.kind}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function iconFromQuery(lower: string) {
  if (lower.includes('calculator')) return 'calculator';
  if (lower.includes('todo') || lower.includes('task')) return 'todo';
  if (lower.includes('encarta') || lower.includes('encyclopedia')) return 'encarta';
  if (lower.includes('paint')) return 'paint';
  if (lower.includes('file')) return 'file';
  if (lower.includes('control') || lower.includes('settings')) return 'settings';
  if (lower.includes('nested') || lower.includes('windows')) return 'nested';
  return 'generated';
}

function titleFromQuery(query: string) {
  const cleaned = normalize(query)
    .replace(/^make me an?\s+/i, '')
    .replace(/^open\s+/i, '')
    .replace(/^create\s+/i, '');

  return cleaned
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
