/**
 * LLM Client for AI Code Review
 *
 * Supports OpenAI and Anthropic API calls with fallback to mock.
 * Falls back to empty array (rule-only review) when LLM is unavailable.
 */

import { ReviewComment } from './types';

export interface LLMClientConfig {
  provider: 'openai' | 'anthropic' | 'mock';
  apiKey?: string;
  model?: string;
  temperature?: number;
  timeout?: number;
}

export abstract class LLMClient {
  abstract reviewDiff(diff: string): Promise<ReviewComment[]>;
}

const SYSTEM_PROMPT = `You are a code review assistant. Analyze the provided git diff and return a JSON array of review comments. Each comment must have: ruleId (use "ai-generated"), filePath, lineNumber, severity (critical|warning|info|suggestion), message, suggestion, codeSnippet, source ("ai"). Only comment on actual issues, be concise. Return ONLY the JSON array, no markdown or explanation.`;

/**
 * OpenAI API client
 */
export class OpenAIClient extends LLMClient {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private timeout: number;

  constructor(config: LLMClientConfig) {
    super();
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-4o';
    this.temperature = config.temperature ?? 0.3;
    this.timeout = config.timeout || 30_000;
  }

  async reviewDiff(diff: string): Promise<ReviewComment[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Review this diff:\n\n${diff}` },
          ],
          temperature: this.temperature,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return [];
      const text = await response.text();
      const data = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return [];
      return this.parseComments(content);
    } catch {
      return [];
    }
  }

  private parseComments(text: string): ReviewComment[] {
    try {
      // Try direct JSON array parse
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map(c => ({ ...c, source: 'ai' as const, createdAt: new Date() }));
      }
      // Try { comments: [...] } format
      if (parsed.comments && Array.isArray(parsed.comments)) {
        return parsed.comments.map((c: any) => ({ ...c, source: 'ai' as const, createdAt: new Date() }));
      }
    } catch {
      // Try to extract JSON array from text
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0]);
          if (Array.isArray(parsed)) {
            return parsed.map(c => ({ ...c, source: 'ai' as const, createdAt: new Date() }));
          }
        } catch {
          // Ignore
        }
      }
    }
    return [];
  }
}

/**
 * Anthropic API client
 */
export class AnthropicClient extends LLMClient {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private timeout: number;

  constructor(config: LLMClientConfig) {
    super();
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'claude-sonnet-4-6';
    this.temperature = config.temperature ?? 0.3;
    this.timeout = config.timeout || 30_000;
  }

  async reviewDiff(diff: string): Promise<ReviewComment[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          temperature: this.temperature,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Review this diff:\n\n${diff}` }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return [];
      const text = await response.text();
      const data = JSON.parse(text) as { content?: { text?: string }[] };
      const content = data?.content?.[0]?.text;
      if (!content) return [];
      return this.parseComments(content);
    } catch {
      return [];
    }
  }

  private parseComments(text: string): ReviewComment[] {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map(c => ({ ...c, source: 'ai' as const, createdAt: new Date() }));
      }
    } catch {
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0]);
          if (Array.isArray(parsed)) {
            return parsed.map(c => ({ ...c, source: 'ai' as const, createdAt: new Date() }));
          }
        } catch {
          // Ignore
        }
      }
    }
    return [];
  }
}

/**
 * Mock LLM client (returns empty array, rule-only review)
 */
export class MockLLMClient extends LLMClient {
  async reviewDiff(_diff: string): Promise<ReviewComment[]> {
    return [];
  }
}

/**
 * Factory: create LLM client from config or environment
 */
export function createLLMClient(config?: Partial<LLMClientConfig>): LLMClient {
  const provider = config?.provider || (process.env.LLM_PROVIDER as 'openai' | 'anthropic' | 'mock') || 'mock';
  const llmConfig: LLMClientConfig = {
    provider,
    apiKey: config?.apiKey || process.env.LLM_API_KEY,
    model: config?.model || process.env.LLM_MODEL,
    temperature: config?.temperature ?? parseFloat(process.env.LLM_TEMPERATURE || '0.3'),
    timeout: config?.timeout ?? parseInt(process.env.LLM_TIMEOUT || '30000'),
  };

  switch (provider) {
    case 'openai':
      return new OpenAIClient(llmConfig);
    case 'anthropic':
      return new AnthropicClient(llmConfig);
    default:
      return new MockLLMClient();
  }
}
