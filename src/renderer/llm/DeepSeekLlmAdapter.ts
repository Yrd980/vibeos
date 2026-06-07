import { z } from 'zod';
import type { GenerateUiInput, GenerateUiResult, LlmAdapter } from './types';
import {
  HALLUCINATED_APP_SYSTEM_PROMPT,
  buildAppUpdatePrompt,
  buildRepairPrompt
} from './promptTemplates';

const GeneratedUiBlockSchema = z.object({
  id: z.string().min(1).max(80),
  role: z.enum(['menubar', 'toolbar', 'sidebar', 'main', 'panel', 'status', 'dialog']),
  className: z.string().max(200).optional(),
  title: z.string().max(160).optional(),
  text: z.string().max(2000).optional(),
  items: z.array(z.string().max(400)).max(30).optional(),
  actions: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        label: z.string().min(1).max(120),
        value: z.string().max(240).optional(),
        variant: z.enum(['default', 'primary', 'danger']).optional()
      })
    )
    .max(20)
    .optional(),
  fields: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        label: z.string().min(1).max(120),
        value: z.string().max(10000),
        placeholder: z.string().max(240).optional(),
        multiline: z.boolean().optional()
      })
    )
    .max(12)
    .optional(),
  table: z
    .object({
      columns: z.array(z.string().max(80)).min(1).max(8),
      rows: z.array(z.array(z.string().max(240)).max(8)).max(30)
    })
    .optional()
});

const GenerateUiResultSchema = z.object({
  title: z.string().min(1).max(120),
  state: z.unknown(),
  narration: z.string().nullable().optional(),
  blocks: z.array(GeneratedUiBlockSchema).min(1).max(20)
});
const REQUEST_TIMEOUT_MS = 12000;
const DEEPSEEK_PROXY_BASE_URL = '/deepseek-api';

interface DeepSeekChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export class DeepSeekLlmAdapter implements LlmAdapter {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(env: ImportMetaEnv = import.meta.env) {
    this.apiKey = env.VITE_DEEPSEEK_API_KEY ?? '';
    this.model = env.VITE_DEEPSEEK_MODEL ?? 'deepseek-v4-flash';
  }

  async generateNextUi(input: GenerateUiInput): Promise<GenerateUiResult> {
    const messages = [
      { role: 'system' as const, content: HALLUCINATED_APP_SYSTEM_PROMPT },
      { role: 'user' as const, content: buildAppUpdatePrompt(input) }
    ];

    let content = '';
    try {
      content = await this.request(messages);
      return parseGenerateUiResult(content);
    } catch (error) {
      const firstError = error instanceof Error ? error.message : 'Unknown DeepSeek error';
      console.warn(`DeepSeek response parse failed: ${firstError}`);
      if (!content) {
        return safeErrorUi(input.appName, firstError);
      }
      try {
        const repairContent = await this.request([
          { role: 'system' as const, content: HALLUCINATED_APP_SYSTEM_PROMPT },
          { role: 'user' as const, content: buildRepairPrompt(content || firstError) }
        ]);
        return parseGenerateUiResult(repairContent);
      } catch (repairError) {
        const message = repairError instanceof Error ? repairError.message : 'Unknown repair error';
        console.warn(`DeepSeek repair failed: ${message}`);
        return safeErrorUi(input.appName, message);
      }
    }
  }

  private async request(messages: Array<{ role: 'system' | 'user'; content: string }>): Promise<string> {
    if (!this.apiKey) {
      throw new Error('VITE_DEEPSEEK_API_KEY is required when VITE_VIBEOS_LLM_PROVIDER=hybrid or deepseek. Use VITE_VIBEOS_LLM_PROVIDER=mock to run without a key.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(`${DEEPSEEK_PROXY_BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.4,
        response_format: { type: 'json_object' }
      })
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`DeepSeek request failed with ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as DeepSeekChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('DeepSeek returned no message content.');
    }
    return content;
  }
}

function parseGenerateUiResult(content: string): GenerateUiResult {
  const trimmed = stripMarkdownFences(content.trim());
  const parsed = JSON.parse(trimmed) as unknown;
  const result = GenerateUiResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return {
    title: result.data.title,
    state: result.data.state,
    narration: result.data.narration ?? null,
    blocks: result.data.blocks
  };
}

function stripMarkdownFences(content: string): string {
  const fence = content.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence ? fence[1] : content;
}

function safeErrorUi(appName: string, message: string): GenerateUiResult {
  const safeMessage = message.replace(/[<>&"']/g, '');
  return {
    title: `${appName} - Provider Error`,
    state: { error: safeMessage },
    narration: safeMessage,
    blocks: [
      {
        id: 'provider-error',
        role: 'main',
        className: 'v-app',
        title: 'Provider unavailable',
        text: `The DeepSeek adapter could not produce valid UI blocks. ${safeMessage}`
      }
    ]
  };
}
