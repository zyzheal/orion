import { ProductLineService } from '../ProductLineService';
import {
  ProductLineRepository,
  ReleaseTrainRepository,
  HotfixChannelRepository,
} from '../../../repositories/ProductLineRepository';

describe('ProductLineService', () => {
  let service: ProductLineService;
  let mockProductLineRepo: any;
  let mockReleaseTrainRepo: any;
  let mockHotfixChannelRepo: any;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    mockProductLineRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findByTenant: jest.fn(),
      findByPhase: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updatePhase: jest.fn(),
    };
    mockReleaseTrainRepo = {
      create: jest.fn(),
      findByProductLine: jest.fn(),
      findByState: jest.fn(),
      updateState: jest.fn(),
    };
    mockHotfixChannelRepo = {
      create: jest.fn(),
      findByProductLine: jest.fn(),
      findEnabled: jest.fn(),
      updateActiveHotfixes: jest.fn(),
    };

    // Mock constructor to inject repos
    service = new ProductLineService(mockDb);
    (service as any).productLineRepo = mockProductLineRepo;
    (service as any).releaseTrainRepo = mockReleaseTrainRepo;
    (service as any).hotfixChannelRepo = mockHotfixChannelRepo;
  });

  // ==================== CRUD Tests ====================

  describe('create', () => {
    test('should create product line with full input', async () => {
      const input = {
        name: 'payment-service',
        displayName: '支付服务',
        description: '支付核心服务',
        gitRepo: {
          url: 'https://github.com/orion/payment',
          provider: 'github' as const,
          defaultBranch: 'main',
        },
        branchPolicies: {
          mode: 'gitflow' as const,
          protectedBranches: [{ pattern: 'main', patternType: 'exact' as const }],
        },
        environmentMappings: {
          defaultEnvironment: 'dev' as const,
          mappings: [
            { branch: 'develop', patternType: 'exact' as const, environment: 'dev' as const },
            { branch: 'main', patternType: 'exact' as const, environment: 'prod' as const },
          ],
        },
      };

      mockProductLineRepo.create.mockResolvedValue({
        id: 'pl-001',
        tenantId: null,
        name: 'payment-service',
        displayName: '支付服务',
        description: '支付核心服务',
        gitUrl: 'https://github.com/orion/payment',
        gitProvider: 'github',
        gitDefaultBranch: 'main',
        gitCredentialRef: null,
        branchMode: 'gitflow',
        protectedBranches: [{ pattern: 'main', patternType: 'exact' }],
        codeOwnership: {},
        namingConvention: {},
        mergeStrategy: {},
        defaultEnvironment: 'dev',
        environmentMappings: [
          { branch: 'develop', patternType: 'exact', environment: 'dev' },
          { branch: 'main', patternType: 'exact', environment: 'prod' },
        ],
        promotionConfig: {},
        environments: [],
        defaultPipelineTemplate: null,
        pipelineTemplates: [],
        teamBindings: [],
        resourceQuotas: {},
        notifications: {},
        labels: {},
        annotations: {},
        phase: 'Pending',
        conditions: [],
        statistics: {},
        gitStatus: {},
        environmentStatuses: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(input);

      expect(result.name).toBe('payment-service');
      expect(result.displayName).toBe('支付服务');
      expect(result.gitRepo.url).toBe('https://github.com/orion/payment');
      expect(result.branchPolicies.mode).toBe('gitflow');
      expect(result.status.phase).toBe('Pending');
    });

    test('should throw error when database not configured', async () => {
      const noDbService = new ProductLineService(undefined);
      await expect(noDbService.create({
        name: 'test',
        displayName: 'Test',
        gitRepo: { url: 'https://github.com/test' },
        branchPolicies: { mode: 'github-flow' },
        environmentMappings: { mappings: [] },
      })).rejects.toThrow('Database not configured');
    });
  });

  describe('getById', () => {
    test('should return product line by id', async () => {
      mockProductLineRepo.findById.mockResolvedValue({
        id: 'pl-001',
        name: 'payment-service',
        displayName: '支付服务',
        description: null,
        gitUrl: 'https://github.com/orion/payment',
        gitProvider: 'github',
        gitDefaultBranch: 'main',
        gitCredentialRef: null,
        branchMode: 'gitflow',
        protectedBranches: [],
        codeOwnership: {},
        namingConvention: {},
        mergeStrategy: {},
        defaultEnvironment: 'dev',
        environmentMappings: [],
        promotionConfig: {},
        environments: [],
        defaultPipelineTemplate: null,
        pipelineTemplates: [],
        teamBindings: [],
        resourceQuotas: {},
        notifications: {},
        labels: {},
        annotations: {},
        phase: 'Active',
        conditions: [],
        statistics: {},
        gitStatus: {},
        environmentStatuses: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        tenantId: null,
      });

      const result = await service.getById('pl-001');

      expect(result).toBeDefined();
      expect(result?.id).toBe('pl-001');
      expect(result?.name).toBe('payment-service');
      expect(result?.status.phase).toBe('Active');
    });

    test('should return undefined when not found', async () => {
      mockProductLineRepo.findById.mockResolvedValue(undefined);
      const result = await service.getById('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getByName', () => {
    test('should return product line by name', async () => {
      mockProductLineRepo.findByName.mockResolvedValue({
        id: 'pl-001',
        name: 'payment-service',
        displayName: '支付服务',
        description: null,
        gitUrl: 'https://github.com/orion/payment',
        gitProvider: 'github',
        gitDefaultBranch: 'main',
        gitCredentialRef: null,
        branchMode: 'github-flow',
        protectedBranches: [],
        codeOwnership: {},
        namingConvention: {},
        mergeStrategy: {},
        defaultEnvironment: 'dev',
        environmentMappings: [],
        promotionConfig: {},
        environments: [],
        defaultPipelineTemplate: null,
        pipelineTemplates: [],
        teamBindings: [],
        resourceQuotas: {},
        notifications: {},
        labels: {},
        annotations: {},
        phase: 'Active',
        conditions: [],
        statistics: {},
        gitStatus: {},
        environmentStatuses: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        tenantId: null,
      });

      const result = await service.getByName('payment-service');

      expect(result).toBeDefined();
      expect(result?.name).toBe('payment-service');
    });
  });

  describe('list', () => {
    test('should list all product lines', async () => {
      mockProductLineRepo.findAll.mockResolvedValue({
        entities: [
          { id: 'pl-1', name: 'payment', displayName: 'P1', gitUrl: 'url1', branchMode: 'gitflow', phase: 'Active', createdAt: new Date(), updatedAt: new Date() },
          { id: 'pl-2', name: 'order', displayName: 'P2', gitUrl: 'url2', branchMode: 'github-flow', phase: 'Active', createdAt: new Date(), updatedAt: new Date() },
        ],
        total: 2,
      });

      const result = await service.list();

      expect(result.length).toBe(2);
    });

    test('should list by tenant', async () => {
      mockProductLineRepo.findByTenant.mockResolvedValue([
        { id: 'pl-1', name: 'payment', displayName: 'P1', tenantId: 't1', gitUrl: 'url', branchMode: 'gitflow', phase: 'Active', createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await service.list('t1');

      expect(result.length).toBe(1);
      expect(mockProductLineRepo.findByTenant).toHaveBeenCalledWith('t1');
    });

    test('should list by phase', async () => {
      mockProductLineRepo.findByPhase.mockResolvedValue([
        { id: 'pl-1', name: 'payment', displayName: 'P1', gitUrl: 'url', branchMode: 'gitflow', phase: 'Pending', createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await service.list(undefined, 'Pending');

      expect(result.length).toBe(1);
      expect(mockProductLineRepo.findByPhase).toHaveBeenCalledWith('Pending');
    });
  });

  describe('update', () => {
    test('should update product line', async () => {
      mockProductLineRepo.findById.mockResolvedValue({
        id: 'pl-001',
        name: 'payment',
        displayName: 'Old Name',
        description: 'Old desc',
        gitUrl: 'url',
        branchMode: 'gitflow',
        protectedBranches: [],
        codeOwnership: {},
        namingConvention: {},
        mergeStrategy: {},
        defaultEnvironment: 'dev',
        environmentMappings: [],
        promotionConfig: {},
        environments: [],
        defaultPipelineTemplate: null,
        pipelineTemplates: [],
        teamBindings: [],
        resourceQuotas: {},
        notifications: {},
        labels: {},
        annotations: {},
        phase: 'Active',
        conditions: [],
        statistics: {},
        gitStatus: {},
        environmentStatuses: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockProductLineRepo.update.mockResolvedValue({
        id: 'pl-001',
        name: 'payment',
        displayName: 'New Name',
        description: 'New desc',
        gitUrl: 'url',
        branchMode: 'gitflow',
        protectedBranches: [],
        codeOwnership: {},
        namingConvention: {},
        mergeStrategy: {},
        defaultEnvironment: 'dev',
        environmentMappings: [],
        promotionConfig: {},
        environments: [],
        defaultPipelineTemplate: null,
        pipelineTemplates: [],
        teamBindings: [],
        resourceQuotas: {},
        notifications: {},
        labels: {},
        annotations: {},
        phase: 'Active',
        conditions: [],
        statistics: {},
        gitStatus: {},
        environmentStatuses: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.update('pl-001', {
        displayName: 'New Name',
        description: 'New desc',
      });

      expect(result?.displayName).toBe('New Name');
      expect(result?.description).toBe('New desc');
    });

    test('should return null when not found', async () => {
      mockProductLineRepo.findById.mockResolvedValue(undefined);
      const result = await service.update('non-existent', { displayName: 'New' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    test('should delete product line', async () => {
      mockProductLineRepo.delete.mockResolvedValue(true);
      const result = await service.delete('pl-001');
      expect(result).toBe(true);
    });
  });

  describe('activate', () => {
    test('should activate product line', async () => {
      mockProductLineRepo.updatePhase.mockResolvedValue({
        id: 'pl-001',
        name: 'payment',
        displayName: 'Payment',
        phase: 'Active',
        conditions: [{ type: 'Activated', status: 'True' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.activate('pl-001');

      expect(result?.status.phase).toBe('Active');
    });
  });

  describe('suspend', () => {
    test('should suspend product line', async () => {
      mockProductLineRepo.updatePhase.mockResolvedValue({
        id: 'pl-001',
        name: 'payment',
        displayName: 'Payment',
        phase: 'Suspended',
        conditions: [{ type: 'Suspended', status: 'True' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.suspend('pl-001');

      expect(result?.status.phase).toBe('Suspended');
    });
  });

  // ==================== Branch-Environment Mapping Tests ====================

  describe('resolveEnvironment', () => {
    test('should resolve environment for exact match', async () => {
      mockProductLineRepo.findById.mockResolvedValue({
        id: 'pl-001',
        name: 'test',
        displayName: 'Test',
        gitUrl: 'url',
        branchMode: 'gitflow',
        defaultEnvironment: 'dev',
        environmentMappings: [
          { branch: 'main', patternType: 'exact', environment: 'prod', priority: 1 },
          { branch: 'develop', patternType: 'exact', environment: 'dev', priority: 2 },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.resolveEnvironment('pl-001', 'main');

      expect(result).toBe('prod');
    });

    test('should resolve environment for glob pattern', async () => {
      mockProductLineRepo.findById.mockResolvedValue({
        id: 'pl-001',
        name: 'test',
        displayName: 'Test',
        gitUrl: 'url',
        branchMode: 'gitflow',
        defaultEnvironment: 'dev',
        environmentMappings: [
          { branch: 'feature/*', patternType: 'glob', environment: 'dev' },
          { branch: 'release/*', patternType: 'glob', environment: 'staging' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.resolveEnvironment('pl-001', 'feature/new-api');

      expect(result).toBe('dev');
    });

    test('should resolve environment for regex pattern', async () => {
      mockProductLineRepo.findById.mockResolvedValue({
        id: 'pl-001',
        name: 'test',
        displayName: 'Test',
        gitUrl: 'url',
        branchMode: 'gitflow',
        defaultEnvironment: 'dev',
        environmentMappings: [
          { branch: '^hotfix/.*$', patternType: 'regex', environment: 'prod' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.resolveEnvironment('pl-001', 'hotfix/fix-bug');

      expect(result).toBe('prod');
    });

    test('should return default environment when no match', async () => {
      mockProductLineRepo.findById.mockResolvedValue({
        id: 'pl-001',
        name: 'test',
        displayName: 'Test',
        gitUrl: 'url',
        branchMode: 'gitflow',
        defaultEnvironment: 'dev',
        environmentMappings: [
          { branch: 'main', patternType: 'exact', environment: 'prod' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.resolveEnvironment('pl-001', 'random-branch');

      expect(result).toBe('dev');
    });

    test('should return undefined when product line not found', async () => {
      mockProductLineRepo.findById.mockResolvedValue(undefined);
      const result = await service.resolveEnvironment('non-existent', 'main');
      expect(result).toBeUndefined();
    });
  });

  describe('requiresApproval', () => {
    test('should return true when approval required', async () => {
      mockProductLineRepo.findById.mockResolvedValue({
        id: 'pl-001',
        name: 'test',
        displayName: 'Test',
        gitUrl: 'url',
        branchMode: 'gitflow',
        defaultEnvironment: 'dev',
        environmentMappings: [
          { branch: 'main', patternType: 'exact', environment: 'prod', requireApproval: true },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.requiresApproval('pl-001', 'main');

      expect(result).toBe(true);
    });

    test('should return false when approval not required', async () => {
      mockProductLineRepo.findById.mockResolvedValue({
        id: 'pl-001',
        name: 'test',
        displayName: 'Test',
        gitUrl: 'url',
        branchMode: 'gitflow',
        defaultEnvironment: 'dev',
        environmentMappings: [
          { branch: 'feature/*', patternType: 'glob', environment: 'dev', requireApproval: false },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.requiresApproval('pl-001', 'feature/new');

      expect(result).toBe(false);
    });

    test('should return true by default when not found', async () => {
      mockProductLineRepo.findById.mockResolvedValue(undefined);
      const result = await service.requiresApproval('non-existent', 'main');
      expect(result).toBe(true);
    });
  });

  // ==================== ReleaseTrain Tests ====================

  describe('createReleaseTrain', () => {
    test('should create release train', async () => {
      mockReleaseTrainRepo.create.mockResolvedValue({
        id: 'rt-001',
        productLineId: 'pl-001',
        name: 'weekly-release',
        schedule: '0 10 * * 1',
        targetBranch: 'production',
        sourceBranch: 'main',
        autoPromote: false,
        approvalRequired: true,
        approvers: ['user-1'],
        preChecks: [],
        postActions: [],
        lastRun: null,
        nextRun: null,
        state: 'Idle',
        lastRelease: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createReleaseTrain('pl-001', {
        name: 'weekly-release',
        schedule: '0 10 * * 1',
        approvers: ['user-1'],
      });

      expect(result.name).toBe('weekly-release');
      expect(result.schedule).toBe('0 10 * * 1');
      expect(result.status.state).toBe('Idle');
    });

    test('should throw error when database not configured', async () => {
      const noDbService = new ProductLineService(undefined);
      await expect(noDbService.createReleaseTrain('pl-001', {
        name: 'test',
        schedule: 'cron',
      })).rejects.toThrow('Database not configured');
    });
  });

  describe('getReleaseTrains', () => {
    test('should return release trains for product line', async () => {
      mockReleaseTrainRepo.findByProductLine.mockResolvedValue([
        {
          id: 'rt-1',
          productLineId: 'pl-001',
          name: 'weekly',
          schedule: '0 10 * * 1',
          targetBranch: 'prod',
          sourceBranch: 'main',
          autoPromote: false,
          approvalRequired: true,
          approvers: [],
          preChecks: [],
          postActions: [],
          lastRun: null,
          nextRun: null,
          state: 'Idle',
          lastRelease: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getReleaseTrains('pl-001');

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('weekly');
    });
  });

  // ==================== HotfixChannel Tests ====================

  describe('createHotfixChannel', () => {
    test('should create hotfix channel', async () => {
      mockHotfixChannelRepo.create.mockResolvedValue({
        id: 'hf-001',
        productLineId: 'pl-001',
        name: 'critical-hotfix',
        enabled: true,
        branchPattern: '^hotfix/.*$',
        skipStages: ['test'],
        requiredStages: ['scan', 'deploy'],
        approvalRequired: true,
        approvalTimeout: 30,
        autoMerge: false,
        notifyOnCall: true,
        maxDuration: 60,
        activeHotfixes: 0,
        lastHotfix: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createHotfixChannel('pl-001', {
        name: 'critical-hotfix',
        skipStages: ['test'],
        requiredStages: ['scan', 'deploy'],
      });

      expect(result.name).toBe('critical-hotfix');
      expect(result.enabled).toBe(true);
      expect(result.skipStages).toContain('test');
    });
  });

  describe('getHotfixChannels', () => {
    test('should return hotfix channels for product line', async () => {
      mockHotfixChannelRepo.findByProductLine.mockResolvedValue([
        {
          id: 'hf-1',
          productLineId: 'pl-001',
          name: 'hotfix',
          enabled: true,
          branchPattern: '^hotfix/.*$',
          skipStages: [],
          requiredStages: [],
          approvalRequired: true,
          approvalTimeout: 30,
          autoMerge: false,
          notifyOnCall: true,
          maxDuration: 60,
          activeHotfixes: 1,
          lastHotfix: 'hf-001',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getHotfixChannels('pl-001');

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('hotfix');
    });
  });

  describe('isHotfixBranch', () => {
    test('should return true for hotfix branch', async () => {
      mockHotfixChannelRepo.findEnabled.mockResolvedValue({
        id: 'hf-1',
        productLineId: 'pl-001',
        name: 'hotfix',
        enabled: true,
        branchPattern: '^hotfix/.*$',
        skipStages: [],
        requiredStages: [],
        approvalRequired: true,
        approvalTimeout: 30,
        autoMerge: false,
        notifyOnCall: true,
        maxDuration: 60,
        activeHotfixes: 0,
        lastHotfix: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.isHotfixBranch('pl-001', 'hotfix/fix-urgent-bug');

      expect(result).toBe(true);
    });

    test('should return false for non-hotfix branch', async () => {
      mockHotfixChannelRepo.findEnabled.mockResolvedValue({
        id: 'hf-1',
        productLineId: 'pl-001',
        name: 'hotfix',
        enabled: true,
        branchPattern: '^hotfix/.*$',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.isHotfixBranch('pl-001', 'feature/new');

      expect(result).toBe(false);
    });

    test('should return false when no hotfix channel', async () => {
      mockHotfixChannelRepo.findEnabled.mockResolvedValue(undefined);
      const result = await service.isHotfixBranch('pl-001', 'hotfix/test');
      expect(result).toBe(false);
    });
  });
});