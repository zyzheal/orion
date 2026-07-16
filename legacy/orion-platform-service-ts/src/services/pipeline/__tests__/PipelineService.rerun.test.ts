/**
 * PipelineService.retryRun() tests
 *
 * Tests for the retryRun() method which creates a retry run ID.
 */

import { PipelineService } from '../PipelineService';

// ==================== Mock Dependencies ====================

const mockFindRunById = jest.fn();
const mockFindStageExecutionsByRun = jest.fn();
const mockCreateRun = jest.fn();
const mockUpdateRunStatus = jest.fn();
const mockFindPipelineById = jest.fn();

const mockPipelineRepository = {
  findRunById: mockFindRunById,
  findPipelineById: mockFindPipelineById,
  createRun: mockCreateRun,
  updateRunStatus: mockUpdateRunStatus,
  findAll: jest.fn().mockResolvedValue([]),
  findById: mockFindPipelineById,
  findRunsByPipeline: jest.fn().mockResolvedValue([]),
  countRuns: jest.fn().mockResolvedValue(0),
  count: jest.fn().mockResolvedValue(0),
  findStagesByPipeline: jest.fn().mockResolvedValue([]),
  createStage: jest.fn(),
  createStageExecution: jest.fn(),
  findStageExecutions: mockFindStageExecutionsByRun,
  updateStageExecutionStatus: jest.fn(),
  findVersions: jest.fn().mockResolvedValue([]),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getPipelineStats: jest.fn().mockResolvedValue({ totalRuns: 0, successRuns: 0, failedRuns: 0, runningRuns: 0, avgDuration: 0 }),
};

const mockRunRepository = {
  findRunById: mockFindRunById,
  findStageExecutionsByRun: mockFindStageExecutionsByRun,
  createRun: mockCreateRun,
  updateRunStatus: mockUpdateRunStatus,
  findById: mockFindRunById,
  findAll: jest.fn().mockResolvedValue([]),
  findByStatus: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue(0),
  findStageExecutionById: jest.fn(),
  updateStageExecutionStatus: jest.fn(),
  findStageExecutions: jest.fn().mockResolvedValue([]),
};

describe('PipelineService.retryRun()', () => {
  let service: PipelineService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new PipelineService(mockPipelineRepository as any);
    // @ts-ignore - inject run repository for testing
    service['runRepository'] = mockRunRepository as any;
  });

  it('should return a retry run ID string', async () => {
    const result = await service.retryRun('run-001');
    expect(result).toMatch(/^run-retry-/);
  });

  it('should accept fromStage option', async () => {
    const result = await service.retryRun('run-001', { fromStage: 'deploy' });
    expect(result).toMatch(/^run-retry-/);
  });

  it('should accept onlyFailed option', async () => {
    const result = await service.retryRun('run-001', { onlyFailed: true });
    expect(result).toMatch(/^run-retry-/);
  });

  it('should accept combined options', async () => {
    const result = await service.retryRun('run-001', { fromStage: 'test', onlyFailed: true });
    expect(result).toMatch(/^run-retry-/);
  });

  it('should return unique IDs on multiple calls', async () => {
    const result1 = await service.retryRun('run-001');
    const result2 = await service.retryRun('run-001');
    expect(result1).not.toBe(result2);
  });

  it('should accept triggeredBy option', async () => {
    const result = await service.retryRun('run-001', { triggeredBy: 'user-1' });
    expect(result).toMatch(/^run-retry-/);
  });
});
