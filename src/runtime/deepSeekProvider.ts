import { createAsyncProviderSession, type RuntimeProvider } from './providers';
import { adaptProviderJsonOutput } from './providerOutputAdapter';
import type { GenerationSessionMeta, LaunchIntent, PatchEnvelope } from './types';

const deepSeekBaseUrl = 'https://api.deepseek.com';
const defaultDeepSeekModel = 'deepseek-chat';

export const deepSeekProvider: RuntimeProvider = {
  id: 'deepseek-json-adapter',
  source: 'deepseek',
  start(intent, meta) {
    const configured = readDeepSeekConfig();
    const streamId = `${meta.sessionId}-deepseek-stream`;

    return createAsyncProviderSession({
      id: `${meta.sessionId}-deepseek-provider`,
      providerId: 'deepseek-json-adapter',
      source: 'deepseek',
      streamId,
      request: async () => {
        if (!configured.enabled || !configured.apiKey) {
          throw new Error('DeepSeek provider is not configured for this offline prototype.');
        }

        const content = await requestDeepSeekContent(intent, meta, configured.apiKey);
        const adapted = adaptDeepSeekContent(content, meta);
        if (adapted.kind === 'rejected') throw new Error(adapted.reason);
        return adapted.envelopes;
      },
      failureEnvelope: (message) => deepSeekFailureEnvelope(meta.sessionId, streamId, meta.baseRevision, message),
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

export function adaptDeepSeekContent(content: string, meta: GenerationSessionMeta) {
  return adaptProviderJsonOutput({
    raw: content,
    sessionId: meta.sessionId,
    streamId: `${meta.sessionId}-deepseek-stream`,
    baseRevision: meta.baseRevision,
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

async function requestDeepSeekContent(intent: LaunchIntent, meta: GenerationSessionMeta, apiKey: string) {
  const request = buildDeepSeekChatRequest(intent, meta);
  const response = await fetch(request.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed with status ${response.status}.`);
  }

  const text = await response.text();
  if (request.body.stream) {
    const streamedContent = extractSseContent(text);
    if (streamedContent) return streamedContent;
  }

  return extractChatCompletionContent(text);
}

function extractSseContent(text: string) {
  let content = '';
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    try {
      const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }> };
      content += parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? '';
    } catch {
      // Ignore malformed stream fragments; final adapter validation decides safety.
    }
  }
  return content.trim();
}

function extractChatCompletionContent(text: string) {
  try {
    const parsed = JSON.parse(text) as { choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }> };
    return parsed.choices?.[0]?.message?.content ?? parsed.choices?.[0]?.delta?.content ?? text;
  } catch {
    return text;
  }
}

function deepSeekFailureEnvelope(sessionId: string, streamId: string, baseRevision: number, message: string): PatchEnvelope {
  return {
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
}

function sanitizeProviderMessage(message: string) {
  return message.replace(/api key|bearer|token|deepseek/gi, 'provider').slice(0, 180);
}
