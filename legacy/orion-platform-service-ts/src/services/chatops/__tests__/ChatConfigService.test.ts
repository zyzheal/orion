/**
 * ChatConfigService 单元测试
 *
 * 测试问答卡片和快捷命令配置管理：CRUD、批量更新、映射逻辑。
 */

// Create stable mock instances that survive across test resets
const mockQuestionRepoInstance = {
  findByUserId: jest.fn().mockResolvedValue([]),
  upsert: jest.fn().mockResolvedValue({}),
  deleteByKey: jest.fn().mockResolvedValue(true),
};

const mockCommandRepoInstance = {
  findByUserId: jest.fn().mockResolvedValue([]),
  upsert: jest.fn().mockResolvedValue({}),
  deleteByKey: jest.fn().mockResolvedValue(true),
};

// Mock the ChatOpsRepository module
jest.mock('../../../repositories/ChatOpsRepository', () => ({
  ChatOpsQuestionConfigRepository: jest.fn().mockImplementation(() => mockQuestionRepoInstance),
  ChatOpsCommandConfigRepository: jest.fn().mockImplementation(() => mockCommandRepoInstance),
}));

import { ChatConfigService, QuestionConfig, CommandConfig } from '../ChatConfigService';
import {
  ChatOpsQuestionConfigRepository,
  ChatOpsCommandConfigRepository,
} from '../../../repositories/ChatOpsRepository';

describe('ChatConfigService', () => {
  let service: ChatConfigService;
  let mockPool: any;

  const sampleQuestionEntity = {
    id: 'q-1',
    userId: 'user-1',
    key: 'deploy-status',
    icon: 'RocketOutlined',
    title: 'Deploy Status',
    description: 'Check deploy status',
    question: 'What is the deploy status?',
    enabled: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleCommandEntity = {
    id: 'c-1',
    userId: 'user-1',
    key: 'quick-deploy',
    label: 'Quick Deploy',
    command: '/deploy service=api environment=staging',
    enabled: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Clear all mock call history and return values
    jest.clearAllMocks();
    // Re-set default return values after clearAllMocks
    mockQuestionRepoInstance.findByUserId.mockResolvedValue([]);
    mockQuestionRepoInstance.upsert.mockResolvedValue({});
    mockQuestionRepoInstance.deleteByKey.mockResolvedValue(true);
    mockCommandRepoInstance.findByUserId.mockResolvedValue([]);
    mockCommandRepoInstance.upsert.mockResolvedValue({});
    mockCommandRepoInstance.deleteByKey.mockResolvedValue(true);

    mockPool = {
      query: jest.fn(),
      transaction: jest.fn(),
    };
    service = new ChatConfigService(mockPool);
  });

  describe('constructor', () => {
    it('should create service with pool', () => {
      expect(service).toBeDefined();
    });

    it('should initialize question and command repositories', () => {
      expect(ChatOpsQuestionConfigRepository).toHaveBeenCalledWith(mockPool);
      expect(ChatOpsCommandConfigRepository).toHaveBeenCalledWith(mockPool);
    });
  });

  // ==================== Question Configs ====================

  describe('getQuestions', () => {
    it('should return mapped question configs', async () => {
      mockQuestionRepoInstance.findByUserId.mockResolvedValue([sampleQuestionEntity]);

      const result = await service.getQuestions('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('deploy-status');
      expect(result[0].icon).toBe('RocketOutlined');
      expect(result[0].title).toBe('Deploy Status');
      expect(result[0].desc).toBe('Check deploy status');
      expect(result[0].question).toBe('What is the deploy status?');
      expect(result[0].enabled).toBe(true);
    });

    it('should return empty array when no configs exist', async () => {
      mockQuestionRepoInstance.findByUserId.mockResolvedValue([]);

      const result = await service.getQuestions('user-1');

      expect(result).toHaveLength(0);
    });

    it('should call repository with userId', async () => {
      mockQuestionRepoInstance.findByUserId.mockResolvedValue([]);

      await service.getQuestions('user-42');

      expect(mockQuestionRepoInstance.findByUserId).toHaveBeenCalledWith('user-42');
    });
  });

  describe('updateQuestion', () => {
    it('should upsert question config and return mapped result', async () => {
      mockQuestionRepoInstance.upsert.mockResolvedValue(sampleQuestionEntity);

      const config: QuestionConfig = {
        key: 'deploy-status',
        icon: 'RocketOutlined',
        title: 'Deploy Status',
        desc: 'Check deploy status',
        question: 'What is the deploy status?',
        enabled: true,
      };

      const result = await service.updateQuestion('user-1', config);

      expect(result.key).toBe('deploy-status');
      expect(mockQuestionRepoInstance.upsert).toHaveBeenCalledWith({
        userId: 'user-1',
        key: 'deploy-status',
        icon: 'RocketOutlined',
        title: 'Deploy Status',
        description: 'Check deploy status',
        question: 'What is the deploy status?',
        enabled: true,
      });
    });

    it('should map desc to description for repository', async () => {
      mockQuestionRepoInstance.upsert.mockResolvedValue(sampleQuestionEntity);

      const config: QuestionConfig = {
        key: 'test',
        icon: 'icon',
        title: 'title',
        desc: 'my description',
        question: 'q?',
        enabled: false,
      };

      await service.updateQuestion('user-1', config);

      const upsertArg = mockQuestionRepoInstance.upsert.mock.calls[0][0];
      expect(upsertArg.description).toBe('my description');
      expect(upsertArg.desc).toBeUndefined();
    });
  });

  describe('deleteQuestion', () => {
    it('should delete question config', async () => {
      mockQuestionRepoInstance.deleteByKey.mockResolvedValue(true);

      const result = await service.deleteQuestion('user-1', 'deploy-status');

      expect(result).toBe(true);
      expect(mockQuestionRepoInstance.deleteByKey).toHaveBeenCalledWith('user-1', 'deploy-status');
    });

    it('should return false when config not found', async () => {
      mockQuestionRepoInstance.deleteByKey.mockResolvedValue(false);

      const result = await service.deleteQuestion('user-1', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('batchUpdateQuestions', () => {
    it('should batch update questions in transaction', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({
            rows: [{
              key: 'q1', icon: 'i1', title: 't1', description: 'd1',
              question: 'qu1', enabled: true,
            }],
          })
          .mockResolvedValueOnce({
            rows: [{
              key: 'q2', icon: 'i2', title: 't2', description: 'd2',
              question: 'qu2', enabled: false,
            }],
          }),
      };

      mockPool.transaction.mockImplementation(async (fn: Function) => fn(mockClient));

      const configs: QuestionConfig[] = [
        { key: 'q1', icon: 'i1', title: 't1', desc: 'd1', question: 'qu1', enabled: true },
        { key: 'q2', icon: 'i2', title: 't2', desc: 'd2', question: 'qu2', enabled: false },
      ];

      const result = await service.batchUpdateQuestions('user-1', configs);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('q1');
      expect(result[1].key).toBe('q2');
      expect(result[1].enabled).toBe(false);
      expect(mockPool.transaction).toHaveBeenCalled();
    });

    it('should handle empty configs array', async () => {
      mockPool.transaction.mockImplementation(async (fn: Function) => fn({ query: jest.fn() }));

      const result = await service.batchUpdateQuestions('user-1', []);

      expect(result).toHaveLength(0);
    });
  });

  // ==================== Command Configs ====================

  describe('getCommands', () => {
    it('should return mapped command configs', async () => {
      mockCommandRepoInstance.findByUserId.mockResolvedValue([sampleCommandEntity]);

      const result = await service.getCommands('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('quick-deploy');
      expect(result[0].label).toBe('Quick Deploy');
      expect(result[0].command).toBe('/deploy service=api environment=staging');
      expect(result[0].enabled).toBe(true);
    });

    it('should return empty array when no configs exist', async () => {
      mockCommandRepoInstance.findByUserId.mockResolvedValue([]);

      const result = await service.getCommands('user-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('updateCommand', () => {
    it('should upsert command config', async () => {
      mockCommandRepoInstance.upsert.mockResolvedValue(sampleCommandEntity);

      const config: CommandConfig = {
        key: 'quick-deploy',
        label: 'Quick Deploy',
        command: '/deploy service=api environment=staging',
        enabled: true,
      };

      const result = await service.updateCommand('user-1', config);

      expect(result.key).toBe('quick-deploy');
      expect(mockCommandRepoInstance.upsert).toHaveBeenCalledWith({
        userId: 'user-1',
        key: 'quick-deploy',
        label: 'Quick Deploy',
        command: '/deploy service=api environment=staging',
        enabled: true,
      });
    });
  });

  describe('deleteCommand', () => {
    it('should delete command config', async () => {
      mockCommandRepoInstance.deleteByKey.mockResolvedValue(true);

      const result = await service.deleteCommand('user-1', 'quick-deploy');

      expect(result).toBe(true);
      expect(mockCommandRepoInstance.deleteByKey).toHaveBeenCalledWith('user-1', 'quick-deploy');
    });

    it('should return false when config not found', async () => {
      mockCommandRepoInstance.deleteByKey.mockResolvedValue(false);

      const result = await service.deleteCommand('user-1', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('batchUpdateCommands', () => {
    it('should batch update commands in transaction', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({
            rows: [{
              key: 'c1', label: 'Deploy', command: '/deploy', enabled: true,
            }],
          })
          .mockResolvedValueOnce({
            rows: [{
              key: 'c2', label: 'Status', command: '/status', enabled: true,
            }],
          }),
      };

      mockPool.transaction.mockImplementation(async (fn: Function) => fn(mockClient));

      const configs: CommandConfig[] = [
        { key: 'c1', label: 'Deploy', command: '/deploy', enabled: true },
        { key: 'c2', label: 'Status', command: '/status', enabled: true },
      ];

      const result = await service.batchUpdateCommands('user-1', configs);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('c1');
      expect(result[1].key).toBe('c2');
    });
  });

  // ==================== Mapping edge cases ====================

  describe('entity-to-model mapping', () => {
    it('should handle empty string fields in question entity', async () => {
      mockQuestionRepoInstance.findByUserId.mockResolvedValue([{
        ...sampleQuestionEntity,
        icon: '',
        title: '',
        description: '',
        question: '',
      }]);

      const result = await service.getQuestions('user-1');

      expect(result[0].icon).toBe('');
      expect(result[0].title).toBe('');
      expect(result[0].desc).toBe('');
    });

    it('should handle empty string fields in command entity', async () => {
      mockCommandRepoInstance.findByUserId.mockResolvedValue([{
        ...sampleCommandEntity,
        label: '',
        command: '',
      }]);

      const result = await service.getCommands('user-1');

      expect(result[0].label).toBe('');
      expect(result[0].command).toBe('');
    });
  });
});
