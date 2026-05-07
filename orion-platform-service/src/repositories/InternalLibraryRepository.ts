/**
 * Internal Library Repository - 二方库数据访问层
 */

import { BaseRepository } from '../db/base-repository';
import {
  InternalLibrary,
  LibraryVersion,
  LibraryDependent,
  CreateLibraryInput,
  LibraryQueryOptions,
  LibraryLanguage,
  LibraryStatus,
} from '../models/InternalLibrary';

export interface LibraryEntity {
  id: string;
  tenantId: string | null;
  name: string;
  displayName: string | null;
  description: string | null;
  language: string;
  status: string;

  owner: string;
  maintainers: string[];
  repository: string;
  documentation: string | null;
  sla: string | null;

  currentVersion: string;
  latestStableVersion: string;
  versions: any[];

  breakingChanges: any[];
  dependentsTotal: number;
  dependentsTeams: number;
  dependentsUsingLatest: number;
  dependentsNeedingUpgrade: number;
  dependentsList: any[];

  qualityTestCoverage: number | null;
  qualitySecurityScore: number | null;
  qualityOpenIssues: number | null;
  qualityOpenPRs: number | null;
  qualityLastReleaseAge: number | null;

  publishRepository: string | null;
  publishAutoPublish: boolean;
  publishRequireApproval: boolean;
  publishApprovers: string[];

  labels: Record<string, string>;
  annotations: Record<string, string>;

  createdAt: Date;
  updatedAt: Date;
}

export interface LibraryVersionEntity {
  id: string;
  libraryId: string;
  version: string;
  status: string;
  releasedAt: Date;
  changelog: string | null;

  securityScore: number | null;
  vulnerabilities: any[];
  testCoverage: number | null;

  eolDate: Date | null;
  deprecationReason: string | null;
  migrationGuide: string | null;

  publishedTo: string[];
  artifactId: string | null;

  createdAt: Date;
}

export interface LibraryDependentEntity {
  id: string;
  libraryId: string;
  repoName: string;
  teamName: string;
  currentVersion: string;
  latestCompatibleVersion: string | null;
  upgradeAvailable: boolean;
  upgradeType: string | null;
  lastUpdated: Date;

  createdAt: Date;
}

export class InternalLibraryRepository extends BaseRepository<LibraryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'internal_libraries');
  }

  async findByName(name: string): Promise<LibraryEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM internal_libraries WHERE name = $1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByOwner(owner: string): Promise<LibraryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM internal_libraries WHERE owner = $1 ORDER BY created_at DESC`,
      [owner],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByLanguage(language: LibraryLanguage): Promise<LibraryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM internal_libraries WHERE language = $1 ORDER BY created_at DESC`,
      [language],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: LibraryStatus): Promise<LibraryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM internal_libraries WHERE status = $1 ORDER BY created_at DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async find(options: LibraryQueryOptions): Promise<{ entities: LibraryEntity[]; total: number }> {
    let query = `SELECT * FROM internal_libraries WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (options.language) {
      query += ` AND language = $${paramIndex}`;
      params.push(options.language);
      paramIndex++;
    }

    if (options.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    if (options.owner) {
      query += ` AND owner = $${paramIndex}`;
      params.push(options.owner);
      paramIndex++;
    }

    if (options.name) {
      query += ` AND name ILIKE $${paramIndex}`;
      params.push(`%${options.name}%`);
      paramIndex++;
    }

    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'DESC';
    // Whitelist to prevent SQL injection
    const allowedOrderColumns = ['created_at', 'updated_at', 'name', 'status', 'language', 'owner'];
    const safeColumn = allowedOrderColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeDir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${safeColumn} ${safeDir}`;

    const limit = options.limit || 20;
    const offset = options.offset || 0;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    // Count query
    const countQuery = query.replace('SELECT * FROM', 'SELECT COUNT(*) FROM').split(' ORDER BY')[0];
    const countParams = params.slice(0, -2);
    const countResult = await this.db.query(countQuery, countParams);

    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0]?.count || '0'),
    };
  }

  async updateStatus(id: string, status: LibraryStatus): Promise<LibraryEntity | null> {
    const result = await this.db.query(
      `UPDATE internal_libraries SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateVersion(id: string, currentVersion: string, latestStableVersion: string): Promise<LibraryEntity | null> {
    const result = await this.db.query(
      `UPDATE internal_libraries SET current_version = $1, latest_stable_version = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [currentVersion, latestStableVersion, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateDependentsStats(
    id: string,
    totalRepos: number,
    totalTeams: number,
    usingLatest: number,
    needingUpgrade: number
  ): Promise<LibraryEntity | null> {
    const result = await this.db.query(
      `UPDATE internal_libraries SET
        dependents_total = $1, dependents_teams = $2,
        dependents_using_latest = $3, dependents_needing_upgrade = $4,
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [totalRepos, totalTeams, usingLatest, needingUpgrade, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateQualityMetrics(
    id: string,
    testCoverage: number,
    securityScore: number,
    openIssues: number
  ): Promise<LibraryEntity | null> {
    const result = await this.db.query(
      `UPDATE internal_libraries SET
        quality_test_coverage = $1, quality_security_score = $2, quality_open_issues = $3,
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [testCoverage, securityScore, openIssues, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): LibraryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      language: row.language,
      status: row.status ?? 'active',

      owner: row.owner,
      maintainers: row.maintainers ?? [],
      repository: row.repository,
      documentation: row.documentation,
      sla: row.sla,

      currentVersion: row.current_version,
      latestStableVersion: row.latest_stable_version,
      versions: row.versions ?? [],
      breakingChanges: row.breaking_changes ?? [],
      dependentsTotal: row.dependents_total ?? 0,
      dependentsTeams: row.dependents_teams ?? 0,
      dependentsUsingLatest: row.dependents_using_latest ?? 0,
      dependentsNeedingUpgrade: row.dependents_needing_upgrade ?? 0,
      dependentsList: row.dependents_list ?? [],

      qualityTestCoverage: row.quality_test_coverage,
      qualitySecurityScore: row.quality_security_score,
      qualityOpenIssues: row.quality_open_issues,
      qualityOpenPRs: row.quality_open_prs,
      qualityLastReleaseAge: row.quality_last_release_age,

      publishRepository: row.publish_repository,
      publishAutoPublish: row.publish_auto_publish ?? false,
      publishRequireApproval: row.publish_require_approval ?? true,
      publishApprovers: row.publish_approvers ?? [],

      labels: row.labels ?? {},
      annotations: row.annotations ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class LibraryVersionRepository extends BaseRepository<LibraryVersionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'library_versions');
  }

  async findByLibrary(libraryId: string): Promise<LibraryVersionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM library_versions WHERE library_id = $1 ORDER BY released_at DESC`,
      [libraryId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByLibraryAndVersion(libraryId: string, version: string): Promise<LibraryVersionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM library_versions WHERE library_id = $1 AND version = $2`,
      [libraryId, version],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateStatus(id: string, status: string): Promise<LibraryVersionEntity | null> {
    const result = await this.db.query(
      `UPDATE library_versions SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): LibraryVersionEntity {
    return {
      id: row.id,
      libraryId: row.library_id,
      version: row.version,
      status: row.status ?? 'stable',
      releasedAt: row.released_at,
      changelog: row.changelog,

      securityScore: row.security_score,
      vulnerabilities: row.vulnerabilities ?? [],
      testCoverage: row.test_coverage,

      eolDate: row.eol_date,
      deprecationReason: row.deprecation_reason,
      migrationGuide: row.migration_guide,

      publishedTo: row.published_to ?? [],
      artifactId: row.artifact_id,

      createdAt: row.created_at,
    };
  }
}

export class LibraryDependentRepository extends BaseRepository<LibraryDependentEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'library_dependents');
  }

  async findByLibrary(libraryId: string): Promise<LibraryDependentEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM library_dependents WHERE library_id = $1 ORDER BY last_updated DESC`,
      [libraryId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByRepo(repoName: string): Promise<LibraryDependentEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM library_dependents WHERE repo_name = $1 ORDER BY last_updated DESC`,
      [repoName],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateVersion(id: string, currentVersion: string, upgradeAvailable: boolean, upgradeType?: string): Promise<LibraryDependentEntity | null> {
    const result = await this.db.query(
      `UPDATE library_dependents SET current_version = $1, upgrade_available = $2, upgrade_type = $3, last_updated = NOW() WHERE id = $4 RETURNING *`,
      [currentVersion, upgradeAvailable, upgradeType ?? null, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): LibraryDependentEntity {
    return {
      id: row.id,
      libraryId: row.library_id,
      repoName: row.repo_name,
      teamName: row.team_name,
      currentVersion: row.current_version,
      latestCompatibleVersion: row.latest_compatible_version,
      upgradeAvailable: row.upgrade_available ?? false,
      upgradeType: row.upgrade_type,
      lastUpdated: row.last_updated,
      createdAt: row.created_at,
    };
  }
}