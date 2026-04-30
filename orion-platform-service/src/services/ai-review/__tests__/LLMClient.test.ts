/**
 * LLMClient 单元测试
 */

import { OpenAIClient, AnthropicClient, createLLMClient, MockLLMClient } from '../LLMClient';

describe('OpenAIClient', () => {
  let client: OpenAIClient;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    client = new OpenAIClient({ provider: 'openai', apiKey: 'test-key' });
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => jest.restoreAllMocks());

  it('should parse OpenAI response into ReviewComment[]', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        choices: [{ message: { content: JSON.stringify([
          {
            ruleId: 'ai-generated',
            filePath: 'src/index.ts',
            lineNumber: 10,
            severity: 'warning',
            message: 'Unused variable',
            suggestion: 'Remove or use it',
          },
        ])}}],
      })),
    });
    const comments = await client.reviewDiff('diff content');
    expect(comments).toHaveLength(1);
    expect(comments[0].source).toBe('ai');
    expect(comments[0].filePath).toBe('src/index.ts');
  });

  it('should parse { comments: [...] } format', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          comments: [
            { ruleId: 'ai-generated', filePath: 'test.ts', lineNumber: 5, severity: 'info', message: 'Test' },
          ],
        })}}],
      })),
    });
    const comments = await client.reviewDiff('diff');
    expect(comments).toHaveLength(1);
    expect(comments[0].source).toBe('ai');
  });

  it('should return empty array on API failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const comments = await client.reviewDiff('diff content');
    expect(comments).toEqual([]);
  });

  it('should return empty array on timeout', async () => {
    mockFetch.mockRejectedValue(new Error('timeout'));
    const comments = await client.reviewDiff('diff content');
    expect(comments).toEqual([]);
  });

  it('should return empty array on invalid JSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('not json'),
    });
    const comments = await client.reviewDiff('diff');
    expect(comments).toEqual([]);
  });
});

describe('AnthropicClient', () => {
  let client: AnthropicClient;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    client = new AnthropicClient({ provider: 'anthropic', apiKey: 'test-key' });
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => jest.restoreAllMocks());

  it('should parse Anthropic response into ReviewComment[]', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        content: [{ text: JSON.stringify([
          { ruleId: 'ai-generated', filePath: 'src/app.ts', lineNumber: 5, severity: 'critical', message: 'SQL injection', suggestion: 'Use parameterized query' },
        ]) }],
      })),
    });
    const comments = await client.reviewDiff('diff content');
    expect(comments).toHaveLength(1);
    expect(comments[0].source).toBe('ai');
  });

  it('should extract JSON array from text', async () => {
    const jsonContent = '[{"ruleId":"ai-generated","filePath":"test.ts","lineNumber":1,"severity":"info","message":"Test"}]';
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        content: [{ text: 'Here are the comments:\n' + jsonContent + '\nHope this helps!' }],
      })),
    });
    const comments = await client.reviewDiff('diff');
    expect(comments).toHaveLength(1);
  });

  it('should return empty array on failure', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));
    const comments = await client.reviewDiff('diff');
    expect(comments).toEqual([]);
  });
});

describe('createLLMClient', () => {
  it('should create MockLLMClient by default', () => {
    const client = createLLMClient();
    expect(client).toBeInstanceOf(MockLLMClient);
  });

  it('should create OpenAIClient when provider is openai', () => {
    const client = createLLMClient({ provider: 'openai', apiKey: 'key' });
    expect(client).toBeInstanceOf(OpenAIClient);
  });

  it('should create AnthropicClient when provider is anthropic', () => {
    const client = createLLMClient({ provider: 'anthropic', apiKey: 'key' });
    expect(client).toBeInstanceOf(AnthropicClient);
  });
});

describe('MockLLMClient', () => {
  it('should always return empty array', async () => {
    const client = new MockLLMClient();
    const comments = await client.reviewDiff('any diff');
    expect(comments).toEqual([]);
  });
});
