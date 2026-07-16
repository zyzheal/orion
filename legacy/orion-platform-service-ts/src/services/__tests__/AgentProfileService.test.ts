/**
 * AgentProfileService Unit Tests
 *
 * Tests for CRUD operations, validation, and toggle functionality.
 */

import {
  AgentProfileService,
  AgentProfileServiceError,
} from '../agent-profile-service';
import { AgentProfileRepository, AgentProfileEntity } from '../../repositories/AgentProfileRepository';
import {
  AgentProfile,
  AgentProfileCreateInput,
  AgentRole,
} from '../../models/AgentProfile';

// Mock repository
class MockAgentProfileRepository {
  findById = jest.fn();
  findAll = jest.fn();
  create = jest.fn();
  update = jest.fn();
  delete = jest.fn();
  findByType = jest.fn();
  findActive = jest.fn();
  updateCapabilities = jest.fn();
  updateStatus = jest.fn();
}

function makeEntity(overrides: Partial<AgentProfileEntity> = {}): AgentProfileEntity {
  const now = new Date();
  return {
    id: 'agent-1',
    name: 'Code Review Agent',
    type: 'code_fixer',
    capabilities: { maxSteps: 20, timeoutSec: 3600, retryCount: 3 },
    config: {
      description: 'Review code for bugs',
      tools: [{ toolName: 'read_file', permission: 'read' }],
      constraints: { maxTokens: 8192, allowedBranches: ['main'], forbiddenOperations: [] },
      llmConfig: { model: 'gpt-4o-mini', temperature: 0.2, maxTokens: 4096 },
      enabled: true,
    },
    status: 'active',
    lastActiveAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('AgentProfileService', () => {
  let service: AgentProfileService;
  let mockRepo: MockAgentProfileRepository;

  beforeEach(() => {
    mockRepo = new MockAgentProfileRepository();
    // Create service and inject mock repository by creating with no db then replacing
    service = new AgentProfileService();
    (service as any).repository = mockRepo as unknown as AgentProfileRepository;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create agent profile with valid input', async () => {
      const input: AgentProfileCreateInput = {
        name: 'Test Agent',
        role: 'code_fixer' as AgentRole,
        description: 'A test agent',
      };

      mockRepo.create.mockResolvedValue(makeEntity({ name: 'Test Agent', type: 'code_fixer' }));

      const result = await service.create(input);

      expect(result.name).toBe('Test Agent');
      expect(result.role).toBe('code_fixer');
      expect(result.enabled).toBe(true);
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('should apply default capabilities when not provided', async () => {
      mockRepo.create.mockResolvedValue(makeEntity());

      const result = await service.create({
        name: 'Default Agent',
        role: 'bug_fixer',
      });

      expect(result.capabilities.maxSteps).toBe(20);
      expect(result.capabilities.timeoutSec).toBe(3600);
      expect(result.capabilities.retryCount).toBe(3);
    });

    it('should apply default constraints when not provided', async () => {
      const entity = makeEntity();
      // Override config to include default forbiddenOperations
      entity.config = {
        ...entity.config,
        constraints: {
          maxTokens: 8192,
          allowedBranches: ['main'],
          forbiddenOperations: ['deploy_to_production', 'drop_database'],
        },
      };
      mockRepo.create.mockResolvedValue(entity);

      const result = await service.create({
        name: 'Default Agent',
        role: 'bug_fixer',
      });

      expect(result.constraints.maxTokens).toBe(8192);
      expect(result.constraints.forbiddenOperations).toContain('deploy_to_production');
    });

    it('should apply default LLM config when not provided', async () => {
      mockRepo.create.mockResolvedValue(makeEntity());

      const result = await service.create({
        name: 'Default Agent',
        role: 'bug_fixer',
      });

      expect(result.llmConfig.model).toBe('gpt-4o-mini');
      expect(result.llmConfig.temperature).toBe(0.2);
    });

    it('should reject empty name', async () => {
      await expect(service.create({ name: '', role: 'bug_fixer' })).rejects.toThrow(
        'Agent profile name is required',
      );
    });

    it('should reject invalid role', async () => {
      await expect(
        service.create({ name: 'Test', role: 'invalid_role' as AgentRole }),
      ).rejects.toThrow('Invalid agent role');
    });
  });

  describe('getById', () => {
    it('should return profile when found', async () => {
      const entity = makeEntity({ id: 'test-id', name: 'Found Agent' });
      mockRepo.findById.mockResolvedValue(entity);

      const result = await service.getById('test-id');

      expect(result.id).toBe('test-id');
      expect(result.name).toBe('Found Agent');
    });

    it('should throw error when not found', async () => {
      mockRepo.findById.mockResolvedValue(undefined);

      await expect(service.getById('nonexistent')).rejects.toThrow(
        'Agent profile not found: nonexistent',
      );
      await expect(service.getById('nonexistent')).rejects.toThrow(AgentProfileServiceError);
    });
  });

  describe('list', () => {
    it('should return all profiles when no filter', async () => {
      mockRepo.findAll.mockResolvedValue({
        entities: [makeEntity({ id: 'a1' }), makeEntity({ id: 'a2' })],
        total: 2,
      });

      const result = await service.list();

      expect(result.length).toBe(2);
      expect(mockRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: 'created_at', orderDir: 'DESC' }),
      );
    });

    it('should filter by role', async () => {
      mockRepo.findAll.mockResolvedValue({
        entities: [makeEntity({ type: 'test_writer' })],
        total: 1,
      });

      const result = await service.list({ roleFilter: 'test_writer' });

      expect(result.length).toBe(1);
      expect(mockRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: 'test_writer' } }),
      );
    });

    it('should filter enabled only', async () => {
      mockRepo.findAll.mockResolvedValue({
        entities: [makeEntity({ status: 'active' })],
        total: 1,
      });

      await service.list({ enabledOnly: true });

      expect(mockRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'active' } }),
      );
    });
  });

  describe('update', () => {
    it('should update profile fields', async () => {
      const existing = makeEntity();
      const updated = makeEntity({
        config: {
          ...existing.config,
          description: 'Updated description',
          tools: existing.config.tools,
          constraints: existing.config.constraints,
          llmConfig: existing.config.llmConfig,
          enabled: true,
        },
      });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update('agent-1', {
        description: 'Updated description',
      });

      expect(result.description).toBe('Updated description');
    });

    it('should throw error when profile not found', async () => {
      mockRepo.findById.mockResolvedValue(undefined);

      await expect(service.update('nonexistent', {})).rejects.toThrow(
        'Agent profile not found: nonexistent',
      );
    });

    it('should merge capabilities', async () => {
      const existing = makeEntity();
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue(
        makeEntity({
          capabilities: { maxSteps: 50, timeoutSec: 3600, retryCount: 3 },
        }),
      );

      const result = await service.update('agent-1', {
        capabilities: { maxSteps: 50 },
      });

      expect(result.capabilities.maxSteps).toBe(50);
      expect(result.capabilities.timeoutSec).toBe(3600); // unchanged
    });
  });

  describe('delete', () => {
    it('should delete existing profile', async () => {
      mockRepo.findById.mockResolvedValue(makeEntity());
      mockRepo.delete.mockResolvedValue(true);

      await expect(service.delete('agent-1')).resolves.toBeUndefined();
    });

    it('should throw error when profile not found', async () => {
      mockRepo.findById.mockResolvedValue(undefined);

      await expect(service.delete('nonexistent')).rejects.toThrow(
        'Agent profile not found: nonexistent',
      );
    });
  });

  describe('toggle', () => {
    it('should disable an active profile', async () => {
      const activeEntity = makeEntity({ status: 'active' });
      const inactiveEntity = makeEntity({ status: 'inactive' });
      mockRepo.findById.mockResolvedValueOnce(activeEntity);
      mockRepo.updateStatus.mockResolvedValue(undefined);
      mockRepo.findById.mockResolvedValueOnce(inactiveEntity);

      const result = await service.toggle('agent-1');

      expect(result.enabled).toBe(false);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith('agent-1', 'inactive');
    });

    it('should enable an inactive profile', async () => {
      const inactiveEntity = makeEntity({ status: 'inactive' });
      const activeEntity = makeEntity({ status: 'active' });
      mockRepo.findById.mockResolvedValueOnce(inactiveEntity);
      mockRepo.updateStatus.mockResolvedValue(undefined);
      mockRepo.findById.mockResolvedValueOnce(activeEntity);

      const result = await service.toggle('agent-1');

      expect(result.enabled).toBe(true);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith('agent-1', 'active');
    });

    it('should throw error when profile not found', async () => {
      mockRepo.findById.mockResolvedValue(undefined);

      await expect(service.toggle('nonexistent')).rejects.toThrow(
        'Agent profile not found: nonexistent',
      );
    });
  });

  describe('findByType', () => {
    it('should return profiles of specified type', async () => {
      mockRepo.findByType.mockResolvedValue([
        makeEntity({ type: 'code_fixer' }),
      ]);

      const result = await service.findByType('code_fixer');

      expect(result.length).toBe(1);
      expect(result[0].role).toBe('code_fixer');
    });
  });

  describe('findActive', () => {
    it('should return active profiles', async () => {
      mockRepo.findActive.mockResolvedValue([makeEntity({ status: 'active' })]);

      const result = await service.findActive();

      expect(result.length).toBe(1);
      expect(result[0].enabled).toBe(true);
    });
  });
});
