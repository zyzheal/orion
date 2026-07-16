/**
 * ApiKeyServiceError Tests
 *
 * 覆盖: ApiKeyServiceError 类的属性和继承关系
 */

import { ApiKeyServiceError } from '../ApiKeyService';

describe('ApiKeyServiceError', () => {
  it('should create error with message and code', () => {
    const error = new ApiKeyServiceError('Invalid input', 'INVALID_INPUT');
    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe('INVALID_INPUT');
  });

  it('should have name set to ApiKeyServiceError', () => {
    const error = new ApiKeyServiceError('test', 'TEST_CODE');
    expect(error.name).toBe('ApiKeyServiceError');
  });

  it('should be an instance of Error', () => {
    const error = new ApiKeyServiceError('test', 'TEST_CODE');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiKeyServiceError);
  });

  it('should preserve stack trace', () => {
    const error = new ApiKeyServiceError('test', 'TEST_CODE');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('ApiKeyServiceError');
  });
});
