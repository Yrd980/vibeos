import { z } from 'zod';
import type { GenerateUiInput, GenerateUiResult, LlmAdapter } from './types';
import {
  HALLUCINATED_APP_SYSTEM_PROMPT,
  buildAppUpdatePrompt,
  buildRepairPrompt
} from './promptTemplates';

const GenerateUiResultSchema = z.object({
  title: z.string().min(1).max(120),
  html: z.string().max(60000),
  state: z.unknown(),
  narration: z.string().nullable().optional()
});
const REQUEST_TIMEOUT_MS = 12000;

interface DeepSeekChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export class DeepSeekLlmAdapter implements LlmAdapter {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.apiKey = env.DEEPSEEK_API_KEY ?? '';
    this.baseUrl = (env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, '');
    this.model = env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash';

    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY is required when VIBEOS_LLM_PROVIDER=hybrid or deepseek. Use VIBEOS_LLM_PROVIDER=mock to run without a key.');
    }
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
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
    html: result.data.html,
    state: result.data.state,
    narration: result.data.narration ?? null
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
    html: `
      <div class="v-app">
        <div class="v-card">
          <h1>Provider unavailable</h1>
          <p>The DeepSeek adapter could not produce a valid UI frame.</p>
          <p class="v-muted">${safeMessage}</p>
        </div>
      </div>`
  };
}
