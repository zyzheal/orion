/**
 * Token Counter - Token 计数器
 *
 * 功能：
 * 1. 精确计算 Token 数量（使用 tiktoken）
 * 2. 从 API 响应中提取实际 Token 数量
 * 3. 支持多种模型编码（cl100k_base, o200k_base）
 *
 * 编码映射：
 * - cl100k_base: GPT-4, GPT-3.5-turbo, text-embedding-ada-002
 * - o200k_base: GPT-4o, GPT-4o-mini
 */

import { createLogger } from '../../utils/logger';
import { Tiktoken, encoding_for_model, get_encoding } from 'tiktoken';

const logger = createLogger('TokenCounter');

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface APIResponse {
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens?: number;
  };
}

// Model encoding mapping
const MODEL_ENCODINGS: Record<string, string> = {
  'gpt-4': 'cl100k_base',
  'gpt-4-turbo': 'cl100k_base',
  'gpt-4o': 'o200k_base',
  'gpt-4o-mini': 'o200k_base',
  'gpt-3.5-turbo': 'cl100k_base',
  'claude-3-opus': 'cl100k_base',
  'claude-3-sonnet': 'cl100k_base',
  'claude-3-haiku': 'cl100k_base',
  'qwen-turbo': 'cl100k_base',
  'qwen-plus': 'cl100k_base',
  'deepseek-chat': 'cl100k_base',
  'deepseek-coder': 'cl100k_base',
};

// Default encoding for unknown models
const DEFAULT_ENCODING = 'cl100k_base';

// Encoding cache to avoid repeated initialization
const encodingCache: Map<string, Tiktoken> = new Map();

export class TokenCounter {
  private getEncoding(modelId?: string): Tiktoken {
    const encodingName = modelId ? MODEL_ENCODINGS[modelId] || DEFAULT_ENCODING : DEFAULT_ENCODING;

    if (!encodingCache.has(encodingName)) {
      const encoding = get_encoding(encodingName as any);
      encodingCache.set(encodingName, encoding);
      logger.debug(`[TokenCounter] Initialized encoding: ${encodingName}`);
    }

    return encodingCache.get(encodingName)!;
  }

  /**
   * Count tokens exactly using tiktoken
   * @param text - Text to count tokens for
   * @param modelId - Model ID for encoding selection (optional)
   */
  countTokens(text: string, modelId?: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    try {
      const encoding = this.getEncoding(modelId);
      const tokens = encoding.encode(text);
      return tokens.length;
    } catch (error) {
      logger.warn(`[TokenCounter] tiktoken error, falling back to estimation: ${error}`);
      return this.estimateTokensFallback(text);
    }
  }

  /**
   * Fallback estimation when tiktoken fails
   * Uses simple heuristic: ~4 characters per token for English, ~1.0 for Chinese
   */
  estimateTokensFallback(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    // Count Chinese characters (CJK Unified Ideographs)
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishChars = text.length - chineseChars;

    // Estimate: Chinese ~1.0-1.2 chars/token (tiktoken accurate), English ~4 chars/token
    const chineseTokens = Math.ceil(chineseChars / 1.0);
    const englishTokens = Math.ceil(englishChars / 4);

    return chineseTokens + englishTokens;
  }

  /**
   * Legacy method - now uses tiktoken by default
   * @deprecated Use countTokens instead for accurate counting
   */
  estimateTokens(text: string): number {
    return this.countTokens(text);
  }

  /**
   * Count tokens from actual API response (if available)
   */
  countFromResponse(response: APIResponse): TokenUsage {
    if (response.usage) {
      return {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens || response.usage.prompt_tokens + response.usage.completion_tokens,
      };
    }

    logger.warn('[TokenCounter] No usage data in API response');
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }

  /**
   * Count tokens for prompt and expected output
   */
  countTokensForRequest(prompt: string, expectedOutputLength?: number, modelId?: string): TokenUsage {
    const inputTokens = this.countTokens(prompt, modelId);
    const outputTokens = expectedOutputLength
      ? this.countTokens('x'.repeat(expectedOutputLength), modelId)
      : 0;

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    };
  }

  /**
   * Count tokens in an array of messages (for chat models)
   */
  countMessagesTokens(messages: Array<{ role: string; content: string }>, modelId?: string): number {
    let totalTokens = 0;

    for (const message of messages) {
      // Add tokens for role (typically 1-4 tokens depending on model)
      totalTokens += this.countTokens(message.role, modelId);
      // Add tokens for content
      totalTokens += this.countTokens(message.content, modelId);
      // Add overhead for message formatting
      totalTokens += 4; // Approximate overhead per message
    }

    // Add tokens for message formatting overhead
    totalTokens += 3; // Prime tokens for chat format

    return totalTokens;
  }

  /**
   * Get encoding name for a model
   */
  getEncodingForModel(modelId: string): string {
    return MODEL_ENCODINGS[modelId] || DEFAULT_ENCODING;
  }

  /**
   * Free all cached encodings (cleanup)
   */
  dispose(): void {
    for (const [name, encoding] of encodingCache) {
      encoding.free();
      logger.debug(`[TokenCounter] Freed encoding: ${name}`);
    }
    encodingCache.clear();
  }
}

// Export singleton for convenience
export const tokenCounter = new TokenCounter();