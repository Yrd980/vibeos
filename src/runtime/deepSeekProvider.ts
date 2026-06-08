import { createAsyncProviderSession, type RuntimeProvider } from './providers';
import { adaptProviderJsonOutput } from './providerOutputAdapter';
import { applyPatchEnvelope } from './generatedRuntime';
import type { GeneratedDocument, GenerationSessionMeta, LaunchIntent, PatchEnvelope, PatchOperation } from './types';

const deepSeekBaseUrl = 'https://api.deepseek.com';
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
        if (!configured.enabled || !configured.apiKey) {
          throw new Error('DeepSeek provider is not configured for this offline prototype.');
        }

        let streamedAny = false;
        const content = await requestDeepSeekContent(intent, meta, configured.apiKey, signal, (chunk) => {
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
      stream: true,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Return only VibeOS patch-protocol JSON. Never return HTML, CSS, scripts, iframes, external resources, or executable code.',
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
  return adaptProviderJsonOutput({
    raw: content,
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

function readDeepSeekConfig() {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return {
    enabled: env.VITE_VIBEOS_PROVIDER === 'deepseek',
    apiKey: env.VITE_DEEPSEEK_API_KEY,
    model: env.VITE_DEEPSEEK_MODEL || defaultDeepSeekModel,
  };
}

async function requestDeepSeekContent(
  intent: LaunchIntent,
  meta: GenerationSessionMeta,
  apiKey: string,
  signal: AbortSignal,
  onJsonObject?: (content: string) => void,
) {
  const request = buildDeepSeekChatRequest(intent, meta);
  const response = await fetch(request.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
