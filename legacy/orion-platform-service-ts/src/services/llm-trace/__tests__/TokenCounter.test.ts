/**
 * TokenCounter Tests with tiktoken integration
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TokenCounter, tokenCounter } from '../TokenCounter';

describe('TokenCounter', () => {
  let counter: TokenCounter;

  beforeAll(() => {
    counter = new TokenCounter();
  });

  afterAll(() => {
    counter.dispose();
  });

  describe('countTokens', () => {
    it('should count English tokens accurately', () => {
      const text = 'Hello, world! This is a test.';
      const tokens = counter.countTokens(text);
      // tiktoken should give ~7-8 tokens for this text
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(20);
    });

    it('should count Chinese tokens accurately', () => {
      const text = '你好世界，这是一个测试。';
      const tokens = counter.countTokens(text);
      // Chinese text: ~12-15 chars = ~12-15 tokens with tiktoken
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(30);
    });

    it('should count mixed Chinese/English tokens', () => {
      const text = 'Hello你好World世界';
      const tokens = counter.countTokens(text);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(20);
    });

    it('should return 0 for empty text', () => {
      expect(counter.countTokens('')).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(counter.countTokens(null as any)).toBe(0);
      expect(counter.countTokens(undefined as any)).toBe(0);
    });

    it('should use model-specific encoding', () => {
      const text = 'Test text for encoding';
      const gpt4Tokens = counter.countTokens(text, 'gpt-4');
      const gpt4oTokens = counter.countTokens(text, 'gpt-4o');
      // Different encodings may give slightly different results
      expect(gpt4Tokens).toBeGreaterThan(0);
      expect(gpt4oTokens).toBeGreaterThan(0);
    });
  });

  describe('estimateTokensFallback', () => {
    it('should estimate Chinese tokens with ~1.0 chars/token', () => {
      const text = '你好世界';
      const estimate = counter.estimateTokensFallback(text);
      // 4 Chinese chars = ~4 tokens
      expect(estimate).toBeGreaterThanOrEqual(4);
    });

    it('should estimate English tokens with ~4 chars/token', () => {
      const text = 'Hello';
      const estimate = counter.estimateTokensFallback(text);
      // 5 English chars = ~1-2 tokens
      expect(estimate).toBeGreaterThanOrEqual(1);
    });
  });

  describe('countFromResponse', () => {
    it('should extract tokens from API response', () => {
      const response = {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };
      const usage = counter.countFromResponse(response);
      expect(usage.inputTokens).toBe(100);
      expect(usage.outputTokens).toBe(50);
      expect(usage.totalTokens).toBe(150);
    });

    it('should calculate total_tokens if missing', () => {
      const response = {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
        },
      };
      const usage = counter.countFromResponse(response);
      expect(usage.totalTokens).toBe(150);
    });

    it('should return zeros for missing usage', () => {
      const response = {};
      const usage = counter.countFromResponse(response);
      expect(usage.inputTokens).toBe(0);
      expect(usage.outputTokens).toBe(0);
      expect(usage.totalTokens).toBe(0);
    });
  });

  describe('countTokensForRequest', () => {
    it('should count tokens for prompt and expected output', () => {
      const prompt = 'What is the capital of France?';
      const usage = counter.countTokensForRequest(prompt, 20);
      expect(usage.inputTokens).toBeGreaterThan(0);
      expect(usage.outputTokens).toBeGreaterThan(0);
      expect(usage.totalTokens).toBe(usage.inputTokens + usage.outputTokens);
    });

    it('should only count input tokens without expected output', () => {
      const prompt = 'What is the capital of France?';
      const usage = counter.countTokensForRequest(prompt);
      expect(usage.inputTokens).toBeGreaterThan(0);
      expect(usage.outputTokens).toBe(0);
      expect(usage.totalTokens).toBe(usage.inputTokens);
    });
  });

  describe('countMessagesTokens', () => {
    it('should count tokens for chat messages', () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      const tokens = counter.countMessagesTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should include role overhead', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const tokens = counter.countMessagesTokens(messages);
      // Should include role tokens + content tokens + overhead
      expect(tokens).toBeGreaterThan(5);
    });
  });

  describe('getEncodingForModel', () => {
    it('should return cl100k_base for GPT-4', () => {
      expect(counter.getEncodingForModel('gpt-4')).toBe('cl100k_base');
    });

    it('should return o200k_base for GPT-4o', () => {
      expect(counter.getEncodingForModel('gpt-4o')).toBe('o200k_base');
    });

    it('should return cl100k_base for unknown models', () => {
      expect(counter.getEncodingForModel('unknown-model')).toBe('cl100k_base');
    });
  });

  describe('singleton', () => {
    it('should export a usable singleton', () => {
      const tokens = tokenCounter.countTokens('Test singleton');
      expect(tokens).toBeGreaterThan(0);
    });
  });
});