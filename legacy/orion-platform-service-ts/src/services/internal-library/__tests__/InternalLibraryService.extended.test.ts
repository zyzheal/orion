/**
 * InternalLibraryService Extended Tests
 *
 * Additional coverage for edge cases, boundary conditions,
 * error paths, and field mapping scenarios not in the base test.
 */

import { InternalLibraryService } from '../InternalLibraryService';
import { OrionError, ErrorCode } from '../../../errors';
import type {
  CreateLibraryInput,
  PublishVersionInput,
  LibraryLanguage,
} from '../../../models/InternalLibrary';

// ==================== Helpers ====================

function makeSnakeLibRow(overrides: Record<string, any> = {}) {
  return {
    id: 'lib-ext-1',
    tenant_id: null,
    name: 'ext-lib',
    display_name: 'Extended Lib',
    description: 'An extended test library',
    language: 'java',
    status: 'active',
    owner: 'team-ext',
    maintainers: ['user-a'],
    repository: 'https://github.com/org/ext-lib',
    documentation: 'https://docs.example.com/ext-lib',
    sla: '99.5%',
    current_version: '2.0.0',
    latest_stable_version: '2.0.0',
    versions: [
      { version: '1.0.0', status: 'stable', released_at: new Date('2024-06-01') },
      { version: '2.0.0', status: 'stable', released_at: new Date('2025-01-15') },
    ],
    breaking_changes: [
      {
        version: '2.0.0',
        changes: ['Removed deprecated API'],
        migrationGuide: 'See wiki',
        deprecationPeriod: '6 months',
        announcedAt: new Date('2024-10-01'),
        effectiveAt: new Date('2025-01-15'),
      },
    ],
    dependents_total: 10,
    dependents_teams: 3,
    dependents_using_latest: 7,
    dependents_needing_upgrade: 3,
    dependents_list: [],
    quality_test_coverage: 0.92,
    quality_security_score: 95,
    quality_open_issues: 1,
    quality_open_prs: 0,
    quality_last_release_age: 14,
    publish_repository: 'https://maven.example.com',
    publish_auto_publish: true,
    publish_require_approval: false,
    publish_approvers: ['lead-1', 'lead-2'],
    labels: { project: 'core', env: 'prod' },
    annotations: { reviewed: '2025-05-01' },
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2025-01-15'),
    ...overrides,
  };
}

function makeDbThatReturns(rows: any[], rowCount?: number) {
  return {
    query: jest.fn(async () => ({ rows, rowCount: rowCount ?? rows.length })),
  };
}

function makeDbForInsert(insertedRow: any) {
  return {
    query: jest.fn(async (text: string) => {
      if (text.includes('INSERT')) {
        return { rows: [insertedRow], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
}

function makeVersionRow(overrides: Record<string, any> = {}) {
  return {
    id: 'ver-ext-1',
    library_id: 'lib-ext-1',
    version: '2.1.0',
    status: 'stable',
    released_at: new Date('2025-06-01'),
    changelog: 'Performance improvements',
    security_score: 92,
    vulnerabilities: [{ severity: 'low', count: 1 }],
    test_coverage: 0.88,
    eol_date: null,
    deprecation_reason: null,
    migration_guide: null,
    published_to: ['maven-central'],
    artifact_id: 'art-001',
    created_at: new Date('2025-06-01'),
    ...overrides,
  };
}

function makeDepRow(overrides: Record<string, any> = {}) {
  return {
    id: 'dep-ext-1',
    library_id: 'lib-ext-1',
    repo_name: 'consumer-app',
    team_name: 'team-consumer',
    current_version: '1.5.0',
    latest_compatible_version: '2.0.0',
    upgrade_available: true,
    upgrade_type: 'major',
    last_updated: new Date('2025-05-01'),
    created_at: new Date('2024-08-01'),
    ...overrides,
  };
}

function makeCamelLibEntity(overrides: Record<string, any> = {}) {
  return {
    id: 'lib-ext-1',
    tenantId: null,
    name: 'ext-lib',
    displayName: 'Extended Lib',
    description: 'An extended test library',
    language: 'java',
    status: 'active',
    owner: 'team-ext',
    maintainers: ['user-a'],
    repository: 'https://github.com/org/ext-lib',
    documentation: 'https://docs.example.com/ext-lib',
    sla: '99.5%',
    currentVersion: '2.0.0',
    latestStableVersion: '2.0.0',
    versions: [
      { version: '1.0.0', status: 'stable', releasedAt: new Date('2024-06-01') },
      { version: '2.0.0', status: 'stable', releasedAt: new Date('2025-01-15') },
    ],
    breakingChanges: [
      {
        version: '2.0.0',
        changes: ['Removed deprecated API'],
        migrationGuide: 'See wiki',
        deprecationPeriod: '6 months',
        announcedAt: new Date('2024-10-01'),
        effectiveAt: new Date('2025-01-15'),
      },
    ],
    dependentsTotal: 10,
    dependentsTeams: 3,
    dependentsUsingLatest: 7,
    dependentsNeedingUpgrade: 3,
    dependentsList: [],
    qualityTestCoverage: 0.92,
    qualitySecurityScore: 95,
    qualityOpenIssues: 1,
    qualityOpenPRs: 0,
    qualityLastReleaseAge: 14,
    publishRepository: 'https://maven.example.com',
    publishAutoPublish: true,
    publishRequireApproval: false,
    publishApprovers: ['lead-1', 'lead-2'],
    labels: { project: 'core', env: 'prod' },
    annotations: { reviewed: '2025-05-01' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2025-01-15'),
    ...overrides,
  };
}

function makeCamelVersionEntity(overrides: Record<string, any> = {}) {
  return {
    id: 'ver-ext-1',
    libraryId: 'lib-ext-1',
    version: '2.1.0',
    status: 'stable',
    releasedAt: new Date('2025-06-01'),
    changelog: 'Performance improvements',
    securityScore: 92,
    vulnerabilities: [{ severity: 'low', count: 1 }],
    testCoverage: 0.88,
    eolDate: null,
    deprecationReason: null,
    migrationGuide: null,
    publishedTo: ['maven-central'],
    artifactId: 'art-001',
    createdAt: new Date('2025-06-01'),
    ...overrides,
  };
}

// ==================== Test Suite ====================

describe('InternalLibraryService - Extended Tests', () => {
  // ==================== Constructor ====================

  describe('Constructor initialization', () => {
    it('should not throw when constructed without db', () => {
      expect(() => new InternalLibraryService()).not.toThrow();
    });

    it('should not throw when constructed with db', () => {
      const db = { query: jest.fn() };
      expect(() => new InternalLibraryService(db)).not.toThrow();
    });
  });

  // ==================== create edge cases ====================

  describe('create - edge cases', () => {
    it('should create with each supported language', async () => {
      const languages: LibraryLanguage[] = ['java', 'node', 'python', 'go', 'rust', 'dotnet'];

      for (const language of languages) {
        const insertedRow = makeSnakeLibRow({ language, name: `lib-${language}` });
        const db = makeDbForInsert(insertedRow);
        const service = new InternalLibraryService(db);

        const input: CreateLibraryInput = {
          name: `lib-${language}`,
          language,
          owner: 'team-test',
          repository: 'https://github.com/test/repo',
        };

        const result = await service.create(input);
        expect(result.language).toBe(language);
        expect(result.name).toBe(`lib-${language}`);
      }
    });

    it('should create with tenantId when provided', async () => {
      const insertedRow = makeSnakeLibRow({ tenant_id: 'tenant-abc' });
      const db = makeDbForInsert(insertedRow);
      const service = new InternalLibraryService(db);

      const input: CreateLibraryInput = {
        name: 'tenant-lib',
        language: 'java',
        owner: 'team-x',
        repository: 'https://github.com/test/repo',
        tenantId: 'tenant-abc',
      };

      const result = await service.create(input);
      expect(result.tenantId).toBe('tenant-abc');
    });

    it('should set tenantId to undefined when null in db', async () => {
      const insertedRow = makeSnakeLibRow({ tenant_id: null });
      const db = makeDbForInsert(insertedRow);
      const service = new InternalLibraryService(db);

      const input: CreateLibraryInput = {
        name: 'no-tenant-lib',
        language: 'go',
        owner: 'team-y',
        repository: 'https://github.com/test/repo',
      };

      const result = await service.create(input);
      expect(result.tenantId).toBeUndefined();
    });

    it('should handle empty publishConfig gracefully', async () => {
      const insertedRow = makeSnakeLibRow({
        publish_repository: null,
        publish_auto_publish: false,
        publish_require_approval: true,
        publish_approvers: [],
      });
      const db = makeDbForInsert(insertedRow);
      const service = new InternalLibraryService(db);

      const input: CreateLibraryInput = {
        name: 'no-publish-lib',
        language: 'python',
        owner: 'team-z',
        repository: 'https://github.com/test/repo',
      };

      const result = await service.create(input);
      expect(result.publishConfig?.autoPublish).toBe(false);
      expect(result.publishConfig?.requireApproval).toBe(true);
      expect(result.publishConfig?.approvers).toEqual([]);
    });

    it('should handle empty maintainers array', async () => {
      const insertedRow = makeSnakeLibRow({ maintainers: [] });
      const db = makeDbForInsert(insertedRow);
      const service = new InternalLibraryService(db);

      const input: CreateLibraryInput = {
        name: 'solo-lib',
        language: 'rust',
        owner: 'solo-dev',
        repository: 'https://github.com/test/repo',
        maintainers: [],
      };

      const result = await service.create(input);
      expect(result.maintainers).toEqual([]);
    });

    it('should handle empty labels gracefully', async () => {
      const insertedRow = makeSnakeLibRow({ labels: {} });
      const db = makeDbForInsert(insertedRow);
      const service = new InternalLibraryService(db);

      const input: CreateLibraryInput = {
        name: 'no-labels-lib',
        language: 'dotnet',
        owner: 'team-dotnet',
        repository: 'https://github.com/test/repo',
      };

      const result = await service.create(input);
      expect(result.labels).toEqual({});
    });

    it('should throw OrionError with SERVICE_UNAVAILABLE code when no db', async () => {
      const service = new InternalLibraryService();

      const input: CreateLibraryInput = {
        name: 'test',
        language: 'java',
        owner: 'team',
        repository: 'https://github.com/test',
      };

      try {
        await service.create(input);
        fail('Expected OrionError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(OrionError);
        expect(err.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      }
    });
  });

  // ==================== getByName edge cases ====================

  describe('getByName - edge cases', () => {
    it('should return undefined when name not found', async () => {
      const db = makeDbThatReturns([]);
      const service = new InternalLibraryService(db);

      const result = await service.getByName('nonexistent-lib');
      expect(result).toBeUndefined();
    });

    it('should return mapped library when found', async () => {
      const db = makeDbThatReturns([makeSnakeLibRow({ name: 'found-lib' })]);
      const service = new InternalLibraryService(db);

      const result = await service.getByName('found-lib');
      expect(result).toBeDefined();
      expect(result?.name).toBe('found-lib');
    });
  });

  // ==================== list edge cases ====================

  describe('list - edge cases', () => {
    it('should return empty array when no libraries match', async () => {
      const db = makeDbThatReturns([]);
      const service = new InternalLibraryService(db);

      const result = await service.list({ language: 'rust' });
      expect(result).toEqual([]);
    });

    it('should pass query options to repository', async () => {
      const db = makeDbThatReturns([makeSnakeLibRow()]);
      const service = new InternalLibraryService(db);

      await service.list({
        language: 'java',
        status: 'active',
        owner: 'team-ext',
        name: 'ext',
        limit: 5,
        offset: 10,
        sortBy: 'name',
        sortOrder: 'ASC',
      });

      expect(db.query).toHaveBeenCalled();
      const call = db.query.mock.calls[0];
      const sql = call[0] as string;
      expect(sql).toContain('LIMIT');
      expect(sql).toContain('OFFSET');
    });

    it('should handle empty options object', async () => {
      const db = makeDbThatReturns([makeSnakeLibRow()]);
      const service = new InternalLibraryService(db);

      const result = await service.list({});
      expect(result.length).toBe(1);
    });
  });

  // ==================== listByLanguage edge cases ====================

  describe('listByLanguage - edge cases', () => {
    it('should return empty when no libraries for language', async () => {
      const db = makeDbThatReturns([]);
      const service = new InternalLibraryService(db);

      const result = await service.listByLanguage('rust');
      expect(result).toEqual([]);
    });

    it('should return multiple libraries for same language', async () => {
      const db = makeDbThatReturns([
        makeSnakeLibRow({ id: 'lib-1', name: 'lib-1' }),
        makeSnakeLibRow({ id: 'lib-2', name: 'lib-2' }),
      ]);
      const service = new InternalLibraryService(db);

      const result = await service.listByLanguage('java');
      expect(result.length).toBe(2);
    });
  });

  // ==================== listByOwner edge cases ====================

  describe('listByOwner - edge cases', () => {
    it('should return empty when no libraries for owner', async () => {
      const db = makeDbThatReturns([]);
      const service = new InternalLibraryService(db);

      const result = await service.listByOwner('unknown-team');
      expect(result).toEqual([]);
    });
  });

  // ==================== delete edge cases ====================

  describe('delete - edge cases', () => {
    it('should return true when delete succeeds', async () => {
      const db = { query: jest.fn(async () => ({ rows: [], rowCount: 1 })) };
      const service = new InternalLibraryService(db);

      const result = await service.delete('lib-ext-1');
      expect(result).toBe(true);
    });

    it('should return false when id not found (rowCount 0)', async () => {
      const db = { query: jest.fn(async () => ({ rows: [], rowCount: 0 })) };
      const service = new InternalLibraryService(db);

      const result = await service.delete('nonexistent-id');
      expect(result).toBe(false);
    });
  });

  // ==================== publishVersion edge cases ====================

  describe('publishVersion - edge cases', () => {
    it('should throw OrionError NOT_FOUND when library does not exist', async () => {
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [], rowCount: 0 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const input: PublishVersionInput = {
        libraryId: 'nonexistent',
        version: '1.0.0',
      };

      try {
        await service.publishVersion(input);
        fail('Expected OrionError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(OrionError);
        expect(err.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('should publish with alpha status', async () => {
      const libRow = makeSnakeLibRow();
      const verRow = makeVersionRow({ version: '3.0.0-alpha.1', status: 'alpha' });
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [libRow], rowCount: 1 };
          }
          if (text.includes('INSERT INTO library_versions')) {
            return { rows: [verRow], rowCount: 1 };
          }
          if (text.includes('UPDATE internal_libraries')) {
            return { rows: [libRow], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.publishVersion({
        libraryId: 'lib-ext-1',
        version: '3.0.0-alpha.1',
        status: 'alpha',
      });

      expect(result.status).toBe('alpha');
    });

    it('should publish with beta status', async () => {
      const libRow = makeSnakeLibRow();
      const verRow = makeVersionRow({ version: '3.0.0-beta.1', status: 'beta' });
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [libRow], rowCount: 1 };
          }
          if (text.includes('INSERT INTO library_versions')) {
            return { rows: [verRow], rowCount: 1 };
          }
          if (text.includes('UPDATE internal_libraries')) {
            return { rows: [libRow], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.publishVersion({
        libraryId: 'lib-ext-1',
        version: '3.0.0-beta.1',
        status: 'beta',
      });

      expect(result.status).toBe('beta');
    });

    it('should publish with rc status', async () => {
      const libRow = makeSnakeLibRow();
      const verRow = makeVersionRow({ version: '3.0.0-rc.1', status: 'rc' });
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [libRow], rowCount: 1 };
          }
          if (text.includes('INSERT INTO library_versions')) {
            return { rows: [verRow], rowCount: 1 };
          }
          if (text.includes('UPDATE internal_libraries')) {
            return { rows: [libRow], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.publishVersion({
        libraryId: 'lib-ext-1',
        version: '3.0.0-rc.1',
        status: 'rc',
      });

      expect(result.status).toBe('rc');
    });

    it('should default to stable status when not specified', async () => {
      const libRow = makeSnakeLibRow();
      const verRow = makeVersionRow({ status: 'stable' });
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [libRow], rowCount: 1 };
          }
          if (text.includes('INSERT INTO library_versions')) {
            return { rows: [verRow], rowCount: 1 };
          }
          if (text.includes('UPDATE internal_libraries')) {
            return { rows: [libRow], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.publishVersion({
        libraryId: 'lib-ext-1',
        version: '2.1.0',
      });

      expect(result.status).toBe('stable');
    });

    it('should include all optional fields in published version', async () => {
      const libRow = makeSnakeLibRow();
      const verRow = makeVersionRow({
        version: '2.2.0',
        changelog: 'Major improvements',
        security_score: 97,
        test_coverage: 0.95,
        published_to: ['maven-central', 'nexus'],
        artifact_id: 'art-002',
      });
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [libRow], rowCount: 1 };
          }
          if (text.includes('INSERT INTO library_versions')) {
            return { rows: [verRow], rowCount: 1 };
          }
          if (text.includes('UPDATE internal_libraries')) {
            return { rows: [libRow], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.publishVersion({
        libraryId: 'lib-ext-1',
        version: '2.2.0',
        status: 'stable',
        changelog: 'Major improvements',
        securityScore: 97,
        testCoverage: 0.95,
        publishedTo: ['maven-central', 'nexus'],
        artifactId: 'art-002',
      });

      expect(result.changelog).toBe('Major improvements');
      expect(result.securityScore).toBe(97);
      expect(result.testCoverage).toBe(0.95);
      expect(result.publishedTo).toEqual(['maven-central', 'nexus']);
      expect(result.artifactId).toBe('art-002');
    });

    it('should set latestStableVersion to new version when publishing stable', async () => {
      const libRow = makeSnakeLibRow({ latest_stable_version: '2.0.0' });
      let updatedLatest = '';
      const db = {
        query: jest.fn(async (text: string, params?: unknown[]) => {
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [libRow], rowCount: 1 };
          }
          if (text.includes('INSERT INTO library_versions')) {
            return { rows: [makeVersionRow()], rowCount: 1 };
          }
          if (text.includes('UPDATE internal_libraries SET current_version')) {
            updatedLatest = params?.[1] as string;
            return { rows: [libRow], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      await service.publishVersion({
        libraryId: 'lib-ext-1',
        version: '2.1.0',
        status: 'stable',
      });

      expect(updatedLatest).toBe('2.1.0');
    });

    it('should keep existing latestStableVersion when publishing non-stable', async () => {
      const libRow = makeSnakeLibRow({ latest_stable_version: '2.0.0' });
      let updatedLatest = '';
      const db = {
        query: jest.fn(async (text: string, params?: unknown[]) => {
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [libRow], rowCount: 1 };
          }
          if (text.includes('INSERT INTO library_versions')) {
            return { rows: [makeVersionRow({ status: 'alpha' })], rowCount: 1 };
          }
          if (text.includes('UPDATE internal_libraries SET current_version')) {
            updatedLatest = params?.[1] as string;
            return { rows: [libRow], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      await service.publishVersion({
        libraryId: 'lib-ext-1',
        version: '3.0.0-alpha.1',
        status: 'alpha',
      });

      expect(updatedLatest).toBe('2.0.0');
    });

    it('should throw SERVICE_UNAVAILABLE when no db', async () => {
      const service = new InternalLibraryService();

      try {
        await service.publishVersion({ libraryId: 'lib-1', version: '1.0.0' });
        fail('Expected OrionError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(OrionError);
        expect(err.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      }
    });
  });

  // ==================== getVersion edge cases ====================

  describe('getVersion - edge cases', () => {
    it('should return undefined when version not found', async () => {
      const db = makeDbThatReturns([]);
      const service = new InternalLibraryService(db);

      const result = await service.getVersion('lib-1', '9.9.9');
      expect(result).toBeUndefined();
    });

    it('should map all version fields correctly', async () => {
      const verRow = makeVersionRow({
        version: '2.1.0',
        status: 'stable',
        changelog: 'Bug fixes',
        security_score: 88,
        vulnerabilities: [{ severity: 'high', count: 2 }],
        test_coverage: 0.9,
        published_to: ['npm', 'maven'],
        artifact_id: 'art-xyz',
      });
      const db = makeDbThatReturns([verRow]);
      const service = new InternalLibraryService(db);

      const result = await service.getVersion('lib-ext-1', '2.1.0');
      expect(result).toBeDefined();
      expect(result?.version).toBe('2.1.0');
      expect(result?.status).toBe('stable');
      expect(result?.changelog).toBe('Bug fixes');
      expect(result?.securityScore).toBe(88);
      expect(result?.testCoverage).toBe(0.9);
      expect(result?.publishedTo).toEqual(['npm', 'maven']);
      expect(result?.artifactId).toBe('art-xyz');
    });
  });

  // ==================== deprecateVersion edge cases ====================

  describe('deprecateVersion - edge cases', () => {
    it('should handle migrationGuide parameter', async () => {
      const verRow = makeVersionRow({ version: '1.0.0' });
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM library_versions WHERE library_id')) {
            return { rows: [verRow], rowCount: 1 };
          }
          if (text.includes('UPDATE library_versions SET status')) {
            return { rows: [{ ...verRow, status: 'deprecated' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.deprecateVersion(
        'lib-ext-1',
        '1.0.0',
        'End of life',
        new Date('2026-01-01'),
        'Migrate to 2.0.0 using the upgrade guide'
      );

      expect(result).not.toBeNull();
      expect(result?.status).toBe('deprecated');
    });

    it('should return null when versionRepo not available', async () => {
      const service = new InternalLibraryService();
      const result = await service.deprecateVersion('lib-1', '1.0.0', 'old', new Date());
      expect(result).toBeNull();
    });
  });

  // ==================== deprecate edge cases ====================

  describe('deprecate - edge cases', () => {
    it('should map all fields after deprecation', async () => {
      const libRow = makeSnakeLibRow({ status: 'deprecated' });
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [makeSnakeLibRow()], rowCount: 1 };
          }
          if (text.includes('UPDATE internal_libraries SET status')) {
            return { rows: [libRow], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.deprecate({
        libraryId: 'lib-ext-1',
        reason: 'Security vulnerabilities',
        eolDate: new Date('2026-06-01'),
        migrationGuide: 'See migration docs',
        replacementLibrary: 'new-secure-lib',
      });

      expect(result).not.toBeNull();
      expect(result?.status).toBe('deprecated');
      expect(result?.name).toBe('ext-lib');
      expect(result?.owner).toBe('team-ext');
    });
  });

  // ==================== getDependents edge cases ====================

  describe('getDependents - edge cases', () => {
    it('should return multiple dependents', async () => {
      const deps = [
        makeDepRow({ id: 'dep-1', repo_name: 'app-1', team_name: 'team-a' }),
        makeDepRow({ id: 'dep-2', repo_name: 'app-2', team_name: 'team-b' }),
        makeDepRow({ id: 'dep-3', repo_name: 'app-3', team_name: 'team-a' }),
      ];
      const db = makeDbThatReturns(deps);
      const service = new InternalLibraryService(db);

      const result = await service.getDependents('lib-ext-1');
      expect(result.length).toBe(3);
      expect(result[0].repoName).toBe('app-1');
      expect(result[1].repoName).toBe('app-2');
      expect(result[2].repoName).toBe('app-3');
    });

    it('should map upgradeType correctly', async () => {
      const dep = makeDepRow({ upgrade_type: 'major' });
      const db = makeDbThatReturns([dep]);
      const service = new InternalLibraryService(db);

      const result = await service.getDependents('lib-ext-1');
      expect(result[0].upgradeType).toBe('major');
    });

    it('should handle null upgradeType', async () => {
      const dep = makeDepRow({ upgrade_type: null, upgrade_available: false });
      const db = makeDbThatReturns([dep]);
      const service = new InternalLibraryService(db);

      const result = await service.getDependents('lib-ext-1');
      // Service uses `as` cast, null stays null
      expect(result[0].upgradeType).toBeNull();
    });

    it('should handle null latestCompatibleVersion', async () => {
      const dep = makeDepRow({ latest_compatible_version: null });
      const db = makeDbThatReturns([dep]);
      const service = new InternalLibraryService(db);

      const result = await service.getDependents('lib-ext-1');
      expect(result[0].latestCompatibleVersion).toBeUndefined();
    });
  });

  // ==================== addDependent edge cases ====================

  describe('addDependent - edge cases', () => {
    it('should throw SERVICE_UNAVAILABLE when no db', async () => {
      const service = new InternalLibraryService();

      try {
        await service.addDependent('lib-1', 'repo', 'team', '1.0.0');
        fail('Expected OrionError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(OrionError);
        expect(err.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      }
    });

    it('should map all dependent fields correctly', async () => {
      const dep = makeDepRow({
        repo_name: 'new-service',
        team_name: 'team-new',
        current_version: '2.0.0',
        latest_compatible_version: null,
        upgrade_available: false,
        upgrade_type: null,
      });
      const db = makeDbForInsert(dep);
      const service = new InternalLibraryService(db);

      const result = await service.addDependent('lib-ext-1', 'new-service', 'team-new', '2.0.0');
      expect(result.repoName).toBe('new-service');
      expect(result.teamName).toBe('team-new');
      expect(result.currentVersion).toBe('2.0.0');
      expect(result.upgradeAvailable).toBe(false);
      expect(result.lastUpdated).toBeDefined();
    });
  });

  // ==================== updateDependentVersion edge cases ====================

  describe('updateDependentVersion - edge cases', () => {
    it('should detect major upgrade type', async () => {
      const dep = makeDepRow({ repo_name: 'my-app', current_version: '1.0.0' });
      const libRow = makeSnakeLibRow({ latest_stable_version: '3.0.0' });
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM library_dependents WHERE library_id')) {
            return { rows: [dep], rowCount: 1 };
          }
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [libRow], rowCount: 1 };
          }
          if (text.includes('UPDATE library_dependents')) {
            return { rows: [dep], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.updateDependentVersion('lib-ext-1', 'my-app', '2.0.0');
      expect(result).toBe(true);
    });

    it('should detect patch upgrade type', async () => {
      const dep = makeDepRow({ repo_name: 'my-app', current_version: '2.0.0' });
      const libRow = makeSnakeLibRow({ latest_stable_version: '2.0.3' });
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM library_dependents WHERE library_id')) {
            return { rows: [dep], rowCount: 1 };
          }
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [libRow], rowCount: 1 };
          }
          if (text.includes('UPDATE library_dependents')) {
            return { rows: [dep], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.updateDependentVersion('lib-ext-1', 'my-app', '2.0.1');
      expect(result).toBe(true);
    });

    it('should detect no upgrade when version matches latest', async () => {
      const dep = makeDepRow({ repo_name: 'my-app', current_version: '2.0.0' });
      const libRow = makeSnakeLibRow({ latest_stable_version: '2.0.0' });
      let updateCalled = false;
      const db = {
        query: jest.fn(async (text: string, params?: unknown[]) => {
          if (text.includes('SELECT * FROM library_dependents WHERE library_id')) {
            return { rows: [dep], rowCount: 1 };
          }
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [libRow], rowCount: 1 };
          }
          if (text.includes('UPDATE library_dependents')) {
            updateCalled = true;
            // upgrade_available should be false (params[1])
            expect(params?.[1]).toBe(false);
            return { rows: [dep], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.updateDependentVersion('lib-ext-1', 'my-app', '2.0.0');
      expect(result).toBe(true);
      expect(updateCalled).toBe(true);
    });

    it('should handle missing library (latestStableVersion defaults to empty)', async () => {
      const dep = makeDepRow({ repo_name: 'my-app', current_version: '1.0.0' });
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM library_dependents WHERE library_id')) {
            return { rows: [dep], rowCount: 1 };
          }
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [], rowCount: 0 };
          }
          if (text.includes('UPDATE library_dependents')) {
            return { rows: [dep], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.updateDependentVersion('lib-ext-1', 'my-app', '1.5.0');
      expect(result).toBe(true);
    });
  });

  // ==================== checkDependencies edge cases ====================

  describe('checkDependencies - edge cases', () => {
    it('should return empty when no dependents for repo', async () => {
      const db = makeDbThatReturns([]);
      const service = new InternalLibraryService(db);

      const result = await service.checkDependencies('unknown-repo');
      expect(result).toEqual([]);
    });

    it('should skip dependents whose library is not found', async () => {
      const dep = makeDepRow({ library_id: 'missing-lib' });
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM library_dependents WHERE repo_name')) {
            return { rows: [dep], rowCount: 1 };
          }
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [], rowCount: 0 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.checkDependencies('consumer-app');
      expect(result).toEqual([]);
    });

    it('should return upgrade_available with major upgradeType when major version gap', async () => {
      const dep = makeDepRow({
        repo_name: 'consumer-app',
        current_version: '1.0.0',
      });
      const libRow = makeSnakeLibRow({
        status: 'active',
        current_version: '3.0.0',
        latest_stable_version: '3.0.0',
      });
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM library_dependents WHERE repo_name')) {
            return { rows: [dep], rowCount: 1 };
          }
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [libRow], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.checkDependencies('consumer-app');
      expect(result.length).toBe(1);
      // determineUpgradeType returns 'major' not 'breaking', so status is upgrade_available
      expect(result[0].status).toBe('upgrade_available');
      expect(result[0].upgradeType).toBe('major');
    });

    it('should return securityScore from library quality', async () => {
      const dep = makeDepRow({
        repo_name: 'consumer-app',
        current_version: '1.0.0',
      });
      const libRow = makeSnakeLibRow({
        latest_stable_version: '2.0.0',
        quality_security_score: 87,
      });
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM library_dependents WHERE repo_name')) {
            return { rows: [dep], rowCount: 1 };
          }
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [libRow], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.checkDependencies('consumer-app');
      expect(result[0].securityScore).toBe(87);
    });

    it('should handle null securityScore', async () => {
      const dep = makeDepRow({
        repo_name: 'consumer-app',
        current_version: '2.0.0',
      });
      const libRow = makeSnakeLibRow({
        latest_stable_version: '2.0.0',
        quality_security_score: null,
      });
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM library_dependents WHERE repo_name')) {
            return { rows: [dep], rowCount: 1 };
          }
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [libRow], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.checkDependencies('consumer-app');
      expect(result[0].securityScore).toBeUndefined();
    });

    it('should process multiple dependents from different libraries', async () => {
      const deps = [
        makeDepRow({ id: 'dep-1', library_id: 'lib-a', repo_name: 'my-app' }),
        makeDepRow({ id: 'dep-2', library_id: 'lib-b', repo_name: 'my-app', current_version: '2.0.0' }),
      ];
      const libA = makeSnakeLibRow({ id: 'lib-a', name: 'lib-a', latest_stable_version: '2.0.0' });
      const libB = makeSnakeLibRow({ id: 'lib-b', name: 'lib-b', latest_stable_version: '2.0.0' });
      const db = {
        query: jest.fn(async (text: string, params?: unknown[]) => {
          if (text.includes('SELECT * FROM library_dependents WHERE repo_name')) {
            return { rows: deps, rowCount: 2 };
          }
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            const id = params?.[0];
            if (id === 'lib-a') return { rows: [libA], rowCount: 1 };
            if (id === 'lib-b') return { rows: [libB], rowCount: 1 };
            return { rows: [], rowCount: 0 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      const result = await service.checkDependencies('my-app');
      expect(result.length).toBe(2);
      expect(result[0].libraryName).toBe('lib-a');
      expect(result[1].libraryName).toBe('lib-b');
    });
  });

  // ==================== updateDependentsStats edge cases ====================

  describe('updateDependentsStats - edge cases', () => {
    it('should compute stats correctly with mixed versions', async () => {
      const deps = [
        makeDepRow({ id: 'dep-1', team_name: 'team-a', current_version: '2.0.0' }),
        makeDepRow({ id: 'dep-2', team_name: 'team-b', current_version: '1.0.0' }),
        makeDepRow({ id: 'dep-3', team_name: 'team-a', current_version: '2.0.0' }),
      ];
      const libRow = makeSnakeLibRow({ latest_stable_version: '2.0.0' });
      let statsCalled = false;
      const db = {
        query: jest.fn(async (text: string, params?: unknown[]) => {
          if (text.includes('SELECT * FROM library_dependents WHERE library_id')) {
            return { rows: deps, rowCount: 3 };
          }
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [libRow], rowCount: 1 };
          }
          if (text.includes('UPDATE internal_libraries SET')) {
            statsCalled = true;
            // total=3, teams=2, usingLatest=2, needingUpgrade=1
            expect(params?.[0]).toBe(3); // totalRepos
            expect(params?.[1]).toBe(2); // totalTeams
            expect(params?.[2]).toBe(2); // usingLatest
            expect(params?.[3]).toBe(1); // needingUpgrade
            return { rows: [libRow], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      await service.updateDependentsStats('lib-ext-1');
      expect(statsCalled).toBe(true);
    });

    it('should handle empty dependents list', async () => {
      const libRow = makeSnakeLibRow();
      let statsCalled = false;
      const db = {
        query: jest.fn(async (text: string, params?: unknown[]) => {
          if (text.includes('SELECT * FROM library_dependents WHERE library_id')) {
            return { rows: [], rowCount: 0 };
          }
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [libRow], rowCount: 1 };
          }
          if (text.includes('UPDATE internal_libraries SET')) {
            statsCalled = true;
            expect(params?.[0]).toBe(0); // totalRepos
            expect(params?.[1]).toBe(0); // totalTeams
            expect(params?.[2]).toBe(0); // usingLatest
            expect(params?.[3]).toBe(0); // needingUpgrade
            return { rows: [libRow], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      await service.updateDependentsStats('lib-ext-1');
      expect(statsCalled).toBe(true);
    });

    it('should return without error when no db', async () => {
      const service = new InternalLibraryService();
      await expect(service.updateDependentsStats('lib-1')).resolves.toBeUndefined();
    });

    it('should handle library not found (latestVersion defaults to empty)', async () => {
      const deps = [
        makeDepRow({ id: 'dep-1', team_name: 'team-a', current_version: '1.0.0' }),
      ];
      const db = {
        query: jest.fn(async (text: string, params?: unknown[]) => {
          if (text.includes('SELECT * FROM library_dependents WHERE library_id')) {
            return { rows: deps, rowCount: 1 };
          }
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [], rowCount: 0 };
          }
          if (text.includes('UPDATE internal_libraries SET')) {
            // When library not found, latestVersion = '' so none match
            expect(params?.[2]).toBe(0); // usingLatest = 0
            expect(params?.[3]).toBe(1); // needingUpgrade = 1
            return { rows: [], rowCount: 0 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      const service = new InternalLibraryService(db);

      await service.updateDependentsStats('lib-ext-1');
    });
  });

  // ==================== mapEntityToLibrary edge cases ====================

  describe('mapEntityToLibrary - field mapping edge cases', () => {
    let service: InternalLibraryService;

    beforeEach(() => {
      service = new InternalLibraryService();
    });

    it('should map breakingChanges array', () => {
      const entity = makeCamelLibEntity();
      const result = (service as any).mapEntityToLibrary(entity);
      expect(result.breakingChanges).toBeDefined();
      expect(result.breakingChanges.length).toBe(1);
      expect(result.breakingChanges[0].version).toBe('2.0.0');
    });

    it('should map empty breakingChanges', () => {
      const entity = makeCamelLibEntity({ breakingChanges: [] });
      const result = (service as any).mapEntityToLibrary(entity);
      expect(result.breakingChanges).toEqual([]);
    });

    it('should map annotations', () => {
      const entity = makeCamelLibEntity({ annotations: { key: 'value' } });
      const result = (service as any).mapEntityToLibrary(entity);
      expect(result.annotations).toEqual({ key: 'value' });
    });

    it('should map empty dependents section', () => {
      const entity = makeCamelLibEntity({
        dependentsTotal: 0,
        dependentsTeams: 0,
        dependentsUsingLatest: 0,
        dependentsNeedingUpgrade: 0,
        dependentsList: [],
      });
      const result = (service as any).mapEntityToLibrary(entity);
      expect(result.dependents.totalRepos).toBe(0);
      expect(result.dependents.totalTeams).toBe(0);
      expect(result.dependents.reposUsingLatest).toBe(0);
      expect(result.dependents.reposNeedingUpgrade).toBe(0);
      expect(result.dependents.list).toEqual([]);
    });

    it('should handle all quality fields as null', () => {
      const entity = makeCamelLibEntity({
        qualityTestCoverage: null,
        qualitySecurityScore: null,
        qualityOpenIssues: null,
        qualityOpenPRs: null,
        qualityLastReleaseAge: null,
      });
      const result = (service as any).mapEntityToLibrary(entity);
      expect(result.quality.testCoverage).toBeUndefined();
      expect(result.quality.securityScore).toBeUndefined();
      expect(result.quality.openIssues).toBeUndefined();
      expect(result.quality.openPRs).toBeUndefined();
      expect(result.quality.lastReleaseAge).toBeUndefined();
    });

    it('should map all quality fields when populated', () => {
      const entity = makeCamelLibEntity({
        qualityTestCoverage: 0.95,
        qualitySecurityScore: 99,
        qualityOpenIssues: 0,
        qualityOpenPRs: 2,
        qualityLastReleaseAge: 30,
      });
      const result = (service as any).mapEntityToLibrary(entity);
      expect(result.quality.testCoverage).toBe(0.95);
      expect(result.quality.securityScore).toBe(99);
      expect(result.quality.openIssues).toBe(0);
      expect(result.quality.openPRs).toBe(2);
      expect(result.quality.lastReleaseAge).toBe(30);
    });

    it('should map publishConfig with all fields', () => {
      const entity = makeCamelLibEntity({
        publishRepository: 'https://registry.example.com',
        publishAutoPublish: true,
        publishRequireApproval: false,
        publishApprovers: ['admin-1', 'admin-2'],
      });
      const result = (service as any).mapEntityToLibrary(entity);
      expect(result.publishConfig.repository).toBe('https://registry.example.com');
      expect(result.publishConfig.autoPublish).toBe(true);
      expect(result.publishConfig.requireApproval).toBe(false);
      expect(result.publishConfig.approvers).toEqual(['admin-1', 'admin-2']);
    });
  });

  // ==================== mapEntityToVersion edge cases ====================

  describe('mapEntityToVersion - field mapping', () => {
    let service: InternalLibraryService;

    beforeEach(() => {
      service = new InternalLibraryService();
    });

    it('should map all version fields', () => {
      const entity = makeCamelVersionEntity({
        version: '3.0.0',
        status: 'stable',
        changelog: 'Major release',
        securityScore: 95,
        vulnerabilities: [{ severity: 'critical', count: 0 }],
        testCoverage: 0.92,
        publishedTo: ['maven', 'npm'],
        artifactId: 'art-v3',
      });
      const result = (service as any).mapEntityToVersion(entity);
      expect(result.version).toBe('3.0.0');
      expect(result.status).toBe('stable');
      expect(result.changelog).toBe('Major release');
      expect(result.securityScore).toBe(95);
      expect(result.vulnerabilities).toEqual([{ severity: 'critical', count: 0 }]);
      expect(result.testCoverage).toBe(0.92);
      expect(result.publishedTo).toEqual(['maven', 'npm']);
      expect(result.artifactId).toBe('art-v3');
    });

    it('should handle null fields in version entity', () => {
      const entity = makeCamelVersionEntity({
        changelog: null,
        securityScore: null,
        vulnerabilities: [],
        testCoverage: null,
        eolDate: null,
        deprecationReason: null,
        migrationGuide: null,
        publishedTo: [],
        artifactId: null,
      });
      const result = (service as any).mapEntityToVersion(entity);
      expect(result.changelog).toBeNull();
      expect(result.securityScore).toBeNull();
      expect(result.testCoverage).toBeNull();
      expect(result.eolDate).toBeNull();
      expect(result.deprecationReason).toBeNull();
      expect(result.migrationGuide).toBeNull();
      expect(result.artifactId).toBeNull();
    });
  });

  // ==================== determineUpgradeType edge cases ====================

  describe('determineUpgradeType - edge cases', () => {
    let service: InternalLibraryService;

    beforeEach(() => {
      service = new InternalLibraryService();
    });

    it('should return patch when versions are equal', () => {
      const result = (service as any).determineUpgradeType('1.2.3', '1.2.3');
      expect(result).toBe('patch');
    });

    it('should detect major for 0.x to 1.x', () => {
      const result = (service as any).determineUpgradeType('0.9.0', '1.0.0');
      expect(result).toBe('major');
    });

    it('should detect minor for 0.1 to 0.2', () => {
      const result = (service as any).determineUpgradeType('0.1.0', '0.2.0');
      expect(result).toBe('minor');
    });

    it('should detect patch for 1.0.0 to 1.0.9', () => {
      const result = (service as any).determineUpgradeType('1.0.0', '1.0.9');
      expect(result).toBe('patch');
    });

    it('should detect major even when minor also increases', () => {
      const result = (service as any).determineUpgradeType('1.5.3', '2.1.0');
      expect(result).toBe('major');
    });

    it('should detect minor even when patch also increases', () => {
      const result = (service as any).determineUpgradeType('1.2.3', '1.5.7');
      expect(result).toBe('minor');
    });
  });
});
