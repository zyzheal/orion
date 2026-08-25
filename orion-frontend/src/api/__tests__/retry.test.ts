import { describe, it, expect, vi } from 'vitest';
import { OrionError, ErrorCode } from '../errors';
import { shouldRetry, getRetryDelay, withRetry } from '../retry';

describe('shouldRetry', () => {
  it('should return true for retryable OrionError codes', () => {
    expect(shouldRetry(new OrionError(ErrorCode.TIMEOUT, 'Timeout'))).toBe(true);
    expect(shouldRetry(new OrionError(ErrorCode.UNAVAILABLE, '503'))).toBe(true);
    expect(shouldRetry(new OrionError(ErrorCode.RATE_LIMITED, '429'))).toBe(true);
    expect(shouldRetry(new OrionError(ErrorCode.NETWORK, 'Network'))).toBe(true);
  });

  it('should return false for non-retryable errors', () => {
    expect(shouldRetry(new OrionError(ErrorCode.UNAUTHORIZED, '401'))).toBe(false);
    expect(shouldRetry(new OrionError(ErrorCode.NOT_FOUND, '404'))).toBe(false);
    expect(shouldRetry(new OrionError(ErrorCode.VALIDATION, '400'))).toBe(false);
  });

  it('should return true for errors with retryable HTTP status', () => {
    const err503 = Object.assign(new Error(''), { status: 503 });
    const err429 = Object.assign(new Error(''), { status: 429 });
    expect(shouldRetry(err503)).toBe(true);
    expect(shouldRetry(err429)).toBe(true);
  });

  it('should return true for axios-like errors with response.status', () => {
    const err503 = Object.assign(new Error(''), { response: { status: 503 } });
    const err408 = Object.assign(new Error(''), { response: { status: 408 } });
    expect(shouldRetry(err503)).toBe(true);
    expect(shouldRetry(err408)).toBe(true);
  });

  it('should return true for network error codes', () => {
    expect(shouldRetry(Object.assign(new Error(''), { code: 'ECONNABORTED' }))).toBe(true);
    expect(shouldRetry(Object.assign(new Error(''), { code: 'ERR_NETWORK' }))).toBe(true);
    expect(shouldRetry(Object.assign(new Error(''), { code: 'ERR_CONNECTION_REFUSED' }))).toBe(true);
  });

  it('should return false for errors with non-retryable status', () => {
    const err404 = Object.assign(new Error(''), { status: 404 });
    expect(shouldRetry(err404)).toBe(false);
  });

  it('should return false for errors without status or code', () => {
    expect(shouldRetry(new Error('generic'))).toBe(false);
  });
});

describe('getRetryDelay', () => {
  it('should apply exponential backoff', () => {
    const delay0 = getRetryDelay(0, { jitter: false, baseDelay: 100 });
    const delay1 = getRetryDelay(1, { jitter: false, baseDelay: 100 });
    const delay2 = getRetryDelay(2, { jitter: false, baseDelay: 100 });
    expect(delay0).toBe(100);
    expect(delay1).toBe(200);
    expect(delay2).toBe(400);
  });

  it('should respect maxDelay', () => {
    const delay = getRetryDelay(10, { jitter: false, baseDelay: 100, maxDelay: 500 });
    expect(delay).toBe(500);
  });

  it('should stay within [0, exponential] with jitter', () => {
    for (let i = 0; i < 100; i++) {
      const delay = getRetryDelay(2, { jitter: true, baseDelay: 100 });
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThan(400);
    }
  });
});

describe('withRetry', () => {
  it('should succeed on first attempt', async () => {
    const fn = vi.fn(() => Promise.resolve('ok'));
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable error and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new OrionError(ErrorCode.TIMEOUT, 'Timeout'))
      .mockRejectedValueOnce(new OrionError(ErrorCode.UNAVAILABLE, '503'))
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 1 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after exhausting retries', async () => {
    const fn = vi.fn(() => Promise.reject(new OrionError(ErrorCode.TIMEOUT, 'Timeout')));

    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 1 }))
      .rejects.toBeInstanceOf(OrionError);
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should NOT retry non-retryable errors', async () => {
    const fn = vi.fn(() => Promise.reject(new OrionError(ErrorCode.NOT_FOUND, '404')));

    await expect(withRetry(fn, { maxRetries: 3, baseDelay: 1 }))
      .rejects.toBeInstanceOf(OrionError);
    expect(fn).toHaveBeenCalledTimes(1); // no retry
  });

  it('should call onRetry callback', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new OrionError(ErrorCode.UNAVAILABLE, '503'))
      .mockResolvedValueOnce('ok');

    await withRetry(fn, { maxRetries: 3, baseDelay: 1, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 0);
  });
});
