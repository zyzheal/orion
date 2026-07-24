/**
 * InternalLibraryService Tests
 *
 * Tests for DB-only service: without db returns empty/false/undefined,
 * with mock db tests actual business logic and field mapping.
 */

import { InternalLibraryService } from '../InternalLibraryService';
import type { CreateLibraryInput, PublishVersionInput, DeprecateLibraryInput, LibraryQueryOptions } from '../../../models/InternalLibrary';

// ==================== Mock Helpers ====================

function makeMockDb() {
  const store: Record<string, any[]> = {
    internal_libraries: [],
    library_versions: [],
    library_dependents: [],
  };

  const db = {
    query: jest.fn(async (text: string, params?: unknown[]) => {
      // Very basic mock: just return empty for most queries
      // Specific tests will override behavior as needed
      return { rows: [], rowCount: 0 };
    }),
    store,
  };
  return db;
}

function makeDbWithLibrary(_libData: any) {
  const snakeRow = {
    id: 'lib-1',
    tenant_id: 'tenant-1',
    name: 'test-lib',
    display_name: 'Test Library',
    description: 'A test internal library',
    language: 'node',
    status: 'active',
    owner: 'team-alpha',
    maintainers: ['user-1', 'user-2'],
    repository: 'https://github.com/org/test-lib',
    documentation: 'https://docs.example.com/test-lib',
    sla: '99.9%',
    current_version: '1.2.0',
    latest_stable_version: '1.2.0',
    versions: [
      { version: '1.0.0', status: 'stable', released_at: new Date('2025-01-01') },
      { version: '1.1.0', status: 'stable', released_at: new Date('2025-02-01') },
      { version: '1.2.0', status: 'stable', released_at: new Date('2025-03-01') },
    ],
    breaking_changes: [],
    dependents_total: 5,
    dependents_teams: 2,
    dependents_using_latest: 3,
    dependents_needing_upgrade: 2,
    dependents_list: ['repo-a', 'repo-b'],
    quality_test_coverage: 0.85,
    quality_security_score: 90,
    quality_open_issues: 3,
    quality_open_prs: 1,
    quality_last_release_age: 7,
    publish_repository: 'https://npm.example.com',
    publish_auto_publish: false,
    publish_require_approval: true,
    publish_approvers: ['admin-1'],
    labels: { team: 'alpha', tier: 'core' },
    annotations: { last_reviewed: '2025-04-01' },
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-03-01'),
  };

  return {
    query: jest.fn(async (text: string, params?: unknown[]) => {
      if (text.includes('INSERT INTO internal_libraries')) {
        const insertRow = {
          ...snakeRow,
          id: params?.[0] ?? 'lib-1',
          tenant_id: null,
          name: 'test-lib',
          display_name: 'Test Lib',
          description: 'A test library',
          status: 'development',
          current_version: '',
          latest_stable_version: '',
          versions: [],
          breaking_changes: [],
          dependents_total: 0,
          dependents_teams: 0,
          dependents_using_latest: 0,
          dependents_needing_upgrade: 0,
          dependents_list: [],
          quality_test_coverage: null,
          quality_security_score: null,
          quality_open_issues: 0,
          quality_open_prs: 0,
          quality_last_release_age: null,
          publish_repository: null,
          publish_auto_publish: false,
          publish_require_approval: true,
          publish_approvers: [],
          labels: {},
          annotations: {},
          created_at: new Date(),
          updated_at: new Date(),
        };
        return { rows: [insertRow], rowCount: 1 };
      }
      if (text.includes('UPDATE internal_libraries SET status')) {
        return { rows: [{ ...snakeRow, status: params?.[0] as string }], rowCount: 1 };
      }
      if (text.includes('UPDATE internal_libraries SET current_version')) {
        return { rows: [{ ...snakeRow, current_version: params?.[0], latest_stable_version: params?.[1] }], rowCount: 1 };
      }
      if (text.includes('DELETE FROM internal_libraries')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [snakeRow], rowCount: 1 };
    }),
    updateStatus: (status: string) => ({ ...snakeRow, status }),
  };
}

function makeDbWithVersion(versionData: any) {
  const libSnakeRow = {
    id: 'lib-1',
    tenant_id: null,
    name: 'test-lib',
    display_name: 'Test Lib',
    description: 'A test library',
    language: 'node',
    status: 'active',
    owner: 'team-alpha',
    maintainers: ['user-1'],
    repository: 'https://github.com/test/lib',
    documentation: null,
    sla: null,
    current_version: '1.0.0',
    latest_stable_version: '1.0.0',
    versions: [],
    breaking_changes: [],
    dependents_total: 0,
    dependents_teams: 0,
    dependents_using_latest: 0,
    dependents_needing_upgrade: 0,
    dependents_list: [],
    quality_test_coverage: null,
    quality_security_score: 85,
    quality_open_issues: 0,
    quality_open_prs: 0,
    quality_last_release_age: null,
    publish_repository: null,
    publish_auto_publish: false,
    publish_require_approval: true,
    publish_approvers: [],
    labels: {},
    annotations: {},
    created_at: new Date(),
    updated_at: new Date(),
  };

  return {
    query: jest.fn(async (text: string) => {
      if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
        return { rows: [libSnakeRow], rowCount: 1 };
      }
      if (text.includes('INSERT INTO library_versions')) {
        return { rows: [versionData], rowCount: 1 };
      }
      if (text.includes('SELECT * FROM library_versions WHERE library_id')) {
        return { rows: [versionData], rowCount: 1 };
      }
      if (text.includes('UPDATE library_versions SET status')) {
        return { rows: [{ ...versionData, status: 'deprecated' }], rowCount: 1 };
      }
      if (text.includes('UPDATE internal_libraries')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
}

function makeDbWithDependent(depData: any) {
  const libSnakeRow = {
    id: 'lib-1',
    tenant_id: null,
    name: 'test-lib',
    display_name: 'Test Lib',
    description: 'A test library',
    language: 'node',
    status: 'active',
    owner: 'team-alpha',
    maintainers: [],
    repository: 'https://github.com/test/lib',
    documentation: null,
    sla: null,
    current_version: '1.2.0',
    latest_stable_version: '1.2.0',
    versions: [],
    breaking_changes: [],
    dependents_total: 1,
    dependents_teams: 1,
    dependents_using_latest: 0,
    dependents_needing_upgrade: 1,
    dependents_list: [],
    quality_test_coverage: 0.85,
    quality_security_score: 90,
    quality_open_issues: 2,
    quality_open_prs: 1,
    quality_last_release_age: 5,
    publish_repository: null,
    publish_auto_publish: false,
    publish_require_approval: true,
    publish_approvers: [],
    labels: {},
    annotations: {},
    created_at: new Date(),
    updated_at: new Date(),
  };

  return {
    query: jest.fn(async (text: string, params?: unknown[]) => {
      if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
        return { rows: [libSnakeRow], rowCount: 1 };
      }
      if (text.includes('SELECT * FROM library_dependents WHERE library_id')) {
        return { rows: [depData], rowCount: 1 };
      }
      if (text.includes('SELECT * FROM library_dependents WHERE repo_name')) {
        return { rows: [depData], rowCount: 1 };
      }
      if (text.includes('INSERT INTO library_dependents')) {
        return { rows: [depData], rowCount: 1 };
      }
      if (text.includes('UPDATE library_dependents SET')) {
        return { rows: [{ ...depData, current_version: params?.[0], upgrade_available: params?.[1], upgrade_type: params?.[2] }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
}

function makeSampleLibEntity(overrides: Record<string, any> = {}): any {
  return {
    id: 'lib-1',
    tenantId: 'tenant-1',
    name: 'test-lib',
    displayName: 'Test Library',
    description: 'A test internal library',
    language: 'node',
    status: 'active',
    owner: 'team-alpha',
    maintainers: ['user-1', 'user-2'],
    repository: 'https://github.com/org/test-lib',
    documentation: 'https://docs.example.com/test-lib',
    sla: '99.9%',
    currentVersion: '1.2.0',
    latestStableVersion: '1.2.0',
    versions: [
      { version: '1.0.0', status: 'stable', releasedAt: new Date('2025-01-01') },
      { version: '1.1.0', status: 'stable', releasedAt: new Date('2025-02-01') },
      { version: '1.2.0', status: 'stable', releasedAt: new Date('2025-03-01') },
    ],
    breakingChanges: [],
    dependentsTotal: 5,
    dependentsTeams: 2,
    dependentsUsingLatest: 3,
    dependentsNeedingUpgrade: 2,
    dependentsList: ['repo-a', 'repo-b'],
    qualityTestCoverage: 0.85,
    qualitySecurityScore: 90,
    qualityOpenIssues: 3,
    qualityOpenPRs: 1,
    qualityLastReleaseAge: 7,
    publishRepository: 'https://npm.example.com',
    publishAutoPublish: false,
    publishRequireApproval: true,
    publishApprovers: ['admin-1'],
    labels: { team: 'alpha', tier: 'core' },
    annotations: { last_reviewed: '2025-04-01' },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-03-01'),
    ...overrides,
  };
}

// ==================== Test Suite ====================

describe('InternalLibraryService', () => {
  describe('No database configured', () => {
    let service: InternalLibraryService;

    beforeEach(() => {
      service = new InternalLibraryService();
    });

    it('create should throw Database not configured', async () => {
      const input: CreateLibraryInput = {
        name: 'test-lib',
        language: 'node',
        owner: 'team-alpha',
        repository: 'https://github.com/test/lib',
      };
      await expect(service.create(input)).rejects.toThrow('Database not configured');
    });

    it('getById should return undefined without db', async () => {
      const result = await service.getById('lib-1');
      expect(result).toBeUndefined();
    });

    it('getByName should return undefined without db', async () => {
      const result = await service.getByName('test-lib');
      expect(result).toBeUndefined();
    });

    it('list should return empty array without db', async () => {
      const result = await service.list();
      expect(result).toEqual([]);
    });

    it('list with options should return empty array without db', async () => {
      const result = await service.list({ language: 'node', limit: 10 });
      expect(result).toEqual([]);
    });

    it('listByLanguage should return empty array without db', async () => {
      const result = await service.listByLanguage('java');
      expect(result).toEqual([]);
    });

    it('listByOwner should return empty array without db', async () => {
      const result = await service.listByOwner('team-alpha');
      expect(result).toEqual([]);
    });

    it('delete should return false without db', async () => {
      const result = await service.delete('lib-1');
      expect(result).toBe(false);
    });

    it('publishVersion should throw Database not configured without db', async () => {
      const input: PublishVersionInput = {
        libraryId: 'lib-1',
        version: '1.1.0',
      };
      await expect(service.publishVersion(input)).rejects.toThrow('Database not configured');
    });

    it('getVersions should return empty array without db', async () => {
      const result = await service.getVersions('lib-1');
      expect(result).toEqual([]);
    });

    it('getVersion should return undefined without db', async () => {
      const result = await service.getVersion('lib-1', '1.0.0');
      expect(result).toBeUndefined();
    });

    it('deprecateVersion should return null without db', async () => {
      const result = await service.deprecateVersion('lib-1', '1.0.0', 'old', new Date());
      expect(result).toBeNull();
    });

    it('deprecate should return null without db', async () => {
      const result = await service.deprecate({ libraryId: 'lib-1', reason: 'replaced', eolDate: new Date() });
      expect(result).toBeNull();
    });

    it('activate should return null without db', async () => {
      const result = await service.activate('lib-1');
      expect(result).toBeNull();
    });

    it('getDependents should return empty array without db', async () => {
      const result = await service.getDependents('lib-1');
      expect(result).toEqual([]);
    });

    it('addDependent should throw Database not configured without db', async () => {
      await expect(service.addDependent('lib-1', 'repo-a', 'team-a', '1.0.0')).rejects.toThrow('Database not configured');
    });

    it('updateDependentVersion should return false without db', async () => {
      const result = await service.updateDependentVersion('lib-1', 'repo-a', '1.1.0');
      expect(result).toBe(false);
    });

    it('checkDependencies should return empty array without db', async () => {
      const result = await service.checkDependencies('repo-a');
      expect(result).toEqual([]);
    });

    it('updateDependentsStats should not throw without db', async () => {
      await expect(service.updateDependentsStats('lib-1')).resolves.toBeUndefined();
    });
  });

  describe('With mock database - CRUD operations', () => {
    let service: InternalLibraryService;

    it('create should return InternalLibrary with correct fields', async () => {
      const libEntity = makeSampleLibEntity();
      const db = makeDbWithLibrary(libEntity);
      service = new InternalLibraryService(db);

      const input: CreateLibraryInput = {
        name: 'test-lib',
        displayName: 'Test Library',
        description: 'A test library',
        language: 'node',
        owner: 'team-alpha',
        maintainers: ['user-1'],
        repository: 'https://github.com/test/lib',
        publishConfig: {
          repository: 'https://npm.example.com',
          autoPublish: false,
          requireApproval: true,
          approvers: ['admin-1'],
        },
        labels: { team: 'alpha' },
        tenantId: 'tenant-1',
      };

      const result = await service.create(input);

      expect(result.name).toBe('test-lib');
      expect(result.language).toBe('node');
      expect(result.status).toBe('development');
      expect(result.owner).toBe('team-alpha');
      expect(result.repository).toBeDefined();
      expect(result.publishConfig?.autoPublish).toBe(false);
      expect(result.publishConfig?.requireApproval).toBe(true);
      expect(result.labels).toBeDefined();
      expect(result.tenantId).toBeUndefined(); // mock returns null tenant_id
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('create with minimal input should set defaults', async () => {
      const libEntity = makeSampleLibEntity();
      const db = makeDbWithLibrary(libEntity);
      service = new InternalLibraryService(db);

      const input: CreateLibraryInput = {
        name: 'minimal-lib',
        language: 'go',
        owner: 'team-beta',
        repository: 'https://github.com/test/minimal',
      };

      const result = await service.create(input);
      expect(result.status).toBe('development');
      // Mock returns fixed entity data
      expect(result.maintainers).toBeDefined();
      expect(result.currentVersion).toBe('');
      expect(result.latestStableVersion).toBe('');
      expect(result.versions).toEqual([]);
    });

    it('getById should return mapped InternalLibrary', async () => {
      const libEntity = makeSampleLibEntity();
      const db = makeDbWithLibrary(libEntity);
      service = new InternalLibraryService(db);

      const result = await service.getById('lib-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('lib-1');
      expect(result?.name).toBe('test-lib');
      expect(result?.displayName).toBe('Test Library');
      expect(result?.language).toBe('node');
      expect(result?.status).toBe('active');
      expect(result?.dependents.totalRepos).toBe(5);
      expect(result?.dependents.totalTeams).toBe(2);
      expect(result?.quality?.testCoverage).toBe(0.85);
      expect(result?.quality?.securityScore).toBe(90);
    });

    it('getById should return undefined when not found', async () => {
      const db = {
        query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
      };
      service = new InternalLibraryService(db);
      const result = await service.getById('nonexistent');
      expect(result).toBeUndefined();
    });

    it('getByName should return mapped InternalLibrary', async () => {
      const libEntity = makeSampleLibEntity();
      const db = makeDbWithLibrary(libEntity);
      service = new InternalLibraryService(db);

      const result = await service.getByName('test-lib');
      expect(result?.name).toBe('test-lib');
      expect(result?.owner).toBe('team-alpha');
    });

    it('list should return array of InternalLibrary', async () => {
      const libEntity = makeSampleLibEntity();
      const db = makeDbWithLibrary(libEntity);
      service = new InternalLibraryService(db);

      const result = await service.list();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].name).toBe('test-lib');
    });

    it('listByLanguage should return filtered libraries', async () => {
      const libEntity = makeSampleLibEntity();
      const db = makeDbWithLibrary(libEntity);
      service = new InternalLibraryService(db);

      const result = await service.listByLanguage('node');
      expect(result.length).toBe(1);
      expect(result[0].language).toBe('node');
    });

    it('listByOwner should return filtered libraries', async () => {
      const libEntity = makeSampleLibEntity();
      const db = makeDbWithLibrary(libEntity);
      service = new InternalLibraryService(db);

      const result = await service.listByOwner('team-alpha');
      expect(result.length).toBe(1);
      expect(result[0].owner).toBe('team-alpha');
    });

    it('delete should return true', async () => {
      const libEntity = makeSampleLibEntity();
      const db = makeDbWithLibrary(libEntity);
      service = new InternalLibraryService(db);

      const result = await service.delete('lib-1');
      expect(result).toBe(true);
    });
  });

  describe('With mock database - Version management', () => {
    let service: InternalLibraryService;

    it('publishVersion should create version entity', async () => {
      const versionEntity = {
        id: 'ver-1',
        library_id: 'lib-1',
        version: '1.1.0',
        status: 'stable',
        released_at: new Date(),
        changelog: 'New features',
        security_score: 88,
        vulnerabilities: [],
        test_coverage: 0.9,
        eol_date: null,
        deprecation_reason: null,
        migration_guide: null,
        published_to: [],
        artifact_id: null,
        created_at: new Date(),
      };
      const db = makeDbWithVersion(versionEntity);
      service = new InternalLibraryService(db);

      const input: PublishVersionInput = {
        libraryId: 'lib-1',
        version: '1.1.0',
        status: 'stable',
        changelog: 'New features',
        securityScore: 88,
        testCoverage: 0.9,
      };

      const result = await service.publishVersion(input);
      expect(result.version).toBe('1.1.0');
      expect(result.status).toBe('stable');
      expect(result.changelog).toBe('New features');
      expect(result.securityScore).toBe(88);
      expect(result.testCoverage).toBe(0.9);
    });

    it('publishVersion with snapshot status', async () => {
      const versionEntity = {
        id: 'ver-2',
        library_id: 'lib-1',
        version: '1.2.0-SNAPSHOT',
        status: 'snapshot',
        released_at: new Date(),
        changelog: null,
        security_score: null,
        vulnerabilities: [],
        test_coverage: null,
        eol_date: null,
        deprecation_reason: null,
        migration_guide: null,
        published_to: [],
        artifact_id: null,
        created_at: new Date(),
      };
      const db = makeDbWithVersion(versionEntity);
      service = new InternalLibraryService(db);

      const result = await service.publishVersion({
        libraryId: 'lib-1',
        version: '1.2.0-SNAPSHOT',
        status: 'snapshot',
      });
      expect(result.status).toBe('snapshot');
    });

    it('getVersions should return version list', async () => {
      const versionEntity = {
        id: 'ver-1',
        library_id: 'lib-1',
        version: '1.0.0',
        status: 'stable',
        released_at: new Date('2025-01-01'),
        changelog: 'Initial release',
        security_score: 80,
        vulnerabilities: [],
        test_coverage: 0.75,
        eol_date: null,
        deprecation_reason: null,
        migration_guide: null,
        published_to: ['npm'],
        artifact_id: 'art-1',
        created_at: new Date('2025-01-01'),
      };
      const db = makeDbWithVersion(versionEntity);
      service = new InternalLibraryService(db);

      const result = await service.getVersions('lib-1');
      expect(result.length).toBe(1);
      expect(result[0].version).toBe('1.0.0');
      expect(result[0].status).toBe('stable');
    });

    it('getVersion should return specific version', async () => {
      const versionEntity = {
        id: 'ver-1',
        library_id: 'lib-1',
        version: '1.0.0',
        status: 'stable',
        released_at: new Date(),
        changelog: null,
        security_score: null,
        vulnerabilities: [],
        test_coverage: null,
        eol_date: null,
        deprecation_reason: null,
        migration_guide: null,
        published_to: [],
        artifact_id: null,
        created_at: new Date(),
      };
      const db = makeDbWithVersion(versionEntity);
      service = new InternalLibraryService(db);

      const result = await service.getVersion('lib-1', '1.0.0');
      expect(result?.version).toBe('1.0.0');
    });

    it('deprecateVersion should update version status', async () => {
      const versionEntity = {
        id: 'ver-old',
        library_id: 'lib-1',
        version: '0.9.0',
        status: 'stable',
        released_at: new Date(),
        changelog: null,
        security_score: null,
        vulnerabilities: [],
        test_coverage: null,
        eol_date: null,
        deprecation_reason: null,
        migration_guide: null,
        published_to: [],
        artifact_id: null,
        created_at: new Date(),
      };
      const db = makeDbWithVersion(versionEntity);
      service = new InternalLibraryService(db);

      const result = await service.deprecateVersion('lib-1', '0.9.0', 'superseded', new Date('2026-01-01'), 'Use 1.0 instead');
      expect(result).not.toBeNull();
      expect(result?.status).toBe('deprecated');
    });

    it('deprecateVersion returns null when version not found', async () => {
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM library_versions')) {
            return { rows: [], rowCount: 0 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      service = new InternalLibraryService(db);
      const result = await service.deprecateVersion('lib-1', '9.9.9', 'old', new Date());
      expect(result).toBeNull();
    });
  });

  describe('With mock database - Deprecation management', () => {
    let service: InternalLibraryService;

    it('deprecate should update status to deprecated', async () => {
      const libEntity = makeSampleLibEntity();
      const db = makeDbWithLibrary(libEntity);
      service = new InternalLibraryService(db);

      const result = await service.deprecate({
        libraryId: 'lib-1',
        reason: 'Replaced by new-lib',
        eolDate: new Date('2026-12-31'),
        migrationGuide: 'See migration guide',
      });

      expect(result).not.toBeNull();
      expect(result?.status).toBe('deprecated');
    });

    it('deprecate returns null when library not found', async () => {
      const db = {
        query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
      };
      service = new InternalLibraryService(db);
      const result = await service.deprecate({ libraryId: 'nonexistent', reason: 'old', eolDate: new Date() });
      expect(result).toBeNull();
    });

    it('activate should update status to active', async () => {
      const libEntity = makeSampleLibEntity({ status: 'deprecated' });
      const db = makeDbWithLibrary(libEntity);
      service = new InternalLibraryService(db);

      const result = await service.activate('lib-1');
      expect(result).not.toBeNull();
      expect(result?.status).toBe('active');
    });

    it('activate returns null when library not found', async () => {
      const db = {
        query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
      };
      service = new InternalLibraryService(db);
      const result = await service.activate('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('With mock database - Dependency management', () => {
    let service: InternalLibraryService;

    it('getDependents should return dependent list', async () => {
      const depEntity = {
        id: 'dep-1',
        library_id: 'lib-1',
        repo_name: 'my-app',
        team_name: 'team-alpha',
        current_version: '1.0.0',
        latest_compatible_version: '1.2.0',
        upgrade_available: true,
        upgrade_type: 'minor',
        last_updated: new Date(),
        created_at: new Date(),
      };
      const db = makeDbWithDependent(depEntity);
      service = new InternalLibraryService(db);

      const result = await service.getDependents('lib-1');
      expect(result.length).toBe(1);
      expect(result[0].repoName).toBe('my-app');
      expect(result[0].teamName).toBe('team-alpha');
      expect(result[0].currentVersion).toBe('1.0.0');
      expect(result[0].upgradeAvailable).toBe(true);
      expect(result[0].upgradeType).toBe('minor');
    });

    it('addDependent should create dependent record', async () => {
      const depEntity = {
        id: 'dep-2',
        library_id: 'lib-1',
        repo_name: 'new-app',
        team_name: 'team-beta',
        current_version: '1.2.0',
        latest_compatible_version: null,
        upgrade_available: false,
        upgrade_type: null,
        last_updated: new Date(),
        created_at: new Date(),
      };
      const db = makeDbWithDependent(depEntity);
      service = new InternalLibraryService(db);

      const result = await service.addDependent('lib-1', 'new-app', 'team-beta', '1.2.0');
      expect(result.repoName).toBe('new-app');
      expect(result.teamName).toBe('team-beta');
      expect(result.currentVersion).toBe('1.2.0');
      expect(result.upgradeAvailable).toBe(false);
    });

    it('updateDependentVersion should update version', async () => {
      const depEntity = {
        id: 'dep-1',
        library_id: 'lib-1',
        repo_name: 'my-app',
        team_name: 'team-alpha',
        current_version: '1.0.0',
        latest_compatible_version: '1.2.0',
        upgrade_available: false,
        upgrade_type: null,
        last_updated: new Date(),
        created_at: new Date(),
      };
      const db = makeDbWithDependent(depEntity);
      service = new InternalLibraryService(db);

      const result = await service.updateDependentVersion('lib-1', 'my-app', '1.1.0');
      expect(result).toBe(true);
    });

    it('updateDependentVersion returns false when dependent not found', async () => {
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM library_dependents')) {
            return { rows: [], rowCount: 0 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      service = new InternalLibraryService(db);
      const result = await service.updateDependentVersion('lib-1', 'unknown-repo', '1.0.0');
      expect(result).toBe(false);
    });

    it('checkDependencies should return check results', async () => {
      const depEntity = {
        id: 'dep-1',
        library_id: 'lib-1',
        repo_name: 'my-app',
        team_name: 'team-alpha',
        current_version: '1.0.0',
        latest_compatible_version: '1.2.0',
        upgrade_available: true,
        upgrade_type: 'minor',
        last_updated: new Date(),
        created_at: new Date(),
      };
      const db = makeDbWithDependent(depEntity);
      service = new InternalLibraryService(db);

      const result = await service.checkDependencies('my-app');
      expect(result.length).toBe(1);
      expect(result[0].libraryName).toBe('test-lib');
      expect(result[0].currentVersion).toBe('1.0.0');
      expect(result[0].latestVersion).toBe('1.2.0');
      expect(result[0].status).toBe('upgrade_available');
      expect(result[0].upgradeType).toBe('minor');
      expect(result[0].securityScore).toBe(90);
    });

    it('checkDependencies returns deprecated status', async () => {
      const depEntity = {
        id: 'dep-1',
        library_id: 'lib-1',
        repo_name: 'my-app',
        team_name: 'team-alpha',
        current_version: '1.0.0',
        latest_compatible_version: '1.2.0',
        upgrade_available: true,
        upgrade_type: 'minor',
        last_updated: new Date(),
        created_at: new Date(),
      };
      const db = {
        query: jest.fn(async (text: string) => {
          if (text.includes('SELECT * FROM library_dependents WHERE repo_name')) {
            return { rows: [depEntity], rowCount: 1 };
          }
          if (text.includes('SELECT * FROM internal_libraries WHERE id')) {
            return { rows: [{
              id: 'lib-1',
              tenant_id: null,
              name: 'test-lib',
              display_name: 'Test',
              description: null,
              language: 'node',
              status: 'deprecated',
              owner: 'team-alpha',
              maintainers: [],
              repository: 'https://github.com/test',
              documentation: null,
              sla: null,
              current_version: '1.2.0',
              latest_stable_version: '1.2.0',
              versions: [],
              breaking_changes: [],
              dependents_total: 1,
              dependents_teams: 1,
              dependents_using_latest: 0,
              dependents_needing_upgrade: 1,
              dependents_list: [],
              quality_test_coverage: null,
              quality_security_score: 80,
              quality_open_issues: 0,
              quality_open_prs: 0,
              quality_last_release_age: null,
              publish_repository: null,
              publish_auto_publish: false,
              publish_require_approval: true,
              publish_approvers: [],
              labels: {},
              annotations: {},
              created_at: new Date(),
              updated_at: new Date(),
            }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };
      service = new InternalLibraryService(db);
      const result = await service.checkDependencies('my-app');
      expect(result[0].status).toBe('deprecated');
    });

    it('checkDependencies returns latest status', async () => {
      const depEntity = {
        id: 'dep-1',
        library_id: 'lib-1',
        repo_name: 'my-app',
        team_name: 'team-alpha',
        current_version: '1.2.0',
        latest_compatible_version: '1.2.0',
        upgrade_available: false,
        upgrade_type: null,
        last_updated: new Date(),
        created_at: new Date(),
      };
      const db = makeDbWithDependent(depEntity);
      service = new InternalLibraryService(db);

      const result = await service.checkDependencies('my-app');
      expect(result.length).toBe(1);
      expect(result[0].status).toBe('latest');
      expect(result[0].upgradeType).toBeUndefined();
    });
  });

  describe('determineUpgradeType', () => {
    let service: InternalLibraryService;

    beforeEach(() => {
      service = new InternalLibraryService();
    });

    it('should detect major upgrade (1.0.0 -> 2.0.0)', () => {
      // Access private method via any cast for testing
      const result = (service as any).determineUpgradeType('1.0.0', '2.0.0');
      expect(result).toBe('major');
    });

    it('should detect minor upgrade (1.0.0 -> 1.1.0)', () => {
      const result = (service as any).determineUpgradeType('1.0.0', '1.1.0');
      expect(result).toBe('minor');
    });

    it('should detect patch upgrade (1.0.0 -> 1.0.1)', () => {
      const result = (service as any).determineUpgradeType('1.0.0', '1.0.1');
      expect(result).toBe('patch');
    });

    it('should detect major upgrade (2.3.4 -> 3.0.0)', () => {
      const result = (service as any).determineUpgradeType('2.3.4', '3.0.0');
      expect(result).toBe('major');
    });

    it('should detect minor upgrade (2.3.4 -> 2.5.0)', () => {
      const result = (service as any).determineUpgradeType('2.3.4', '2.5.0');
      expect(result).toBe('minor');
    });

    it('should detect patch upgrade (2.3.4 -> 2.3.7)', () => {
      const result = (service as any).determineUpgradeType('2.3.4', '2.3.7');
      expect(result).toBe('patch');
    });
  });

  describe('mapEntityToLibrary', () => {
    let service: InternalLibraryService;

    beforeEach(() => {
      service = new InternalLibraryService();
    });

    it('should correctly map entity to domain model', () => {
      const entity = makeSampleLibEntity();
      const result = (service as any).mapEntityToLibrary(entity);

      expect(result.id).toBe('lib-1');
      expect(result.name).toBe('test-lib');
      expect(result.displayName).toBe('Test Library');
      expect(result.description).toBe('A test internal library');
      expect(result.language).toBe('node');
      expect(result.status).toBe('active');
      expect(result.owner).toBe('team-alpha');
      expect(result.maintainers).toEqual(['user-1', 'user-2']);
      expect(result.repository).toBe('https://github.com/org/test-lib');
      expect(result.documentation).toBe('https://docs.example.com/test-lib');
      expect(result.sla).toBe('99.9%');

      expect(result.currentVersion).toBe('1.2.0');
      expect(result.latestStableVersion).toBe('1.2.0');
      expect(result.versions.length).toBe(3);

      expect(result.dependents.totalRepos).toBe(5);
      expect(result.dependents.totalTeams).toBe(2);
      expect(result.dependents.reposUsingLatest).toBe(3);
      expect(result.dependents.reposNeedingUpgrade).toBe(2);

      expect(result.quality?.testCoverage).toBe(0.85);
      expect(result.quality?.securityScore).toBe(90);
      expect(result.quality?.openIssues).toBe(3);
      expect(result.quality?.openPRs).toBe(1);
      expect(result.quality?.lastReleaseAge).toBe(7);

      expect(result.publishConfig?.repository).toBe('https://npm.example.com');
      expect(result.publishConfig?.autoPublish).toBe(false);
      expect(result.publishConfig?.requireApproval).toBe(true);
      expect(result.publishConfig?.approvers).toEqual(['admin-1']);

      expect(result.labels).toEqual({ team: 'alpha', tier: 'core' });
      expect(result.tenantId).toBe('tenant-1');
    });

    it('should handle null/undefined fields gracefully', () => {
      const entity = makeSampleLibEntity({
        displayName: null,
        description: null,
        documentation: null,
        sla: null,
        qualityTestCoverage: null,
        qualitySecurityScore: null,
        qualityOpenIssues: null,
        qualityOpenPRs: null,
        qualityLastReleaseAge: null,
        publishRepository: null,
        tenantId: null,
      });

      const result = (service as any).mapEntityToLibrary(entity);
      expect(result.displayName).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.documentation).toBeUndefined();
      expect(result.sla).toBeUndefined();
      expect(result.quality?.testCoverage).toBeUndefined();
      expect(result.quality?.securityScore).toBeUndefined();
      expect(result.publishConfig?.repository).toBeUndefined();
      expect(result.tenantId).toBeUndefined();
    });
  });
});
