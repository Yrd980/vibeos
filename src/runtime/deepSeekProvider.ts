import { createAsyncProviderSession, type RuntimeProvider } from './providers';
import { adaptProviderJsonOutput } from './providerOutputAdapter';
import { applyPatchEnvelope } from './generatedRuntime';
import type { GeneratedDocument, GenerationSessionMeta, LaunchIntent, PatchEnvelope, PatchOperation } from './types';

const deepSeekBaseUrl = '/api/deepseek';
const defaultDeepSeekModel = 'deepseek-chat';

export const deepSeekProvider: RuntimeProvider = {
  id: 'deepseek-json-adapter',
  source: 'deepseek',
  start(intent, meta, baseDocument) {
    const configured = readDeepSeekConfig();
    const streamId = `${meta.sessionId}-deepseek-stream`;
    let validationDocument = baseDocument;
    let validationRevision = meta.baseRevision;

    return createAsyncProviderSession({
      id: `${meta.sessionId}-deepseek-provider`,
      providerId: 'deepseek-json-adapter',
      source: 'deepseek',
      streamId,
      baseRevision: meta.baseRevision,
      request: async (enqueue, signal) => {
        if (!configured.enabled) {
          throw new Error('DeepSeek provider is not configured for this offline prototype.');
        }

        let streamedAny = false;
        const content = await requestDeepSeekContent(intent, meta, signal, (chunk) => {
          const adaptedChunk = adaptDeepSeekContent(chunk, meta, validationDocument, validationRevision);
          if (adaptedChunk.kind === 'rejected') {
            throw new Error(adaptedChunk.reason);
          }
          streamedAny = true;
          enqueue(adaptedChunk.envelopes);
          validationDocument = replayAcceptedEnvelopes(validationDocument, adaptedChunk.envelopes);
          validationRevision = adaptedChunk.envelopes.at(-1)?.resultRevision ?? validationRevision;
        });
        if (streamedAny) return;
        const adapted = adaptDeepSeekContent(content, meta, validationDocument, validationRevision);
        if (adapted.kind === 'rejected') throw new Error(adapted.reason);
        return adapted.envelopes;
      },
      failureEnvelope: (message, baseRevision) => deepSeekFailureRecoveryStream(meta.sessionId, streamId, baseRevision, message),
    });
  },
};

export function buildDeepSeekChatRequest(intent: LaunchIntent, meta: GenerationSessionMeta) {
  return {
    url: `${deepSeekBaseUrl}/chat/completions`,
    body: {
      model: readDeepSeekConfig().model,
      stream: false,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: meta.kind === 'browser-facsimile' ? deepSeekBrowserSystemPrompt : deepSeekSystemPrompt,
        },
        {
          role: 'user',
          content: JSON.stringify({
            sessionId: meta.sessionId,
            prompt: intent.prompt,
            kind: meta.kind,
            safetyMode: meta.safetyMode,
            baseRevision: meta.baseRevision,
          }),
        },
      ],
    },
  };
}

export function adaptDeepSeekContent(
  content: string,
  meta: GenerationSessionMeta,
  baseDocument?: GeneratedDocument,
  baseRevision = meta.baseRevision,
) {
  const normalizedContent = normalizeDeepSeekContent(content);
  return adaptProviderJsonOutput({
    raw: normalizedContent,
    sessionId: meta.sessionId,
    streamId: `${meta.sessionId}-deepseek-stream`,
    baseRevision,
    baseDocument,
  });
}

export function isDeepSeekEnabled() {
  const config = readDeepSeekConfig();
  return config.enabled;
}

const deepSeekSystemPrompt = `Return only one JSON object.
Never return HTML, CSS, scripts, iframes, external resources, executable code, markdown, or comments.
The JSON object must have this shape: {"document": GeneratedDocument, "statusText": string}.

GeneratedDocument shape:
- documentId: "deepseek-document"
- revision: 0
- stage: "ready"
- rootBlockId: "root"
- appIdentity: { "title": string, "subtitle": string, "iconToken": "generated", "statusText": string }
- blocks: object keyed by block id
- eventIntents: {}
- resourceManifest: { "resources": {} }

Every block must have:
- id: string matching its key
- type: one of "app-chrome", "menu-bar", "toolbar", "panel", "table", "text", "heading", "status-bar", "split-pane", "list", "timeline", "chart"
- props: object
- children: string[]
- styleTokens: array using only "win98-window", "win98-panel", "win98-inset", "win98-raised", "menu-bar", "toolbar", "toolbar-button", "status-bar", "split-pane", "group-box", "link-blue", "google-page", "google-result-title", "google-url", "wiki-page", "wiki-sidebar", "wiki-infobox", "wiki-tabs", "encarta-page", "encarta-sidebar", "download-portal", "download-button", "file-explorer", "file-list-row", "paint-shell", "paint-canvas", "nested-os", "nested-taskbar", "disabled", "badge", "todo-list", "calculator-grid", "warning", "muted", "tiny", "dense"

Use a simple tree:
- root is app-chrome with children ["menu","toolbar","body","status"]
- menu is menu-bar with props.items as string[]
- toolbar is toolbar with props.buttons as string[]
- body is a panel with 2-5 child blocks
- status is status-bar

Supported body child examples:
- heading props: {"text": "..."}
- text props: {"text": "..."}
- panel props: {"title": "...", "text": "...", "buttons": ["..."]}
- table props: {"columns": ["..."], "rows": [["..."]]}
- timeline/chart props: {"title": "...", "items": [{"label": "...", "value": "..."}]}

Make the app feel like a playful Windows 98 desktop program generated for the user's prompt. Keep all text offline-simulated and fictional.`;

const deepSeekBrowserSystemPrompt = `Return only one JSON object.
Never return HTML, CSS, scripts, iframes, external resources, executable code, markdown, or comments.
The JSON object must have this shape: {"document": GeneratedDocument, "statusText": string}.

Generate a fictional offline Internet Explorer page facsimile. This is rendered inside an existing browser chrome, so do not create app menus, app toolbars, app windows, or desktop controls.

GeneratedDocument shape:
- documentId: "deepseek-browser-document"
- revision: 0
- stage: "ready"
- rootBlockId: "root"
- appIdentity: { "title": string, "subtitle": "Generated browser facsimile", "iconToken": "browser", "statusText": string }
- blocks: object keyed by block id
- eventIntents: {}
- resourceManifest: { "resources": {} }
- optional facsimileRoute: { "pageKind": string, "displayUrl": string, "offlineSimulated": true, "visualCues": string[] }

Every block must have:
- id: string matching its key
- props: object
- children: string[]
- styleTokens: array using only "win98-panel", "win98-inset", "win98-raised", "link-blue", "google-page", "google-result-title", "google-url", "wiki-page", "wiki-sidebar", "wiki-infobox", "wiki-tabs", "download-portal", "download-button", "warning", "muted", "tiny", "dense"

Use one root child named "page". Choose exactly one page block type:
- "search-results" with props {"query": string, "results": [{"title": string, "url": string, "snippet": string}]}
- "fan-site" with props {"title": string, "displayUrl": string, "body": string, "nav": string[]}
- "corporate-site" with props {"title": string, "displayUrl": string, "body": string, "nav": string[]}
- "forum-thread" with props {"title": string, "displayUrl": string, "body": string, "nav": string[]}
- "classic-software-page" with props {"title": string, "displayUrl": string, "body": string, "nav": string[]}
- "download-portal" with props {"title": string, "version": string, "mirrors": string[], "requirements": string[], "badges": string[], "ad": string}
- "plain-example-page" with props {"title": string, "paragraph": string, "linkText": string, "displayUrl": string}

Make it look like a late-90s / early-2000s generated web page. Keep all facts fictional or clearly offline-simulated.`;

const allowedDeepSeekStyleTokens = new Set([
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

const deepSeekStyleTokenAliases: Record<string, string> = {
  accent: 'win98-raised',
  browser: 'win98-panel',
  dialog: 'win98-window',
  encarta: 'encarta-page',
  google: 'google-page',
  old_web: 'win98-panel',
  'old-web': 'win98-panel',
  raised: 'win98-raised',
  status: 'status-bar',
  sunken: 'win98-inset',
  wiki: 'wiki-page',
};

function normalizeDeepSeekContent(content: string) {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.document)) return content;
    return JSON.stringify({
      ...parsed,
      document: normalizeDeepSeekDocument(parsed.document),
    });
  } catch {
    return content;
  }
}

function normalizeDeepSeekDocument(document: Record<string, unknown>) {
  const blocks = isRecord(document.blocks) ? document.blocks : {};
  const normalizedBlocks = Object.fromEntries(
    Object.entries(blocks).map(([blockId, blockValue]) => [
      blockId,
      normalizeDeepSeekBlock(blockId, blockValue, document.rootBlockId),
    ]),
  );

  return {
    ...document,
    blocks: normalizedBlocks,
    eventIntents: isRecord(document.eventIntents) ? document.eventIntents : {},
    resourceManifest: isRecord(document.resourceManifest) ? document.resourceManifest : { resources: {} },
  };
}

function normalizeDeepSeekBlock(blockId: string, value: unknown, rootBlockId: unknown) {
  if (!isRecord(value)) return value;
  const inferredType = inferDeepSeekBlockType(blockId, value, rootBlockId);
  const type = typeof value.type === 'string' ? value.type : inferredType;
  const props = isRecord(value.props) ? normalizeDeepSeekProps(type, value.props) : {};
  const styleTokens = normalizeDeepSeekStyleTokens(value.styleTokens);

  return {
    ...value,
    id: typeof value.id === 'string' ? value.id : blockId,
    type,
    props,
    children: Array.isArray(value.children) ? value.children.filter((childId) => typeof childId === 'string') : [],
    styleTokens: styleTokens.length ? styleTokens : ['win98-panel'],
  };
}

function inferDeepSeekBlockType(blockId: string, value: Record<string, unknown>, rootBlockId: unknown) {
  if (blockId === rootBlockId || blockId === 'root') return 'app-chrome';
  const props = isRecord(value.props) ? value.props : {};
  if (Array.isArray(props.results)) return 'search-results';
  if (Array.isArray(props.mirrors) || Array.isArray(props.requirements)) return 'download-portal';
  if (typeof props.paragraph === 'string' || typeof props.linkText === 'string') return 'plain-example-page';
  if (typeof props.displayUrl === 'string' && Array.isArray(props.nav)) return 'fan-site';
  if (typeof props.text === 'string' || typeof props.title === 'string') return 'panel';
  return 'panel';
}

function normalizeDeepSeekProps(type: string, props: Record<string, unknown>) {
  if (type === 'menu-bar' || type === 'menu') {
    return {
      ...props,
      items: normalizeDeepSeekStringArray(props.items, 12, 40),
    };
  }

  if (type === 'toolbar' || type === 'tab-strip') {
    return {
      ...props,
      buttons: normalizeDeepSeekStringArray(props.buttons, 20, 60),
    };
  }

  if (['panel', 'group-box', 'dialog', 'toast', 'progress'].includes(type)) {
    return {
      ...props,
      buttons: props.buttons == null ? undefined : normalizeDeepSeekStringArray(props.buttons, 32, 80),
    };
  }

  if (type === 'table') {
    return {
      ...props,
      columns: normalizeDeepSeekStringArray(props.columns, 12, 80),
      rows: normalizeDeepSeekTableRows(props.rows),
    };
  }

  if (type === 'chart' || type === 'timeline') {
    return {
      ...props,
      items: normalizeDeepSeekLabelValueItems(props.items),
    };
  }

  if (type === 'list') {
    return {
      ...props,
      items: normalizeDeepSeekListItems(props.items),
    };
  }

  if (type === 'search-home') {
    return {
      ...props,
      buttons: normalizeDeepSeekStringArray(props.buttons, 8, 80),
    };
  }

  if (type === 'search-results') {
    return {
      ...props,
      results: normalizeDeepSeekSearchResults(props.results),
    };
  }

  if (type === 'download-portal') {
    return {
      ...props,
      mirrors: normalizeDeepSeekStringArray(props.mirrors, 20, 120),
      requirements: normalizeDeepSeekStringArray(props.requirements, 20, 120),
      badges: normalizeDeepSeekStringArray(props.badges, 20, 80),
    };
  }

  if (
    type === 'facsimile-page' ||
    type === 'facsimile-address-bar' ||
    type === 'fan-site' ||
    type === 'corporate-site' ||
    type === 'forum-thread' ||
    type === 'classic-software-page'
  ) {
    return {
      ...props,
      offlineSimulated: props.offlineSimulated == null ? undefined : true,
      visualCues: normalizeDeepSeekStringArray(props.visualCues, 24, 100),
      nav: normalizeDeepSeekStringArray(props.nav, 24, 80),
    };
  }

  return props;
}

function normalizeDeepSeekStyleTokens(value: unknown) {
  if (!Array.isArray(value)) return [];
  return unique(
    value
      .map((token) => String(token).trim())
      .map((token) => deepSeekStyleTokenAliases[token] ?? token)
      .filter((token) => allowedDeepSeekStyleTokens.has(token))
      .slice(0, 8),
  );
}

function normalizeDeepSeekStringArray(value: unknown, maxCount: number, maxLength: number) {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item) => displayDeepSeekValue(item, maxLength)).filter(Boolean).slice(0, maxCount);
  return items.length ? items : undefined;
}

function normalizeDeepSeekTableRows(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const rows = value
    .filter((row) => Array.isArray(row))
    .map((row) => row.map((cell) => displayDeepSeekValue(cell, 160)).slice(0, 12))
    .slice(0, 80);
  return rows.length ? rows : undefined;
}

function normalizeDeepSeekLabelValueItems(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const items = value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const label = displayDeepSeekValue(item.label, 120);
    const itemValue = displayDeepSeekValue(item.value, 240);
    return label && itemValue ? [{ label, value: itemValue }] : [];
  });
  return items.length ? items.slice(0, 80) : undefined;
}

function normalizeDeepSeekListItems(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const items = value.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const title = displayDeepSeekValue(item.title ?? item.label ?? item.name, 160);
    if (!title) return [];
    return [
      {
        id: displayDeepSeekValue(item.id, 80) || `item-${index + 1}`,
        title,
        meta: displayDeepSeekValue(item.meta ?? item.value ?? item.description, 160),
      },
    ];
  });
  return items.length ? items.slice(0, 80) : undefined;
}

function normalizeDeepSeekSearchResults(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const results = value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const title = displayDeepSeekValue(item.title, 160);
    const url = displayDeepSeekValue(item.url ?? item.displayUrl, 240);
    const snippet = displayDeepSeekValue(item.snippet ?? item.text ?? item.body, 500);
    return title && url && snippet ? [{ title, url, snippet }] : [];
  });
  return results.length ? results.slice(0, 80) : undefined;
}

function displayDeepSeekValue(value: unknown, maxLength: number) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).slice(0, maxLength);
  }
  if (!isRecord(value)) return '';
  const label = value.label ?? value.title ?? value.name ?? value.text ?? value.value ?? value.id;
  return typeof label === 'string' || typeof label === 'number' || typeof label === 'boolean'
    ? String(label).slice(0, maxLength)
    : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function readDeepSeekConfig() {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return {
    enabled: env.VITE_VIBEOS_PROVIDER === 'deepseek',
    model: env.VITE_DEEPSEEK_MODEL || defaultDeepSeekModel,
  };
}

async function requestDeepSeekContent(
  intent: LaunchIntent,
  meta: GenerationSessionMeta,
  signal: AbortSignal,
  onJsonObject?: (content: string) => void,
) {
  const request = buildDeepSeekChatRequest(intent, meta);
  const response = await fetch(request.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal,
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed with status ${response.status}.`);
  }

  if (request.body.stream && response.body) {
    return readDeepSeekStream(response.body, onJsonObject);
  }

  const text = await response.text();
  if (request.body.stream) {
    const streamedContent = extractSseContent(text);
    if (streamedContent) return streamedContent;
  }

  return extractChatCompletionContent(text);
}

async function readDeepSeekStream(body: ReadableStream<Uint8Array>, onJsonObject?: (content: string) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let content = '';
  let emittedLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
    const lines = sseBuffer.split(/\r?\n/);
    sseBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const delta = extractSseLineContent(line);
      if (!delta) continue;
      content += delta;
      let completeJson = latestCompleteJsonObject(content.slice(emittedLength));
      while (completeJson) {
        emittedLength += completeJson.end;
        onJsonObject?.(completeJson.raw);
        completeJson = latestCompleteJsonObject(content.slice(emittedLength));
      }
    }
  }

  content += decoder.decode();
  let tailJson = latestCompleteJsonObject(content.slice(emittedLength));
  while (tailJson) {
    emittedLength += tailJson.end;
    onJsonObject?.(tailJson.raw);
    tailJson = latestCompleteJsonObject(content.slice(emittedLength));
  }
  return content.trim();
}

function extractSseContent(text: string) {
  let content = '';
  for (const line of text.split(/\r?\n/)) {
    content += extractSseLineContent(line);
  }
  return content.trim();
}

function extractSseLineContent(line: string) {
  if (!line.startsWith('data:')) return '';
  const data = line.slice(5).trim();
  if (!data || data === '[DONE]') return '';
  try {
    const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }> };
    return parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? '';
  } catch {
    return '';
  }
}

function extractChatCompletionContent(text: string) {
  try {
    const parsed = JSON.parse(text) as { choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }> };
    return parsed.choices?.[0]?.message?.content ?? parsed.choices?.[0]?.delta?.content ?? text;
  } catch {
    return text;
  }
}

function deepSeekFailureRecoveryStream(sessionId: string, streamId: string, baseRevision: number, message: string): PatchEnvelope[] {
  const errorEnvelope: PatchEnvelope = {
    protocolVersion: 1,
    sessionId,
    streamId,
    seq: baseRevision + 1,
    baseRevision,
    resultRevision: baseRevision + 1,
    kind: 'error',
    payload: {
      message: sanitizeProviderMessage(message),
    },
  };

  const recoveryOps: PatchOperation[] = [
    {
      op: 'createBlock',
      block: {
        id: 'fallback-actions',
        type: 'panel',
        props: {
          title: 'Offline Fallback',
          text: 'The provider stream stopped. The last valid UI stayed visible, and these recovery actions stay local.',
          buttons: ['Retry', 'Continue', 'Regenerate', 'Make More Realistic'],
        },
        children: [],
        styleTokens: ['win98-panel', 'warning'],
      },
    },
    { op: 'insertBlock', parentId: 'root', childId: 'fallback-actions' },
    {
      op: 'registerEventIntent',
      intent: {
        id: 'fallback-action',
        blockId: 'fallback-actions',
        eventType: 'click',
        description: 'Handle a provider fallback action locally.',
      },
    },
    { op: 'setStage', stage: 'stale' },
    { op: 'setStatusText', text: 'Stale offline fallback. Provider details are hidden.' },
  ];

  return [
    errorEnvelope,
    {
      protocolVersion: 1,
      sessionId,
      streamId,
      seq: baseRevision + 2,
      baseRevision: baseRevision + 1,
      resultRevision: baseRevision + 2,
      kind: 'transaction',
      payload: {
        transactionId: `${sessionId}-deepseek-fallback-actions`,
        ops: recoveryOps,
      },
    },
  ];
}

function sanitizeProviderMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('configured') || lower.includes('api key') || lower.includes('token') || lower.includes('bearer')) {
    return 'Provider is unavailable in offline-simulated mode.';
  }
  return 'Provider stream failed. Showing the last valid simulated surface.';
}

function replayAcceptedEnvelopes(document: GeneratedDocument | undefined, envelopes: PatchEnvelope[]) {
  if (!document) return undefined;
  return envelopes.reduce((current, envelope) => {
    const next = applyPatchEnvelope(current, envelope);
    return next === current ? current : next;
  }, document);
}

function latestCompleteJsonObject(value: string) {
  const start = value.indexOf('{');
  if (start < 0) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      return {
        raw: value.slice(start, index + 1),
        end: index + 1,
      };
    }
  }

  return undefined;
}
