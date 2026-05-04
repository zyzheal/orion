/**
 * Token Counter - Token 计数器
 *
 * 功能：
 * 1. 估算文本 Token 数量（中英文混合）
 * 2. 从 API 响应中提取实际 Token 数量
 *
 * Token 估算规则：
 * - 中文：约 1.5 字符/Token
 * - 英文：约 4 字符/Token
 */

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

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

export class TokenCounter {
  /**
   * Estimate token count for text (approximate)
   * Uses simple heuristic: ~4 characters per token for English, ~1.5 for Chinese
   */
  estimateTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    // Count Chinese characters (CJK Unified Ideographs)
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishChars = text.length - chineseChars;

    // Estimate: Chinese ~1.5 chars/token, English ~4 chars/token
    const chineseTokens = Math.ceil(chineseChars / 1.5);
    const englishTokens = Math.ceil(englishChars / 4);

    logger.debug(`[TokenCounter] Estimated tokens: ${chineseTokens + englishTokens} (Chinese: ${chineseTokens}, English: ${englishTokens})`);

    return chineseTokens + englishTokens;
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

    // Fallback to zeros when no usage data
    logger.warn('[TokenCounter] No usage data in API response');
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }

  /**
   * Estimate tokens for prompt and expected output
   */
  estimateTokensForRequest(prompt: string, expectedOutputLength?: number): TokenUsage {
    const inputTokens = this.estimateTokens(prompt);
    const outputTokens = expectedOutputLength ? this.estimateTokens('x'.repeat(expectedOutputLength)) : 0;

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    };
  }

  /**
   * Count tokens in an array of messages (for chat models)
   */
  countMessagesTokens(messages: Array<{ role: string; content: string }>): number {
    let totalTokens = 0;

    for (const message of messages) {
      // Add tokens for role (typically 1 token)
      totalTokens += 1;
      // Add tokens for content
      totalTokens += this.estimateTokens(message.content);
    }

    // Add tokens for message formatting overhead
    totalTokens += 3; // Approximate overhead for chat format

    return totalTokens;
  }
}