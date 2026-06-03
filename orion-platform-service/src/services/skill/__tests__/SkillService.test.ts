/**
 * SkillService Tests
 *
 * Tests for SkillService and SkillRepository covering:
 * - Skill CRUD operations
 * - Registration and publishing
 * - Version management
 * - Review and rating
 * - Search and discovery
 * - Marketplace and featured skills
 */

import { SkillService, SkillServiceError, ListSkillsOptions } from '../SkillService';
import {
  SkillRepository,
  SkillPackage,
  SkillVersion,
  SkillInstance,
  SkillReview,
  CreateSkillInput,
  UpdateSkillInput,
  CreateInstanceInput,
  UpdateInstanceInput,
} from '../SkillRepository';

// ==================== Mock Helpers ====================

function makeMockRepository() {
  const skills: Map<string, SkillPackage> = new Map();
  const versions: Map<string, SkillVersion[]> = new Map();
  const reviews: Map<string, SkillReview[]> = new Map();
  const instances: Map<string, SkillInstance> = new Map();

  const repo: jest.Mocked<SkillRepository> = {
    findById: jest.fn(async (id: string) => skills.get(id) ?? null),
    findByName: jest.fn(async (name: string) => {
      for (const s of skills.values()) {
        if (s.name === name) return s;
      }
      return null;
    }),

    findAll: jest.fn(async (options?: { status?: string; category?: string; tags?: string[]; limit?: number; offset?: number }) => {
      let result = Array.from(skills.values());
      if (options?.status) result = result.filter((s) => s.status === options.status);
      if (options?.category) result = result.filter((s) => s.category === options.category);
      if (options?.tags && options.tags.length > 0) {
        result = result.filter((s) => s.tags.some((t) => options.tags!.includes(t)));
      }
      result.sort((a, b) => b.install_count - a.install_count || b.rating - a.rating);
      if (options?.limit) result = result.slice(0, options.limit);
      if (options?.offset) result = result.slice(options.offset);
      return result;
    }),

    count: jest.fn(async (options?: { status?: string; category?: string }) => {
      let result = Array.from(skills.values());
      if (options?.status) result = result.filter((s) => s.status === options.status);
      if (options?.category) result = result.filter((s) => s.category === options.category);
      return result.length;
    }),

    create: jest.fn(async (input: CreateSkillInput) => {
      const skill: SkillPackage = {
        id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: input.name,
        version: input.version,
        description: input.description,
        category: input.category,
        tags: input.tags || [],
        author: input.author,
        status: 'draft',
        schema: input.schema || {},
        capabilities: input.capabilities || null,
        schemas: input.schemas || null,
        is_version_locked: false,
        install_count: 0,
        rating: 0,
        rating_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };
      skills.set(skill.id, skill);
      versions.set(skill.id, []);
      reviews.set(skill.id, []);
      return skill;
    }),

    update: jest.fn(async (id: string, input: UpdateSkillInput) => {
      const existing = skills.get(id);
      if (!existing) return null;
      const updated = {
        ...existing,
        ...input,
        updated_at: new Date(),
      };
      skills.set(id, updated);
      return updated;
    }),

    delete: jest.fn(async (id: string) => {
      const existing = skills.get(id);
      if (!existing) return false;
      existing.status = 'uninstalled';
      existing.updated_at = new Date();
      return true;
    }),

    incrementInstallCount: jest.fn(async (id: string) => {
      const skill = skills.get(id);
      if (skill) {
        skill.install_count += 1;
      }
    }),

    createVersion: jest.fn(async (input) => {
      const version: SkillVersion = {
        id: `ver-${Date.now()}`,
        skill_id: input.skill_id,
        version: input.version,
        changelog: input.changelog ?? null,
        schema: input.schema || {},
        schema_snapshot: input.schema_snapshot ?? null,
        is_latest: true,
        is_locked: input.is_locked ?? false,
        released_at: new Date(),
        created_at: new Date(),
      };
      const skillVersions = versions.get(input.skill_id) || [];
      // Clear previous latest
      for (const v of skillVersions) {
        v.is_latest = false;
      }
      skillVersions.unshift(version);
      versions.set(input.skill_id, skillVersions);

      // Also update the skill package version
      const skill = skills.get(input.skill_id);
      if (skill) {
        skill.version = input.version;
        skill.updated_at = new Date();
      }

      return version;
    }),

    findVersions: jest.fn(async (skillId: string) => versions.get(skillId) || []),
    findLatestVersion: jest.fn(async (skillId: string) => {
      const skillVersions = versions.get(skillId) || [];
      return skillVersions.find((v) => v.is_latest) || null;
    }),

    // Instance CRUD mocks
    createInstance: jest.fn(async (input: CreateInstanceInput) => {
      const instance: SkillInstance = {
        id: `inst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        skill_id: input.skill_id,
        tenant_id: input.tenant_id,
        project_id: input.project_id ?? null,
        name: input.name,
        config: input.config || {},
        is_default: input.is_default || false,
        created_at: new Date(),
        updated_at: new Date(),
      };
      instances.set(instance.id, instance);
      return instance;
    }),

    findInstanceById: jest.fn(async (id: string) => instances.get(id) ?? null),

    findInstanceByIdAndTenant: jest.fn(async (id: string, _tenantId: string) => instances.get(id) ?? null),

    findInstancesBySkillId: jest.fn(async (skillId: string, tenantId: string) => {
      return Array.from(instances.values()).filter(
        (i) => i.skill_id === skillId && i.tenant_id === tenantId
      ).sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || a.name.localeCompare(b.name));
    }),

    findInstancesByTenant: jest.fn(async (tenantId: string, _limit = 50, _offset = 0) => {
      const filtered = Array.from(instances.values()).filter(
        (i) => i.tenant_id === tenantId
      );
      return { instances: filtered, total: filtered.length };
    }),

    updateInstance: jest.fn(async (id: string, input: UpdateInstanceInput) => {
      const existing = instances.get(id);
      if (!existing) return null;
      const updated = {
        ...existing,
        ...input,
        updated_at: new Date(),
      };
      instances.set(id, updated);
      return updated;
    }),

    deleteInstance: jest.fn(async (id: string) => {
      const existing = instances.get(id);
      if (!existing) return false;
      instances.delete(id);
      return true;
    }),

    lockVersion: jest.fn(async (versionId: string) => {
      for (const [skillId, skillVersions] of versions.entries()) {
        const version = skillVersions.find((v) => v.id === versionId);
        if (version) {
          version.is_locked = true;
          version.released_at = new Date();
          return version;
        }
      }
      return null;
    }),

    unlockVersion: jest.fn(async (versionId: string) => {
      for (const skillVersions of versions.values()) {
        const version = skillVersions.find((v) => v.id === versionId);
        if (version) {
          version.is_locked = false;
          return version;
        }
      }
      return null;
    }),

    createReview: jest.fn(async (input) => {
      const review: SkillReview = {
        id: `review-${Date.now()}`,
        skill_id: input.skill_id,
        user_id: input.user_id,
        rating: input.rating,
        comment: input.comment ?? null,
        created_at: new Date(),
      };
      const skillReviews = reviews.get(input.skill_id) || [];
      skillReviews.unshift(review);
      reviews.set(input.skill_id, skillReviews);

      // Update skill rating
      const skill = skills.get(input.skill_id);
      if (skill) {
        const allReviews = skillReviews;
        const total = allReviews.reduce((sum, r) => sum + r.rating, 0);
        skill.rating = Math.round((total / allReviews.length) * 100) / 100;
        skill.rating_count = allReviews.length;
      }

      return review;
    }),

    findReviews: jest.fn(async (skillId: string) => reviews.get(skillId) || []),

    search: jest.fn(async (query: string, limit = 20) => {
      const lowerQuery = query.toLowerCase();
      const result = Array.from(skills.values())
        .filter(
          (s) =>
            s.status === 'published' &&
            (s.name.toLowerCase().includes(lowerQuery) || s.description.toLowerCase().includes(lowerQuery))
        )
        .sort((a, b) => b.install_count - a.install_count)
        .slice(0, limit);
      return result;
    }),

    getCategories: jest.fn(async () => {
      const categoryMap = new Map<string, number>();
      for (const skill of skills.values()) {
        if (skill.status === 'published') {
          categoryMap.set(skill.category, (categoryMap.get(skill.category) || 0) + 1);
        }
      }
      return Array.from(categoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
    }),

    // Execution mocks
    createExecution: jest.fn(async (input) => ({
      id: `exec-${Date.now()}`,
      tenant_id: input.tenant_id,
      skill_id: input.skill_id,
      instance_id: input.instance_id ?? null,
      capability: input.capability ?? null,
      status: 'pending',
      input: input.input || {},
      output: null,
      error_message: null,
      duration_ms: null,
      triggered_by: input.triggered_by ?? null,
      trigger_mode: input.trigger_mode || 'manual',
      metadata: input.metadata || {},
      started_at: new Date(),
      completed_at: null,
      created_at: new Date(),
    })),

    updateExecution: jest.fn(async (id, input) => ({
      id,
      tenant_id: 't1',
      skill_id: 's1',
      instance_id: null,
      capability: null,
      status: input.status || 'completed',
      input: {},
      output: input.output ?? null,
      error_message: input.error_message ?? null,
      duration_ms: input.duration_ms ?? null,
      triggered_by: null,
      trigger_mode: 'manual',
      metadata: {},
      started_at: new Date(),
      completed_at: input.completed_at ?? new Date(),
      created_at: new Date(),
    })),

    findExecutionById: jest.fn(async (id) => {
      if (id === 'exec-existing') {
        return {
          id,
          tenant_id: 't1',
          skill_id: 's1',
          instance_id: null,
          capability: null,
          status: 'pending',
          input: {},
          output: null,
          error_message: null,
          duration_ms: null,
          triggered_by: null,
          trigger_mode: 'manual',
          metadata: {},
          started_at: new Date(),
          completed_at: null,
          created_at: new Date(),
        };
      }
      return null;
    }),

    findExecutionsBySkill: jest.fn(async () => ({ executions: [], total: 0 })),
    findExecutionsByTenant: jest.fn(async () => ({ executions: [], total: 0 })),

    // Audit log mocks
    createAuditLog: jest.fn(async (input) => ({
      id: `audit-${Date.now()}`,
      skill_id: input.skill_id,
      action: input.action,
      actor_id: input.actor_id ?? null,
      actor_name: input.actor_name ?? null,
      old_status: input.old_status ?? null,
      new_status: input.new_status ?? null,
      reason: input.reason ?? null,
      changes: input.changes ?? null,
      created_at: new Date(),
    })),

    findAuditLogs: jest.fn(async () => ({ logs: [], total: 0 })),
    findAllAuditLogs: jest.fn(async () => ({ logs: [], total: 0 })),
    findPendingReview: jest.fn(async () => ({ skills: [], total: 0 })),
  } as unknown as jest.Mocked<SkillRepository>;

  return { repo, skills, versions, reviews, instances };
}

function makeSampleSkillInput(overrides: Partial<CreateSkillInput> = {}): CreateSkillInput {
  return {
    name: 'test-skill',
    version: '1.0.0',
    description: 'A test skill for unit testing',
    category: 'testing',
    tags: ['test', 'unit'],
    author: 'test-user',
    schema: { inputs: [{ name: 'param1', type: 'string' }] },
    ...overrides,
  };
}

// ==================== Test Suite ====================

describe('SkillService', () => {
  describe('Skill CRUD', () => {
    describe('createSkill', () => {
      it('should create a skill with all fields', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const input = makeSampleSkillInput();
        const result = await service.createSkill(input);

        expect(result.name).toBe('test-skill');
        expect(result.version).toBe('1.0.0');
        expect(result.description).toBe('A test skill for unit testing');
        expect(result.category).toBe('testing');
        expect(result.tags).toEqual(['test', 'unit']);
        expect(result.author).toBe('test-user');
        expect(result.status).toBe('draft');
        expect(result.install_count).toBe(0);
        expect(result.id).toBeDefined();
        expect(result.created_at).toBeDefined();
      });

      it('should trim name and description', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const result = await service.createSkill(makeSampleSkillInput({
          name: '  spaced-skill  ',
          description: '  description with spaces  ',
        }));

        expect(result.name).toBe('spaced-skill');
        expect(result.description).toBe('description with spaces');
      });

      it('should throw when name is empty', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.createSkill(makeSampleSkillInput({ name: '' }))).rejects.toThrow(SkillServiceError);
        await expect(service.createSkill(makeSampleSkillInput({ name: '' }))).rejects.toThrow('Skill name is required');
      });

      it('should throw when name is only whitespace', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.createSkill(makeSampleSkillInput({ name: '   ' }))).rejects.toThrow(SkillServiceError);
      });

      it('should throw when description is empty', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.createSkill(makeSampleSkillInput({ description: '' }))).rejects.toThrow(SkillServiceError);
        await expect(service.createSkill(makeSampleSkillInput({ description: '' }))).rejects.toThrow('Description is required');
      });

      it('should throw when description is only whitespace', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.createSkill(makeSampleSkillInput({ description: '   ' }))).rejects.toThrow(SkillServiceError);
      });

      it('should throw when author is empty', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.createSkill(makeSampleSkillInput({ author: '' }))).rejects.toThrow(SkillServiceError);
        await expect(service.createSkill(makeSampleSkillInput({ author: '' }))).rejects.toThrow('Author is required');
      });

      it('should throw on duplicate name', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await service.createSkill(makeSampleSkillInput({ name: 'duplicate-skill' }));
        await expect(service.createSkill(makeSampleSkillInput({ name: 'duplicate-skill' }))).rejects.toThrow(SkillServiceError);
        await expect(service.createSkill(makeSampleSkillInput({ name: 'duplicate-skill' }))).rejects.toThrow('Skill name already exists');
      });

      it('should create initial version', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await service.createSkill(makeSampleSkillInput({ name: 'versioned-skill', version: '0.1.0', schema: { foo: 'bar' } }));

        expect(repo.createVersion).toHaveBeenCalledWith(
          expect.objectContaining({
            version: '0.1.0',
            schema: { foo: 'bar' },
          })
        );
      });
    });

    describe('getSkill', () => {
      it('should return skill by ID', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'find-me' }));
        const result = await service.getSkill(created.id);

        expect(result.id).toBe(created.id);
        expect(result.name).toBe('find-me');
      });

      it('should throw when skill not found', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.getSkill('nonexistent-id')).rejects.toThrow(SkillServiceError);
        await expect(service.getSkill('nonexistent-id')).rejects.toThrow('Skill not found: nonexistent-id');
      });

      it('should include error code SKILL_NOT_FOUND', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        try {
          await service.getSkill('nonexistent-id');
          fail('Should have thrown');
        } catch (err) {
          expect((err as SkillServiceError).code).toBe('SKILL_NOT_FOUND');
        }
      });
    });

    describe('listSkills', () => {
      it('should return paginated results', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await service.createSkill(makeSampleSkillInput({ name: 'skill-1' }));
        await service.createSkill(makeSampleSkillInput({ name: 'skill-2' }));
        await service.createSkill(makeSampleSkillInput({ name: 'skill-3' }));

        const result = await service.listSkills({ page: 1, limit: 2 });

        expect(result.data.length).toBe(2);
        expect(result.total).toBe(3);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(2);
        expect(result.totalPages).toBe(2);
      });

      it('should return default pagination when no options', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await service.createSkill(makeSampleSkillInput({ name: 'default-page' }));
        const result = await service.listSkills();

        expect(result.page).toBe(1);
        expect(result.limit).toBe(20);
      });

      it('should filter by status', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const s1 = await service.createSkill(makeSampleSkillInput({ name: 'draft-skill' }));
        const s2 = await service.createSkill(makeSampleSkillInput({ name: 'published-skill' }));
        await service.publishSkill(s2.id);

        const drafts = await service.listSkills({ status: 'draft' });
        const published = await service.listSkills({ status: 'published' });

        expect(drafts.data.some((s) => s.name === 'draft-skill')).toBe(true);
        expect(published.data.some((s) => s.name === 'published-skill')).toBe(true);
      });

      it('should filter by category', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await service.createSkill(makeSampleSkillInput({ name: 'deploy-skill', category: 'deploy' }));
        await service.createSkill(makeSampleSkillInput({ name: 'build-skill', category: 'build' }));

        const result = await service.listSkills({ category: 'deploy' });
        expect(result.data.some((s) => s.name === 'deploy-skill')).toBe(true);
        expect(result.data.every((s) => s.category === 'deploy')).toBe(true);
      });

      it('should filter by tags', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await service.createSkill(makeSampleSkillInput({ name: 'tagged-skill', tags: ['cicd', 'deploy'] }));
        await service.createSkill(makeSampleSkillInput({ name: 'other-skill', tags: ['test'] }));

        const result = await service.listSkills({ tags: ['cicd'] });
        expect(result.data.some((s) => s.name === 'tagged-skill')).toBe(true);
      });
    });

    describe('updateSkill', () => {
      it('should update skill fields', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'update-me' }));
        const updated = await service.updateSkill(created.id, {
          name: 'updated-name',
          description: 'Updated description',
          category: 'new-category',
          tags: ['updated', 'tags'],
        });

        expect(updated.name).toBe('updated-name');
        expect(updated.description).toBe('Updated description');
        expect(updated.category).toBe('new-category');
        expect(updated.tags).toEqual(['updated', 'tags']);
      });

      it('should throw when skill not found', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.updateSkill('nonexistent', { name: 'x' })).rejects.toThrow(SkillServiceError);
      });

      it('should throw UPDATE_FAILED when repo returns null', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'fail-update' }));
        // Override to always return null for this test
        (repo.update as jest.Mock).mockImplementation(async () => null);

        await expect(service.updateSkill(created.id, { name: 'x' })).rejects.toThrow('Failed to update skill');
      });
    });

    describe('publishSkill', () => {
      it('should publish a draft skill', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'publish-me' }));
        expect(created.status).toBe('draft');

        const published = await service.publishSkill(created.id);
        expect(published.status).toBe('published');
      });

      it('should publish a review skill', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'review-skill' }));
        await service.updateSkill(created.id, { status: 'review' });

        const published = await service.publishSkill(created.id);
        expect(published.status).toBe('published');
      });

      it('should throw when skill is already published', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'already-published' }));
        await service.publishSkill(created.id);

        await expect(service.publishSkill(created.id)).rejects.toThrow(SkillServiceError);
        await expect(service.publishSkill(created.id)).rejects.toThrow('Can only publish draft or review skills');
      });

      it('should throw when skill not found', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.publishSkill('nonexistent')).rejects.toThrow(SkillServiceError);
      });
    });

    describe('uninstallSkill', () => {
      it('should uninstall a skill (set status to uninstalled)', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'uninstall-me' }));
        const result = await service.uninstallSkill(created.id);

        expect(result).toBe(true);
      });

      it('should throw when skill not found', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.uninstallSkill('nonexistent')).rejects.toThrow(SkillServiceError);
      });
    });

    describe('installSkill', () => {
      it('should increment install count for published skill', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'install-me' }));
        await service.publishSkill(created.id);

        await service.installSkill(created.id);
        await service.installSkill(created.id);

        expect(repo.incrementInstallCount).toHaveBeenCalledTimes(2);
      });

      it('should throw when skill not found', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.installSkill('nonexistent')).rejects.toThrow(SkillServiceError);
      });

      it('should throw when skill is not published', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'draft-install' }));
        await expect(service.installSkill(created.id)).rejects.toThrow(SkillServiceError);
        await expect(service.installSkill(created.id)).rejects.toThrow('Can only install published skills');
      });
    });
  });

  describe('Version management', () => {
    describe('getVersions', () => {
      it('should return all versions for a skill', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'versioned', version: '1.0.0' }));
        await service.createVersion(created.id, { version: '1.1.0', changelog: 'New features' });
        await service.createVersion(created.id, { version: '1.2.0', changelog: 'More features' });

        const result = await service.getVersions(created.id);
        expect(result.length).toBe(3);
        expect(result[0].version).toBe('1.2.0');
        expect(result[0].is_latest).toBe(true);
      });

      it('should throw when skill not found', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.getVersions('nonexistent')).rejects.toThrow(SkillServiceError);
      });
    });

    describe('getLatestVersion', () => {
      it('should return the latest version', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'latest', version: '1.0.0' }));
        await service.createVersion(created.id, { version: '2.0.0' });

        const latest = await service.getLatestVersion(created.id);
        expect(latest).not.toBeNull();
        expect(latest?.version).toBe('2.0.0');
        expect(latest?.is_latest).toBe(true);
      });

      it('should return null when no versions exist', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'no-versions' }));
        // Clear versions created by createSkill's initial version
        (repo.findLatestVersion as jest.Mock).mockResolvedValue(null);

        const latest = await service.getLatestVersion(created.id);
        expect(latest).toBeNull();
      });
    });

    describe('createVersion', () => {
      it('should create a new version', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'new-version', version: '1.0.0', schema: { v: 1 } }));
        const version = await service.createVersion(created.id, {
          version: '1.1.0',
          changelog: 'Added feature X',
          schema: { v: 2, new_field: true },
        });

        expect(version.version).toBe('1.1.0');
        expect(version.changelog).toBe('Added feature X');
        expect(version.schema).toEqual({ v: 2, new_field: true });
        expect(version.is_latest).toBe(true);
      });

      it('should throw when skill not found', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.createVersion('nonexistent', { version: '1.0.0' })).rejects.toThrow(SkillServiceError);
      });
    });
  });

  describe('Review management', () => {
    describe('getReviews', () => {
      it('should return all reviews for a skill', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'reviewed-skill' }));
        await service.addReview(created.id, { user_id: 'user-1', rating: 5, comment: 'Great!' });
        await service.addReview(created.id, { user_id: 'user-2', rating: 4 });

        const result = await service.getReviews(created.id);
        expect(result.length).toBe(2);
        expect(result[0].rating).toBe(4);
        expect(result[1].rating).toBe(5);
      });

      it('should throw when skill not found', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.getReviews('nonexistent')).rejects.toThrow(SkillServiceError);
      });
    });

    describe('addReview', () => {
      it('should create a review with valid rating', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'rate-me' }));
        const review = await service.addReview(created.id, { user_id: 'reviewer-1', rating: 5, comment: 'Excellent' });

        expect(review.rating).toBe(5);
        expect(review.comment).toBe('Excellent');
        expect(review.user_id).toBe('reviewer-1');
      });

      it('should create review without comment', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'no-comment' }));
        const review = await service.addReview(created.id, { user_id: 'r1', rating: 3 });

        expect(review.rating).toBe(3);
        expect(review.comment).toBeNull();
      });

      it('should throw when rating is 0', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'bad-rating' }));
        await expect(service.addReview(created.id, { user_id: 'r1', rating: 0 })).rejects.toThrow(SkillServiceError);
        await expect(service.addReview(created.id, { user_id: 'r1', rating: 0 })).rejects.toThrow('Rating must be between 1 and 5');
      });

      it('should throw when rating is 6', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'bad-rating-2' }));
        await expect(service.addReview(created.id, { user_id: 'r1', rating: 6 })).rejects.toThrow(SkillServiceError);
      });

      it('should throw when skill not found', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.addReview('nonexistent', { user_id: 'r1', rating: 5 })).rejects.toThrow(SkillServiceError);
      });

      it('should update skill rating after review', async () => {
        const { repo, skills } = makeMockRepository();
        const service = new SkillService(repo);

        const created = await service.createSkill(makeSampleSkillInput({ name: 'rated-skill' }));
        await service.addReview(created.id, { user_id: 'r1', rating: 4 });
        await service.addReview(created.id, { user_id: 'r2', rating: 5 });

        const skill = skills.get(created.id);
        expect(skill?.rating).toBe(4.5);
        expect(skill?.rating_count).toBe(2);
      });
    });
  });

  describe('Search and discovery', () => {
    describe('searchSkills', () => {
      it('should find skills by name', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const s1 = await service.createSkill(makeSampleSkillInput({ name: 'deploy-skill', description: 'Deployment helper' }));
        await service.publishSkill(s1.id);
        const s2 = await service.createSkill(makeSampleSkillInput({ name: 'build-skill', description: 'Build pipeline' }));
        await service.publishSkill(s2.id);

        const results = await service.searchSkills('deploy');
        expect(results.some((s) => s.name === 'deploy-skill')).toBe(true);
        expect(results.every((s) => s.name.includes('deploy') || s.description.toLowerCase().includes('deploy'))).toBe(true);
      });

      it('should find skills by description', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const s1 = await service.createSkill(makeSampleSkillInput({ name: 'skill-a', description: 'Handles deployment pipelines' }));
        await service.publishSkill(s1.id);

        const results = await service.searchSkills('deployment');
        expect(results.some((s) => s.name === 'skill-a')).toBe(true);
      });

      it('should only return published skills', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const draftSkill = await service.createSkill(makeSampleSkillInput({ name: 'draft-search', description: 'Should not appear' }));
        const pubSkill = await service.createSkill(makeSampleSkillInput({ name: 'pub-search', description: 'Should appear' }));
        await service.publishSkill(pubSkill.id);

        const results = await service.searchSkills('search');
        expect(results.some((s) => s.name === 'pub-search')).toBe(true);
        expect(results.some((s) => s.name === 'draft-search')).toBe(false);
      });

      it('should respect limit parameter', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        for (let i = 0; i < 10; i++) {
          const s = await service.createSkill(makeSampleSkillInput({ name: `limit-skill-${i}`, description: `desc ${i}` }));
          await service.publishSkill(s.id);
        }

        const results = await service.searchSkills('limit', 3);
        expect(results.length).toBe(3);
      });
    });

    describe('getCategories', () => {
      it('should return categories with counts', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const s1 = await service.createSkill(makeSampleSkillInput({ name: 'c1', category: 'deploy' }));
        await service.publishSkill(s1.id);
        const s2 = await service.createSkill(makeSampleSkillInput({ name: 'c2', category: 'deploy' }));
        await service.publishSkill(s2.id);
        const s3 = await service.createSkill(makeSampleSkillInput({ name: 'c3', category: 'build' }));
        await service.publishSkill(s3.id);

        const categories = await service.getCategories();
        expect(categories.some((c) => c.category === 'deploy' && c.count === 2)).toBe(true);
        expect(categories.some((c) => c.category === 'build' && c.count === 1)).toBe(true);
      });

      it('should only count published skills', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await service.createSkill(makeSampleSkillInput({ name: 'draft-cat', category: 'testing' }));
        const s2 = await service.createSkill(makeSampleSkillInput({ name: 'pub-cat', category: 'testing' }));
        await service.publishSkill(s2.id);

        const categories = await service.getCategories();
        expect(categories.find((c) => c.category === 'testing')?.count).toBe(1);
      });
    });
  });

  describe('Marketplace', () => {
    describe('getMarketplace', () => {
      it('should return only published skills', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const draft = await service.createSkill(makeSampleSkillInput({ name: 'market-draft' }));
        const published = await service.createSkill(makeSampleSkillInput({ name: 'market-published' }));
        await service.publishSkill(published.id);

        const result = await service.getMarketplace();
        expect(result.data.some((s) => s.name === 'market-published')).toBe(true);
        expect(result.data.some((s) => s.name === 'market-draft')).toBe(false);
      });

      it('should support category filtering', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const s1 = await service.createSkill(makeSampleSkillInput({ name: 'mp-deploy', category: 'deploy' }));
        await service.publishSkill(s1.id);
        const s2 = await service.createSkill(makeSampleSkillInput({ name: 'mp-build', category: 'build' }));
        await service.publishSkill(s2.id);

        const result = await service.getMarketplace({ category: 'deploy' });
        expect(result.data.some((s) => s.name === 'mp-deploy')).toBe(true);
        expect(result.data.some((s) => s.name === 'mp-build')).toBe(false);
      });

      it('should support pagination', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        for (let i = 0; i < 5; i++) {
          const s = await service.createSkill(makeSampleSkillInput({ name: `mp-${i}` }));
          await service.publishSkill(s.id);
        }

        const result = await service.getMarketplace({ page: 1, limit: 2 });
        expect(result.data.length).toBe(2);
        expect(result.total).toBe(5);
      });
    });

    describe('getFeaturedSkills', () => {
      it('should return published skills sorted by popularity', async () => {
        const { repo, skills } = makeMockRepository();
        const service = new SkillService(repo);

        const s1 = await service.createSkill(makeSampleSkillInput({ name: 'featured-1' }));
        await service.publishSkill(s1.id);
        const s2 = await service.createSkill(makeSampleSkillInput({ name: 'featured-2' }));
        await service.publishSkill(s2.id);

        // Manually set install counts
        skills.get(s1.id)!.install_count = 100;
        skills.get(s2.id)!.install_count = 200;

        const result = await service.getFeaturedSkills(10);
        expect(result.length).toBe(2);
        expect(result[0].name).toBe('featured-2');
        expect(result[1].name).toBe('featured-1');
      });

      it('should limit results', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        for (let i = 0; i < 20; i++) {
          const s = await service.createSkill(makeSampleSkillInput({ name: `feat-${i}` }));
          await service.publishSkill(s.id);
        }

        const result = await service.getFeaturedSkills(5);
        expect(result.length).toBe(5);
      });
    });
  });

  describe('Instance management', () => {
    describe('createInstance', () => {
      it('should create a skill instance', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const skill = await service.createSkill(makeSampleSkillInput({ name: 'instance-skill' }));
        const instance = await service.createInstance({
          skill_id: skill.id,
          tenant_id: 'tenant-1',
          name: 'My Instance',
          config: { key: 'value' },
          is_default: true,
        });

        expect(instance.name).toBe('My Instance');
        expect(instance.skill_id).toBe(skill.id);
        expect(instance.tenant_id).toBe('tenant-1');
        expect(instance.config).toEqual({ key: 'value' });
        expect(instance.is_default).toBe(true);
      });

      it('should throw when instance name is empty', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const skill = await service.createSkill(makeSampleSkillInput({ name: 'test-skill' }));
        await expect(
          service.createInstance({ skill_id: skill.id, tenant_id: 't1', name: '' })
        ).rejects.toThrow('Instance name is required');
      });

      it('should throw when skill does not exist', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(
          service.createInstance({ skill_id: 'nonexistent', tenant_id: 't1', name: 'inst' })
        ).rejects.toThrow('Skill not found');
      });

      it('should unset existing default when creating a new default instance', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const skill = await service.createSkill(makeSampleSkillInput({ name: 'default-skill' }));
        const inst1 = await service.createInstance({
          skill_id: skill.id,
          tenant_id: 't1',
          name: 'First',
          is_default: true,
        });
        expect(inst1.is_default).toBe(true);

        const inst2 = await service.createInstance({
          skill_id: skill.id,
          tenant_id: 't1',
          name: 'Second',
          is_default: true,
        });

        expect(inst2.is_default).toBe(true);
        expect(repo.updateInstance).toHaveBeenCalledWith(inst1.id, { is_default: false });
      });
    });

    describe('getInstance', () => {
      it('should return instance by ID', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const skill = await service.createSkill(makeSampleSkillInput({ name: 'get-inst-skill' }));
        const created = await service.createInstance({
          skill_id: skill.id,
          tenant_id: 't1',
          name: 'Get Me',
        });

        const result = await service.getInstance(created.id);
        expect(result.name).toBe('Get Me');
      });

      it('should throw when instance not found', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.getInstance('nonexistent')).rejects.toThrow('Skill instance not found');
      });
    });

    describe('updateInstance', () => {
      it('should update instance fields', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const skill = await service.createSkill(makeSampleSkillInput({ name: 'update-inst-skill' }));
        const created = await service.createInstance({
          skill_id: skill.id,
          tenant_id: 't1',
          name: 'Update Me',
          config: { old: 'config' },
        });

        const updated = await service.updateInstance(created.id, {
          name: 'Updated Name',
          config: { new: 'config' },
        });

        expect(updated.name).toBe('Updated Name');
        expect(updated.config).toEqual({ new: 'config' });
      });

      it('should throw when instance not found', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.updateInstance('nonexistent', { name: 'x' })).rejects.toThrow('Skill instance not found');
      });
    });

    describe('deleteInstance', () => {
      it('should delete an instance', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const skill = await service.createSkill(makeSampleSkillInput({ name: 'delete-inst-skill' }));
        const created = await service.createInstance({
          skill_id: skill.id,
          tenant_id: 't1',
          name: 'Delete Me',
        });

        await service.deleteInstance(created.id);
        expect(repo.deleteInstance).toHaveBeenCalledWith(created.id);
      });

      it('should throw when instance not found', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.deleteInstance('nonexistent')).rejects.toThrow('Skill instance not found');
      });
    });

    describe('listInstances', () => {
      it('should list instances for a skill', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const skill = await service.createSkill(makeSampleSkillInput({ name: 'list-inst-skill' }));
        await service.createInstance({ skill_id: skill.id, tenant_id: 't1', name: 'Inst 1' });
        await service.createInstance({ skill_id: skill.id, tenant_id: 't1', name: 'Inst 2' });

        const result = await service.listInstances(skill.id, 't1');
        expect(result.length).toBe(2);
        expect(result.some((r) => r.name === 'Inst 1')).toBe(true);
        expect(result.some((r) => r.name === 'Inst 2')).toBe(true);
      });
    });
  });

  describe('Version locking', () => {
    describe('lockVersion', () => {
      it('should lock a version', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const skill = await service.createSkill(makeSampleSkillInput({ name: 'lock-skill' }));
        const ver = await service.createVersion(skill.id, { version: '1.1.0' });

        const locked = await service.lockVersion(ver.id);
        expect(locked.is_locked).toBe(true);
      });

      it('should throw when version not found', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.lockVersion('nonexistent')).rejects.toThrow('Skill version not found');
      });
    });

    describe('unlockVersion', () => {
      it('should unlock a version', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const skill = await service.createSkill(makeSampleSkillInput({ name: 'unlock-skill' }));
        const ver = await service.createVersion(skill.id, { version: '1.1.0' });
        await service.lockVersion(ver.id);

        const unlocked = await service.unlockVersion(ver.id);
        expect(unlocked.is_locked).toBe(false);
      });
    });

    describe('recordVersion', () => {
      it('should record a version snapshot', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        const skill = await service.createSkill(makeSampleSkillInput({ name: 'record-skill', schema: { v: 3 } }));
        const ver = await service.recordVersion(skill.id, '2.0.0', 'Major update');

        expect(ver.version).toBe('2.0.0');
        expect(ver.changelog).toBe('Major update');
        expect(ver.schema_snapshot).toEqual({ v: 3 });
      });

      it('should throw when skill not found', async () => {
        const { repo } = makeMockRepository();
        const service = new SkillService(repo);

        await expect(service.recordVersion('nonexistent', '1.0.0')).rejects.toThrow('Skill not found');
      });
    });

    describe('createVersion with version lock', () => {
      it('should throw when skill is version-locked', async () => {
        const { repo, skills } = makeMockRepository();
        const service = new SkillService(repo);

        const skill = await service.createSkill(makeSampleSkillInput({ name: 'locked-skill' }));
        // Manually set version lock
        skills.get(skill.id)!.is_version_locked = true;

        try {
          await service.createVersion(skill.id, { version: '1.1.0' });
          fail('Should have thrown');
        } catch (err) {
          expect((err as SkillServiceError).code).toBe('VERSION_LOCKED');
        }
      });
    });
  });

  describe('Error handling', () => {
    it('SkillServiceError should have correct name', () => {
      const err = new SkillServiceError('test error', 'TEST_CODE');
      expect(err.name).toBe('SkillServiceError');
      expect(err.message).toBe('test error');
      expect(err.code).toBe('TEST_CODE');
      expect(err).toBeInstanceOf(Error);
    });

    it('SkillServiceError should have custom code', () => {
      const err = new SkillServiceError('validation failed', 'INVALID_INPUT');
      expect(err.code).toBe('INVALID_INPUT');
    });
  });

  // ==================== Execution ====================

  describe('executeSkill', () => {
    it('should execute a skill and return completed execution', async () => {
      const { repo, skills } = makeMockRepository();
      const service = new SkillService(repo);
      const skill = await repo.create(makeSampleSkillInput());
      skill.status = 'published';
      skills.set(skill.id, skill);

      const result = await service.executeSkill(skill.id, {
        tenantId: 't1',
        userId: 'u1',
        capability: 'ai.code-gen',
      });

      expect(result).toBeDefined();
      expect(repo.createExecution).toHaveBeenCalledWith(
        expect.objectContaining({ skill_id: skill.id })
      );
      expect(repo.createExecution).toHaveBeenCalled();
      expect(repo.createAuditLog).toHaveBeenCalled();
    });

    it('should throw when skill not found', async () => {
      const { repo } = makeMockRepository();
      const service = new SkillService(repo);

      await expect(service.executeSkill('missing', { tenantId: 't1' }))
        .rejects.toThrow('Skill not found');
    });

    it('should verify instance belongs to tenant', async () => {
      const { repo, skills } = makeMockRepository();
      const service = new SkillService(repo);
      const skill = await repo.create(makeSampleSkillInput());
      skill.status = 'published';
      skills.set(skill.id, skill);

      // Mock findInstanceByIdAndTenant to return null for wrong tenant
      repo.findInstanceByIdAndTenant.mockResolvedValueOnce(null);

      await expect(service.executeSkill(skill.id, {
        tenantId: 't1',
        instanceId: 'inst-1',
      })).rejects.toThrow('Skill instance not found or not accessible');
    });
  });

  describe('getExecutions', () => {
    it('should return paginated executions', async () => {
      const { repo } = makeMockRepository();
      const service = new SkillService(repo);
      repo.findExecutionsBySkill.mockResolvedValueOnce({ executions: [{ id: 'e1' } as any], total: 1 });

      const result = await service.getExecutions('s1', 't1');
      expect(result.executions).toHaveLength(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('getAllExecutions', () => {
    it('should return all executions for tenant', async () => {
      const { repo } = makeMockRepository();
      const service = new SkillService(repo);
      repo.findExecutionsByTenant.mockResolvedValueOnce({ executions: [], total: 0 });

      const result = await service.getAllExecutions('t1');
      expect(result.executions).toHaveLength(0);
    });
  });

  describe('updateExecution', () => {
    it('should update execution status', async () => {
      const { repo } = makeMockRepository();
      const service = new SkillService(repo);

      const result = await service.updateExecution('exec-existing', { status: 'completed' });
      expect(result.status).toBe('completed');
    });

    it('should throw when execution not found', async () => {
      const { repo } = makeMockRepository();
      const service = new SkillService(repo);

      await expect(service.updateExecution('missing', { status: 'completed' }))
        .rejects.toThrow('Execution not found');
    });
  });

  // ==================== Review Workflow ====================

  describe('submitForReview', () => {
    it('should submit draft skill for review', async () => {
      const { repo } = makeMockRepository();
      const service = new SkillService(repo);
      const skill = await repo.create(makeSampleSkillInput());

      const result = await service.submitForReview(skill.id, 'u1');
      expect(result.status).toBe('review');
      expect(repo.createAuditLog).toHaveBeenCalled();
    });

    it('should throw when skill is not draft', async () => {
      const { repo, skills } = makeMockRepository();
      const service = new SkillService(repo);
      const skill = await repo.create(makeSampleSkillInput());
      skill.status = 'published';
      skills.set(skill.id, skill);

      await expect(service.submitForReview(skill.id, 'u1'))
        .rejects.toThrow('Only draft skills can be submitted for review');
    });
  });

  describe('approveSkill', () => {
    it('should approve skill under review', async () => {
      const { repo, skills } = makeMockRepository();
      const service = new SkillService(repo);
      const skill = await repo.create(makeSampleSkillInput());
      skill.status = 'review';
      skills.set(skill.id, skill);

      const result = await service.approveSkill(skill.id, 'u1', 'Looks good');
      expect(result.status).toBe('published');
    });

    it('should throw when skill is not under review', async () => {
      const { repo } = makeMockRepository();
      const service = new SkillService(repo);
      const skill = await repo.create(makeSampleSkillInput());

      await expect(service.approveSkill(skill.id, 'u1'))
        .rejects.toThrow('Only skills under review or rejected can be approved');
    });
  });

  describe('rejectSkill', () => {
    it('should reject skill back to draft', async () => {
      const { repo, skills } = makeMockRepository();
      const service = new SkillService(repo);
      const skill = await repo.create(makeSampleSkillInput());
      skill.status = 'review';
      skills.set(skill.id, skill);

      const result = await service.rejectSkill(skill.id, 'u1', 'Needs work');
      expect(result.status).toBe('draft');
    });

    it('should throw when reason is empty', async () => {
      const { repo } = makeMockRepository();
      const service = new SkillService(repo);

      await expect(service.rejectSkill('s1', 'u1', ''))
        .rejects.toThrow('Rejection reason is required');
    });

    it('should throw when skill is not under review', async () => {
      const { repo } = makeMockRepository();
      const service = new SkillService(repo);
      const skill = await repo.create(makeSampleSkillInput());

      await expect(service.rejectSkill(skill.id, 'u1', 'reason'))
        .rejects.toThrow('Only skills under review can be rejected');
    });
  });

  describe('archiveSkill', () => {
    it('should archive skill', async () => {
      const { repo } = makeMockRepository();
      const service = new SkillService(repo);
      const skill = await repo.create(makeSampleSkillInput());

      const result = await service.archiveSkill(skill.id, 'u1', 'No longer needed');
      expect(result.status).toBe('uninstalled');
    });

    it('should throw when skill is already archived', async () => {
      const { repo, skills } = makeMockRepository();
      const service = new SkillService(repo);
      const skill = await repo.create(makeSampleSkillInput());
      skill.status = 'uninstalled';
      skills.set(skill.id, skill);

      await expect(service.archiveSkill(skill.id, 'u1'))
        .rejects.toThrow('Skill is already archived');
    });
  });

  describe('getPendingReview', () => {
    it('should return skills pending review', async () => {
      const { repo } = makeMockRepository();
      const service = new SkillService(repo);
      repo.findPendingReview.mockResolvedValueOnce({ skills: [{ id: 's1' } as any], total: 1 });

      const result = await service.getPendingReview();
      expect(result.skills).toHaveLength(1);
    });
  });

  describe('getAuditLog', () => {
    it('should return audit log for skill', async () => {
      const { repo } = makeMockRepository();
      const service = new SkillService(repo);
      const skill = await repo.create(makeSampleSkillInput());
      repo.findAuditLogs.mockResolvedValueOnce({ logs: [{ id: 'a1' } as any], total: 1 });

      const result = await service.getAuditLog(skill.id);
      expect(result.logs).toHaveLength(1);
    });
  });

  describe('getAllAuditLogs', () => {
    it('should return all audit logs', async () => {
      const { repo } = makeMockRepository();
      const service = new SkillService(repo);
      repo.findAllAuditLogs.mockResolvedValueOnce({ logs: [{ id: 'a1' } as any], total: 1 });

      const result = await service.getAllAuditLogs();
      expect(result.logs).toHaveLength(1);
    });
  });

  // ==================== Additional Instance Tests ====================

  describe('listInstancesByTenant', () => {
    it('should return instances for tenant', async () => {
      const { repo } = makeMockRepository();
      const service = new SkillService(repo);

      const result = await service.listInstancesByTenant('t1');
      expect(result).toBeDefined();
    });
  });

  describe('deleteInstance with failure', () => {
    it('should throw when delete fails', async () => {
      const { repo, instances } = makeMockRepository();
      const service = new SkillService(repo);
      const instance = await repo.createInstance({
        skill_id: 's1',
        tenant_id: 't1',
        name: 'test',
      });
      // Mock delete to return false
      repo.deleteInstance.mockResolvedValueOnce(false);

      await expect(service.deleteInstance(instance.id))
        .rejects.toThrow('Failed to delete instance');
    });
  });

  describe('unlockVersion not found', () => {
    it('should throw when version not found', async () => {
      const { repo } = makeMockRepository();
      const service = new SkillService(repo);
      repo.unlockVersion.mockResolvedValueOnce(null);

      await expect(service.unlockVersion('missing'))
        .rejects.toThrow('Skill version not found');
    });
  });
});
