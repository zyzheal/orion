/**
 * ProjectServiceError Tests
 *
 * 覆盖: ProjectServiceError 类的属性和继承关系
 */

import { ProjectServiceError } from '../ProjectService';

describe('ProjectServiceError', () => {
  it('should create error with message and code', () => {
    const error = new ProjectServiceError('Project not found', 'NOT_FOUND');
    expect(error.message).toBe('Project not found');
    expect(error.code).toBe('NOT_FOUND');
  });

  it('should have name set to ProjectServiceError', () => {
    const error = new ProjectServiceError('test', 'TEST_CODE');
    expect(error.name).toBe('ProjectServiceError');
  });

  it('should be an instance of Error', () => {
    const error = new ProjectServiceError('test', 'TEST_CODE');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ProjectServiceError);
  });

  it('should preserve stack trace', () => {
    const error = new ProjectServiceError('test', 'TEST_CODE');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('ProjectServiceError');
  });

  it('should support different error codes', () => {
    const notFound = new ProjectServiceError('Not found', 'NOT_FOUND');
    const invalidInput = new ProjectServiceError('Invalid input', 'INVALID_INPUT');
    const updateFailed = new ProjectServiceError('Update failed', 'UPDATE_FAILED');

    expect(notFound.code).toBe('NOT_FOUND');
    expect(invalidInput.code).toBe('INVALID_INPUT');
    expect(updateFailed.code).toBe('UPDATE_FAILED');
  });
});
