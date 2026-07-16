import { DualEngineService, DualEngineError } from '../dual-engine-service';
import { DualEngineRepository } from '../dual-engine-repository';
import { DualEngineConfig, DualEngineStatus } from '../dual-engine-model';

describe('DualEngineService', () => {
  let mockRepository: jest.Mocked<DualEngineRepository>;
  let service: DualEngineService;

  const mockAstConfig = {
    supportedLanguages: ['python', 'javascript'],
    parseTimeout: 5000,
    incrementalParsing: true,
    maxDepth: 10,
  };

  const mockLlmConfig = {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
    contextLearning: true,
    contextWindowSize: 4000,
  };

  const mockEngine: DualEngineConfig = {
    id: 'de-123',
    tenantId: 't1',
    name: 'Test Engine',
    description: 'A test dual engine',
    astConfig: mockAstConfig,
    llmConfig: mockLlmConfig,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStatus: DualEngineStatus = {
    engineId: 'de-123',
    astStatus: 'idle',
    llmStatus: 'idle',
    currentProcessingFiles: 0,
    processedFiles: 10,
    errorFiles: 0,
    lastUpdatedAt: new Date(),
  };

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      getStatus: jest.fn(),
      updateStatus: jest.fn(),
    } as unknown as jest.Mocked<DualEngineRepository>;

    service = new DualEngineService(mockRepository);
  });

  describe('createDualEngine', () => {
    it('should create a new dual engine', async () => {
      mockRepository.create.mockResolvedValue(mockEngine);

      const result = await service.createDualEngine(
        't1',
        'Test Engine',
        'A test dual engine',
        mockAstConfig,
        mockLlmConfig
      );

      expect(result).toEqual(mockEngine);
      expect(mockRepository.create).toHaveBeenCalledWith(
        't1',
        'Test Engine',
        'A test dual engine',
        mockAstConfig,
        mockLlmConfig
      );
    });

    it('should throw when tenantId is missing', async () => {
      await expect(
        service.createDualEngine('', 'Test Engine', 'desc', mockAstConfig, mockLlmConfig)
      ).rejects.toThrow(DualEngineError);
      await expect(
        service.createDualEngine('', 'Test Engine', 'desc', mockAstConfig, mockLlmConfig)
      ).rejects.toThrow('Tenant ID and name required');
    });

    it('should throw when name is missing', async () => {
      await expect(
        service.createDualEngine('t1', '', 'desc', mockAstConfig, mockLlmConfig)
      ).rejects.toThrow(DualEngineError);
    });

    it('should throw when AST config is invalid', async () => {
      const invalidAstConfig = { ...mockAstConfig, supportedLanguages: [] };
      await expect(
        service.createDualEngine('t1', 'Test', 'desc', invalidAstConfig, mockLlmConfig)
      ).rejects.toThrow('Supported languages required');
    });

    it('should throw when LLM config is invalid', async () => {
      const invalidLlmConfig = { ...mockLlmConfig, model: '' };
      await expect(
        service.createDualEngine('t1', 'Test', 'desc', mockAstConfig, invalidLlmConfig)
      ).rejects.toThrow('LLM model required');
    });
  });

  describe('getDualEngine', () => {
    it('should return dual engine by id', async () => {
      mockRepository.findById.mockResolvedValue(mockEngine);

      const result = await service.getDualEngine('de-123');

      expect(result).toEqual(mockEngine);
    });

    it('should throw when engine not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getDualEngine('non-existent')).rejects.toThrow('Dual engine not found');
    });
  });

  describe('listDualEngines', () => {
    it('should return all engines for a tenant', async () => {
      mockRepository.findAll.mockResolvedValue([mockEngine]);

      const result = await service.listDualEngines('t1');

      expect(result).toEqual([mockEngine]);
      expect(mockRepository.findAll).toHaveBeenCalledWith('t1');
    });

    it('should return empty array when no engines', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.listDualEngines('t1');

      expect(result).toEqual([]);
    });
  });

  describe('updateDualEngine', () => {
    it('should update engine name', async () => {
      const updated = { ...mockEngine, name: 'Updated Engine' };
      mockRepository.findById.mockResolvedValue(mockEngine);
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.updateDualEngine('de-123', { name: 'Updated Engine' });

      expect(result.name).toBe('Updated Engine');
    });

    it('should throw when engine not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateDualEngine('non-existent', { name: 'New' })
      ).rejects.toThrow('Dual engine not found');
    });

    it('should throw when update fails', async () => {
      mockRepository.findById.mockResolvedValue(mockEngine);
      mockRepository.update.mockResolvedValue(null);

      await expect(
        service.updateDualEngine('de-123', { name: 'New' })
      ).rejects.toThrow('Failed to update dual engine');
    });
  });

  describe('deleteDualEngine', () => {
    it('should delete an existing engine', async () => {
      mockRepository.delete.mockResolvedValue(true);

      const result = await service.deleteDualEngine('de-123');

      expect(result).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith('de-123');
    });

    it('should return false when engine does not exist', async () => {
      mockRepository.delete.mockResolvedValue(false);

      const result = await service.deleteDualEngine('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getDualEngineStatus', () => {
    it('should return engine status', async () => {
      mockRepository.getStatus.mockResolvedValue(mockStatus);

      const result = await service.getDualEngineStatus('de-123');

      expect(result).toEqual(mockStatus);
    });

    it('should throw when status not found', async () => {
      mockRepository.getStatus.mockResolvedValue(null);

      await expect(service.getDualEngineStatus('non-existent')).rejects.toThrow(
        'Dual engine status not found'
      );
    });
  });

  describe('startAnalysis', () => {
    it('should start analysis for valid files', async () => {
      mockRepository.findById.mockResolvedValue(mockEngine);
      mockRepository.updateStatus.mockResolvedValue(undefined);

      const results = await service.startAnalysis('de-123', ['file1.py', 'file2.py']);

      expect(results).toHaveLength(2);
      expect(results[0].filePath).toBe('file1.py');
      expect(results[0].status).toBe('completed');
      expect(mockRepository.updateStatus).toHaveBeenCalledTimes(2);
    });

    it('should throw when engine is not active', async () => {
      mockRepository.findById.mockResolvedValue({ ...mockEngine, status: 'inactive' });

      await expect(service.startAnalysis('de-123', ['file.py'])).rejects.toThrow(
        'Dual engine is not active'
      );
    });

    it('should throw when no files provided', async () => {
      mockRepository.findById.mockResolvedValue(mockEngine);

      await expect(service.startAnalysis('de-123', [])).rejects.toThrow('File paths required');
    });
  });
});
