import {
  InternalLibraryRepository,
  LibraryVersionRepository,
  LibraryDependentRepository,
} from '../InternalLibraryRepository';

describe('InternalLibraryRepository', () => {
  let repo: InternalLibraryRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new InternalLibraryRepository(mockDb);
  });

  test('should create internal library', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'lib-1', tenant_id: 't1', name: 'company-auth-sdk', display_name: 'Auth SDK',
        description: 'Auth library', language: 'java', status: 'active',
        owner: 'identity-team', maintainers: ['zhangsan', 'lisi'],
        repository: 'git.company.com/libs/auth-sdk', documentation: 'wiki', sla: 'P99<100ms',
        current_version: '2.3.0', latest_stable_version: '2.3.0', versions: [],
        breaking_changes: [], dependents_total: 45, dependents_teams: 12,
        dependents_using_latest: 38, dependents_needing_upgrade: 7, dependents_list: [],
        quality_test_coverage: 92, quality_security_score: 98, quality_open_issues: 3,
        quality_open_prs: 2, quality_last_release_age: 9,
        publish_repository: 'nexus', publish_auto_publish: false,
        publish_require_approval: true, publish_approvers: [],
        labels: {}, annotations: {}, created_at: new Date(), updated_at: new Date()
      }],
    });

    const result = await repo.create({
      id: 'lib-1', tenantId: 't1', name: 'company-auth-sdk', displayName: 'Auth SDK',
      description: 'Auth library', language: 'java', status: 'active',
      owner: 'identity-team', maintainers: ['zhangsan', 'lisi'],
      repository: 'git.company.com/libs/auth-sdk', createdAt: new Date(), updatedAt: new Date()
    });

    expect(result.name).toBe('company-auth-sdk');
    expect(result.language).toBe('java');
    expect(result.owner).toBe('identity-team');
  });

  test('should find by name', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'lib-1', name: 'company-auth-sdk', display_name: 'Auth', language: 'java',
        status: 'active', owner: 'team1', maintainers: [], repository: 'url',
        current_version: '2.0', latest_stable_version: '2.0', versions: [],
        breaking_changes: [], dependents_total: 0, dependents_teams: 0,
        dependents_using_latest: 0, dependents_needing_upgrade: 0, dependents_list: [],
        quality_test_coverage: null, quality_security_score: null, quality_open_issues: 0,
        quality_open_prs: 0, quality_last_release_age: null,
        publish_repository: null, publish_auto_publish: false,
        publish_require_approval: true, publish_approvers: [],
        labels: {}, annotations: {}, created_at: new Date(), updated_at: new Date()
      }],
    });

    const result = await repo.findByName('company-auth-sdk');
    expect(result?.name).toBe('company-auth-sdk');
    expect(result?.language).toBe('java');
  });

  test('should find by language', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'lib-1', name: 'auth-sdk', language: 'java', owner: 't1', repository: 'url', created_at: new Date(), updated_at: new Date() },
        { id: 'lib-2', name: 'utils-sdk', language: 'java', owner: 't2', repository: 'url', created_at: new Date(), updated_at: new Date() },
      ],
    });

    const result = await repo.findByLanguage('java');
    expect(result.length).toBe(2);
  });

  test('should find by owner', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'lib-1', name: 'auth-sdk', language: 'java', owner: 'identity-team', repository: 'url', created_at: new Date(), updated_at: new Date() },
      ],
    });

    const result = await repo.findByOwner('identity-team');
    expect(result.length).toBe(1);
    expect(result[0].owner).toBe('identity-team');
  });

  test('should find by status', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'lib-1', name: 'old-sdk', language: 'java', status: 'deprecated', owner: 't1', repository: 'url', created_at: new Date(), updated_at: new Date() },
      ],
    });

    const result = await repo.findByStatus('deprecated');
    expect(result.length).toBe(1);
  });

  test('should update status', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'lib-1', name: 'auth-sdk', language: 'java', status: 'deprecated',
        owner: 't1', repository: 'url', created_at: new Date(), updated_at: new Date()
      }],
    });

    const result = await repo.updateStatus('lib-1', 'deprecated');
    expect(result?.status).toBe('deprecated');
  });

  test('should update version', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'lib-1', name: 'auth-sdk', language: 'java',
        current_version: '3.0.0', latest_stable_version: '3.0.0',
        owner: 't1', repository: 'url', created_at: new Date(), updated_at: new Date()
      }],
    });

    const result = await repo.updateVersion('lib-1', '3.0.0', '3.0.0');
    expect(result?.currentVersion).toBe('3.0.0');
  });

  test('should update dependents stats', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'lib-1', name: 'auth-sdk', dependents_total: 50, dependents_teams: 15,
        dependents_using_latest: 40, dependents_needing_upgrade: 10,
        owner: 't1', repository: 'url', created_at: new Date(), updated_at: new Date()
      }],
    });

    const result = await repo.updateDependentsStats('lib-1', 50, 15, 40, 10);
    expect(result?.dependentsTotal).toBe(50);
    expect(result?.dependentsNeedingUpgrade).toBe(10);
  });
});

describe('LibraryVersionRepository', () => {
  let repo: LibraryVersionRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new LibraryVersionRepository(mockDb);
  });

  test('should create library version', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'ver-1', library_id: 'lib-1', version: '2.3.0', status: 'stable',
        released_at: new Date(), changelog: 'Add PKCE support',
        security_score: 98, test_coverage: 92,
        vulnerabilities: [], published_to: ['nexus'],
        eol_date: null, deprecation_reason: null, migration_guide: null,
        artifact_id: null, created_at: new Date()
      }],
    });

    const result = await repo.create({
      id: 'ver-1', libraryId: 'lib-1', version: '2.3.0', status: 'stable',
      releasedAt: new Date(), changelog: 'Add PKCE support',
      createdAt: new Date()
    });

    expect(result.version).toBe('2.3.0');
    expect(result.status).toBe('stable');
  });

  test('should find by library', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'ver-1', library_id: 'lib-1', version: '2.3.0', status: 'stable', released_at: new Date(), created_at: new Date() },
        { id: 'ver-2', library_id: 'lib-1', version: '2.2.0', status: 'stable', released_at: new Date(), created_at: new Date() },
      ],
    });

    const result = await repo.findByLibrary('lib-1');
    expect(result.length).toBe(2);
  });

  test('should find by library and version', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'ver-1', library_id: 'lib-1', version: '2.3.0', status: 'stable',
        released_at: new Date(), created_at: new Date()
      }],
    });

    const result = await repo.findByLibraryAndVersion('lib-1', '2.3.0');
    expect(result?.version).toBe('2.3.0');
  });

  test('should update version status', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'ver-1', library_id: 'lib-1', version: '1.9.0', status: 'deprecated',
        released_at: new Date(), created_at: new Date()
      }],
    });

    const result = await repo.updateStatus('ver-1', 'deprecated');
    expect(result?.status).toBe('deprecated');
  });
});

describe('LibraryDependentRepository', () => {
  let repo: LibraryDependentRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new LibraryDependentRepository(mockDb);
  });

  test('should create library dependent', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'dep-1', library_id: 'lib-1', repo_name: 'payment-service',
        team_name: 'payment-team', current_version: '2.2.0',
        latest_compatible_version: '2.3.0', upgrade_available: true, upgrade_type: 'minor',
        last_updated: new Date(), created_at: new Date()
      }],
    });

    const result = await repo.create({
      id: 'dep-1', libraryId: 'lib-1', repoName: 'payment-service',
      teamName: 'payment-team', currentVersion: '2.2.0',
      lastUpdated: new Date(), createdAt: new Date()
    });

    expect(result.repoName).toBe('payment-service');
    expect(result.currentVersion).toBe('2.2.0');
  });

  test('should find by library', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'dep-1', library_id: 'lib-1', repo_name: 'payment', team_name: 't1', current_version: '2.2', upgrade_available: true, last_updated: new Date(), created_at: new Date() },
        { id: 'dep-2', library_id: 'lib-1', repo_name: 'order', team_name: 't2', current_version: '2.3', upgrade_available: false, last_updated: new Date(), created_at: new Date() },
      ],
    });

    const result = await repo.findByLibrary('lib-1');
    expect(result.length).toBe(2);
  });

  test('should find by repo', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'dep-1', library_id: 'lib-1', repo_name: 'payment', current_version: '2.2', last_updated: new Date(), created_at: new Date() },
        { id: 'dep-2', library_id: 'lib-2', repo_name: 'payment', current_version: '1.5', last_updated: new Date(), created_at: new Date() },
      ],
    });

    const result = await repo.findByRepo('payment');
    expect(result.length).toBe(2);
  });

  test('should update dependent version', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{
        id: 'dep-1', library_id: 'lib-1', repo_name: 'payment',
        current_version: '2.3.0', upgrade_available: false, upgrade_type: null,
        last_updated: new Date(), created_at: new Date()
      }],
    });

    const result = await repo.updateVersion('dep-1', '2.3.0', false);
    expect(result?.currentVersion).toBe('2.3.0');
    expect(result?.upgradeAvailable).toBe(false);
  });
});