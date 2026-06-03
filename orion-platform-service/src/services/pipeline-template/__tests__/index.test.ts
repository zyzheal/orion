/**
 * pipeline-template index.ts re-export tests
 *
 * Verifies that all public symbols are correctly re-exported from the module entry point.
 */

import * as pipelineTemplate from '../index';

describe('pipeline-template index', () => {
  describe('re-exports', () => {
    it('should export PipelineTemplateService class', () => {
      expect(pipelineTemplate.PipelineTemplateService).toBeDefined();
      expect(typeof pipelineTemplate.PipelineTemplateService).toBe('function');
    });

    it('should export PipelineTemplateRepository class', () => {
      expect(pipelineTemplate.PipelineTemplateRepository).toBeDefined();
      expect(typeof pipelineTemplate.PipelineTemplateRepository).toBe('function');
    });

    it('should export PipelineTemplateServiceError class', () => {
      expect(pipelineTemplate.PipelineTemplateServiceError).toBeDefined();
      expect(typeof pipelineTemplate.PipelineTemplateServiceError).toBe('function');
    });

    it('should be able to instantiate PipelineTemplateService', () => {
      const mockPool = { query: jest.fn() };
      const service = new pipelineTemplate.PipelineTemplateService(mockPool as any);
      expect(service).toBeDefined();
      expect(service.listTemplates).toBeDefined();
      expect(service.getTemplate).toBeDefined();
      expect(service.createTemplate).toBeDefined();
      expect(service.updateTemplate).toBeDefined();
      expect(service.deleteTemplate).toBeDefined();
      expect(service.instantiateTemplate).toBeDefined();
      expect(service.savePipelineAsTemplate).toBeDefined();
      expect(service.getTemplatesByCategory).toBeDefined();
      expect(service.searchTemplatesByTag).toBeDefined();
      expect(service.initializeBuiltinTemplates).toBeDefined();
    });

    it('should be able to instantiate PipelineTemplateRepository', () => {
      const mockPool = { query: jest.fn() };
      const repo = new pipelineTemplate.PipelineTemplateRepository(mockPool as any);
      expect(repo).toBeDefined();
      expect(repo.findById).toBeDefined();
      expect(repo.list).toBeDefined();
      expect(repo.create).toBeDefined();
      expect(repo.update).toBeDefined();
      expect(repo.delete).toBeDefined();
    });

    it('should be able to instantiate PipelineTemplateServiceError', () => {
      const error = new pipelineTemplate.PipelineTemplateServiceError('test error', 'TEST_CODE');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('PipelineTemplateServiceError');
    });
  });
});
