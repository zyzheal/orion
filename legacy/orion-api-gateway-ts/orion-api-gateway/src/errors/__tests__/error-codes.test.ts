/**
 * 错误码单元测试
 */

import {
  ErrorCodes,
  ERROR_STATUS_MAP,
  ERROR_MESSAGE_MAP,
  ErrorFactory,
  AppError,
  tokenExpired,
  tokenInvalid,
  tokenMissing,
  permissionDenied,
  validationError,
  requiredFieldMissing,
  resourceNotFound,
  resourceExists,
  databaseError,
  cacheError,
} from '../error-codes';
import { ErrorCategory } from '../base-error';

describe('ErrorCodes', () => {
  it('should have correct error code format', () => {
    // All error codes should be 5 digits
    Object.values(ErrorCodes).forEach((code) => {
      expect(code).toMatch(/^\d{5}$/);
    });
  });

  it('should have correct category prefixes', () => {
    // Platform errors start with 1
    expect(ErrorCodes.GATEWAY_UNAVAILABLE.startsWith('1')).toBe(true);
    expect(ErrorCodes.GATEWAY_RATE_LIMIT_EXCEEDED.startsWith('1')).toBe(true);

    // Auth errors start with 2
    expect(ErrorCodes.TOKEN_EXPIRED.startsWith('2')).toBe(true);
    expect(ErrorCodes.PERMISSION_DENIED.startsWith('2')).toBe(true);

    // Business errors start with 3
    expect(ErrorCodes.VALIDATION_ERROR.startsWith('3')).toBe(true);
    expect(ErrorCodes.RESOURCE_NOT_FOUND.startsWith('3')).toBe(true);

    // External errors start with 4
    expect(ErrorCodes.DATABASE_ERROR.startsWith('4')).toBe(true);
    expect(ErrorCodes.HTTP_TIMEOUT.startsWith('4')).toBe(true);
  });
});

describe('ERROR_STATUS_MAP', () => {
  it('should have status mapping for all error codes', () => {
    Object.values(ErrorCodes).forEach((code) => {
      expect(ERROR_STATUS_MAP[code]).toBeDefined();
      expect(ERROR_STATUS_MAP[code]).toBeGreaterThan(0);
    });
  });

  it('should have correct HTTP status codes', () => {
    expect(ERROR_STATUS_MAP[ErrorCodes.TOKEN_EXPIRED]).toBe(401);
    expect(ERROR_STATUS_MAP[ErrorCodes.PERMISSION_DENIED]).toBe(403);
    expect(ERROR_STATUS_MAP[ErrorCodes.VALIDATION_ERROR]).toBe(400);
    expect(ERROR_STATUS_MAP[ErrorCodes.RESOURCE_NOT_FOUND]).toBe(404);
    expect(ERROR_STATUS_MAP[ErrorCodes.DATABASE_ERROR]).toBe(500);
    expect(ERROR_STATUS_MAP[ErrorCodes.RATE_LIMIT_EXCEEDED]).toBe(429);
  });
});

describe('ERROR_MESSAGE_MAP', () => {
  it('should have message mapping for all error codes', () => {
    Object.values(ErrorCodes).forEach((code) => {
      expect(ERROR_MESSAGE_MAP[code]).toBeDefined();
      expect(ERROR_MESSAGE_MAP[code]).toBeTruthy();
    });
  });

  it('should have meaningful messages', () => {
    expect(ERROR_MESSAGE_MAP[ErrorCodes.TOKEN_EXPIRED]).toContain('expired');
    expect(ERROR_MESSAGE_MAP[ErrorCodes.VALIDATION_ERROR]).toContain('Validation');
    expect(ERROR_MESSAGE_MAP[ErrorCodes.RESOURCE_NOT_FOUND]).toContain('not found');
  });
});

describe('ErrorFactory', () => {
  describe('create', () => {
    it('should create AppError with correct properties', () => {
      const error = ErrorFactory.create(ErrorCodes.VALIDATION_ERROR, {
        field: 'email',
        reason: 'invalid format',
      });

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'email', reason: 'invalid format' });
    });

    it('should use default message when code not in map', () => {
      const error = ErrorFactory.create('99999' as any);
      expect(error.message).toBe('Unknown error');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('category-specific methods', () => {
    it('should create auth errors', () => {
      const error = ErrorFactory.auth(ErrorCodes.TOKEN_EXPIRED);
      expect(error.code).toBe(ErrorCodes.TOKEN_EXPIRED);
      expect(error.statusCode).toBe(401);
    });

    it('should create business errors', () => {
      const error = ErrorFactory.business(ErrorCodes.RESOURCE_NOT_FOUND);
      expect(error.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      expect(error.statusCode).toBe(404);
    });

    it('should create external errors', () => {
      const error = ErrorFactory.external(ErrorCodes.DATABASE_ERROR);
      expect(error.code).toBe(ErrorCodes.DATABASE_ERROR);
      expect(error.statusCode).toBe(500);
    });
  });
});

describe('AppError', () => {
  it('should extend BaseError', () => {
    const error = new AppError('30101', 'Test error', 400, { key: 'value' });
    expect(error.name).toBe('AppError');
    expect(error.code).toBe('30101');
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual({ key: 'value' });
  });

  it('should have correct category', () => {
    const error = new AppError('30101', 'Test', 400);
    expect(error.category).toBe(ErrorCategory.BUSINESS);

    const authError = new AppError('20101', 'Test', 401);
    expect(authError.category).toBe(ErrorCategory.AUTH);
  });

  describe('toJSON', () => {
    it('should return proper error response format', () => {
      const error = new AppError('30101', 'Validation failed', 400, {
        field: 'email',
      });
      const json = error.toJSON('req-123', '/api/users', 'POST');

      expect(json).toEqual({
        error: 'AppError',
        message: 'Validation failed',
        code: '30101',
        details: { field: 'email' },
        requestId: 'req-123',
        timestamp: expect.any(String),
        path: '/api/users',
        method: 'POST',
      });
    });
  });

  describe('withContext', () => {
    it('should add request context to metadata', () => {
      const error = new AppError('30101', 'Test', 400);
      error.withContext('req-123', '/api/test', 'GET');

      expect(error.metadata.requestId).toBe('req-123');
      expect(error.metadata.path).toBe('/api/test');
      expect(error.metadata.method).toBe('GET');
    });

    it('should return this for chaining', () => {
      const error = new AppError('30101', 'Test', 400);
      const result = error.withContext('req-123', '/api/test', 'GET');
      expect(result).toBe(error);
    });
  });
});

describe('Shortcut functions', () => {
  describe('Token errors', () => {
    it('should create tokenExpired error', () => {
      const error = tokenExpired('2026-04-11T10:00:00Z');
      expect(error.code).toBe(ErrorCodes.TOKEN_EXPIRED);
      expect(error.statusCode).toBe(401);
      expect(error.details?.expiredAt).toBe('2026-04-11T10:00:00Z');
    });

    it('should create tokenInvalid error', () => {
      const error = tokenInvalid('malformed');
      expect(error.code).toBe(ErrorCodes.TOKEN_INVALID);
      expect(error.details?.reason).toBe('malformed');
    });

    it('should create tokenMissing error', () => {
      const error = tokenMissing();
      expect(error.code).toBe(ErrorCodes.TOKEN_MISSING);
      expect(error.statusCode).toBe(401);
    });
  });

  describe('Permission errors', () => {
    it('should create permissionDenied error', () => {
      const error = permissionDenied('users', 'delete');
      expect(error.code).toBe(ErrorCodes.PERMISSION_DENIED);
      expect(error.statusCode).toBe(403);
      expect(error.details?.resource).toBe('users');
      expect(error.details?.action).toBe('delete');
    });
  });

  describe('Validation errors', () => {
    it('should create validationError', () => {
      const error = validationError('email', 'Invalid email format');
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.details?.field).toBe('email');
      expect(error.details?.reason).toBe('Invalid email format');
    });

    it('should create requiredFieldMissing', () => {
      const error = requiredFieldMissing('username');
      expect(error.code).toBe(ErrorCodes.REQUIRED_FIELD_MISSING);
      expect(error.details?.field).toBe('username');
    });
  });

  describe('Resource errors', () => {
    it('should create resourceNotFound', () => {
      const error = resourceNotFound('user', '123');
      expect(error.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      expect(error.statusCode).toBe(404);
      expect(error.details?.resourceType).toBe('user');
      expect(error.details?.id).toBe('123');
    });

    it('should create resourceExists', () => {
      const error = resourceExists('user', 'test@example.com');
      expect(error.code).toBe(ErrorCodes.RESOURCE_EXISTS);
      expect(error.details?.resourceType).toBe('user');
      expect(error.details?.identifier).toBe('test@example.com');
    });
  });

  describe('External service errors', () => {
    it('should create databaseError', () => {
      const error = databaseError('Connection refused', 'SELECT * FROM users');
      expect(error.code).toBe(ErrorCodes.DATABASE_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.details?.message).toBe('Connection refused');
      expect(error.details?.query).toBe('SELECT * FROM users');
    });

    it('should create cacheError', () => {
      const error = cacheError('Key not found', 'user:123');
      expect(error.code).toBe(ErrorCodes.CACHE_ERROR);
      expect(error.details?.message).toBe('Key not found');
      expect(error.details?.key).toBe('user:123');
    });
  });
});
