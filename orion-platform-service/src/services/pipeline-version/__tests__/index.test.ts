/**
 * pipeline-version index.ts re-export tests
 *
 * Verifies that all public symbols are correctly re-exported from the module entry point.
 */

import * as pipelineVersion from '../index';

describe('pipeline-version index', () => {
  describe('re-exports', () => {
    it('should export PipelineVersionService class', () => {
      expect(pipelineVersion.PipelineVersionService).toBeDefined();
      expect(typeof pipelineVersion.PipelineVersionService).toBe('function');
    });

    it('should export PipelineVersionRepository class', () => {
      expect(pipelineVersion.PipelineVersionRepository).toBeDefined();
      expect(typeof pipelineVersion.PipelineVersionRepository).toBe('function');
    });

    it('should export PipelineVersionServiceError class', () => {
      expect(pipelineVersion.PipelineVersionServiceError).toBeDefined();
      expect(typeof pipelineVersion.PipelineVersionServiceError).toBe('function');
    });

    it('should be able to instantiate PipelineVersionService', () => {
      const mockPool = { query: jest.fn() };
      const service = new pipelineVersion.PipelineVersionService(mockPool as any);
      expect(service).toBeDefined();
      expect(service.createVersion).toBeDefined();
      expect(service.getVersion).toBeDefined();
      expect(service.listVersions).toBeDefined();
      expect(service.diffVersions).toBeDefined();
      expect(service.rollback).toBeDefined();
      expect(service.addTag).toBeDefined();
      expect(service.removeTag).toBeDefined();
      expect(service.setBaseline).toBeDefined();
      expect(service.getBaseline).toBeDefined();
      expect(service.cleanupOldVersions).toBeDefined();
    });

    it('should be able to instantiate PipelineVersionRepository', () => {
      const mockPool = { query: jest.fn() };
      const repo = new pipelineVersion.PipelineVersionRepository(mockPool as any);
      expect(repo).toBeDefined();
      expect(repo.create).toBeDefined();
      expect(repo.findById).toBeDefined();
      expect(repo.findByPipelineAndVersion).toBeDefined();
      expect(repo.list).toBeDefined();
      expect(repo.addTag).toBeDefined();
      expect(repo.removeTag).toBeDefined();
      expect(repo.setBaseline).toBeDefined();
      expect(repo.getBaseline).toBeDefined();
      expect(repo.cleanupOldVersions).toBeDefined();
    });

    it('should be able to instantiate PipelineVersionServiceError', () => {
      const error = new pipelineVersion.PipelineVersionServiceError('test error', 'TEST_CODE');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('PipelineVersionServiceError');
    });
  });
});
