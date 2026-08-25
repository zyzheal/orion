import { describe, it, expect } from 'vitest';
import { OrionError, ErrorCode, ErrorSeverity, classifyError } from '../errors';

describe('OrionError', () => {
  it('should create error with all fields', () => {
    const err = new OrionError(ErrorCode.UNAUTHORIZED, 'Unauthorized', {
      status: 401,
      requestId: 'req-123',
      severity: ErrorSeverity.FATAL,
    });

    expect(err.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(err.message).toBe('Unauthorized');
    expect(err.status).toBe(401);
    expect(err.requestId).toBe('req-123');
    expect(err.severity).toBe(ErrorSeverity.FATAL);
    expect(err.name).toBe('OrionError');
  });

  it('should correctly identify retryable errors', () => {
    expect(new OrionError(ErrorCode.TIMEOUT, 'Timeout').isRetryable).toBe(true);
    expect(new OrionError(ErrorCode.UNAVAILABLE, 'Unavailable').isRetryable).toBe(true);
    expect(new OrionError(ErrorCode.RATE_LIMITED, 'Rate limited').isRetryable).toBe(true);
    expect(new OrionError(ErrorCode.NETWORK, 'Network').isRetryable).toBe(true);
    expect(new OrionError(ErrorCode.BAD_GATEWAY, 'Bad gateway').isRetryable).toBe(true);
    expect(new OrionError(ErrorCode.UNAUTHORIZED, '401').isRetryable).toBe(false);
    expect(new OrionError(ErrorCode.NOT_FOUND, '404').isRetryable).toBe(false);
    expect(new OrionError(ErrorCode.VALIDATION, 'Validation').isRetryable).toBe(false);
  });

  it('should correctly classify shouldRedirectLogin', () => {
    expect(new OrionError(ErrorCode.UNAUTHORIZED, '401', { severity: ErrorSeverity.FATAL }).shouldRedirectLogin).toBe(true);
    expect(new OrionError(ErrorCode.TIMEOUT, 'Timeout', { severity: ErrorSeverity.ERROR }).shouldRedirectLogin).toBe(false);
  });

  it('should correctly classify shouldNotify', () => {
    expect(new OrionError(ErrorCode.INTERNAL, '500', { severity: ErrorSeverity.ERROR }).shouldNotify).toBe(true);
    expect(new OrionError(ErrorCode.ABORTED, 'Aborted', { severity: ErrorSeverity.SILENT }).shouldNotify).toBe(false);
  });

  it('should serialize to JSON', () => {
    const err = new OrionError(ErrorCode.TIMEOUT, 'Timeout', { status: 408 });
    const json = err.toJSON();
    expect(json).toMatchObject({
      name: 'OrionError',
      code: ErrorCode.TIMEOUT,
      message: 'Timeout',
      status: 408,
      isRetryable: true,
    });
  });
});

describe('classifyError', () => {
  it.each([
    [401, ErrorCode.UNAUTHORIZED],
    [403, ErrorCode.FORBIDDEN],
    [404, ErrorCode.NOT_FOUND],
    [409, ErrorCode.CONFLICT],
    [400, ErrorCode.VALIDATION],
    [422, ErrorCode.VALIDATION],
    [429, ErrorCode.RATE_LIMITED],
    [502, ErrorCode.BAD_GATEWAY],
    [503, ErrorCode.UNAVAILABLE],
    [500, ErrorCode.INTERNAL],
    [501, ErrorCode.INTERNAL],
  ])('should classify status %d as %s', (status, expected) => {
    expect(classifyError(status)).toBe(expected);
  });
});
