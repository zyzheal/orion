/**
 * pipeline-budget index.ts re-export tests
 *
 * Verifies that all public symbols are correctly re-exported from the module entry point.
 */

import * as pipelineBudget from '../index';

describe('pipeline-budget index', () => {
  describe('re-exports', () => {
    it('should export PipelineBudgetService class', () => {
      expect(pipelineBudget.PipelineBudgetService).toBeDefined();
      expect(typeof pipelineBudget.PipelineBudgetService).toBe('function');
    });

    it('should export PipelineBudgetRepository class', () => {
      expect(pipelineBudget.PipelineBudgetRepository).toBeDefined();
      expect(typeof pipelineBudget.PipelineBudgetRepository).toBe('function');
    });

    it('should export PipelineBudgetServiceError class', () => {
      expect(pipelineBudget.PipelineBudgetServiceError).toBeDefined();
      expect(typeof pipelineBudget.PipelineBudgetServiceError).toBe('function');
    });

    it('should be able to instantiate PipelineBudgetService', () => {
      const mockPool = { query: jest.fn() };
      const service = new pipelineBudget.PipelineBudgetService(mockPool as any);
      expect(service).toBeDefined();
      expect(service.getBudget).toBeDefined();
      expect(service.setBudget).toBeDefined();
      expect(service.estimateBudget).toBeDefined();
      expect(service.getBudgetUsage).toBeDefined();
      expect(service.checkBudgetExceeded).toBeDefined();
      expect(service.markBudgetExceeded).toBeDefined();
      expect(service.getTenantBudgetDashboard).toBeDefined();
    });

    it('should be able to instantiate PipelineBudgetRepository', () => {
      const mockPool = { query: jest.fn() };
      const repo = new pipelineBudget.PipelineBudgetRepository(mockPool as any);
      expect(repo).toBeDefined();
      expect(repo.findByPipeline).toBeDefined();
      expect(repo.createOrUpdate).toBeDefined();
      expect(repo.getBudgetUsage).toBeDefined();
      expect(repo.getHistoricalUsage).toBeDefined();
    });

    it('should be able to instantiate PipelineBudgetServiceError', () => {
      const error = new pipelineBudget.PipelineBudgetServiceError('test error', 'TEST_CODE');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('test error');
      expect(error.code).toBe('TEST_CODE');
    });
  });
});
