import { BaseRepository } from '../db/base-repository';
import {
  ProductLine,
  ProductLineCreateInput,
  ProductLineUpdateInput,
  ProductLinePhase,
} from '../models/ProductLine';

export interface ProductLineEntity {
  id: string;
  tenantId: string | null;
  name: string;
  displayName: string;
  description: string | null;
  gitUrl: string;
  gitProvider: string;
  gitDefaultBranch: string;
  gitCredentialRef: Record<string, any> | null;
  branchMode: string;
  protectedBranches: any[];
  codeOwnership: Record<string, any>;
  namingConvention: Record<string, any>;
  mergeStrategy: Record<string, any>;
  defaultEnvironment: string;
  environmentMappings: any[];
  promotionConfig: Record<string, any>;
  environments: any[];
  defaultPipelineTemplate: string | null;
  pipelineTemplates: any[];
  teamBindings: any[];
  resourceQuotas: Record<string, any>;
  notifications: Record<string, any>;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  phase: string;
  conditions: any[];
  statistics: Record<string, any>;
  gitStatus: Record<string, any>;
  environmentStatuses: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReleaseTrainEntity {
  id: string;
  productLineId: string;
  name: string;
  schedule: string;
  targetBranch: string;
  sourceBranch: string;
  autoPromote: boolean;
  approvalRequired: boolean;
  approvers: string[];
  preChecks: any[];
  postActions: any[];
  lastRun: Date | null;
  nextRun: Date | null;
  state: string;
  lastRelease: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HotfixChannelEntity {
  id: string;
  productLineId: string;
  name: string;
  enabled: boolean;
  branchPattern: string;
  skipStages: string[];
  requiredStages: string[];
  approvalRequired: boolean;
  approvalTimeout: number;
  autoMerge: boolean;
  notifyOnCall: boolean;
  maxDuration: number;
  activeHotfixes: number;
  lastHotfix: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ProductLineRepository extends BaseRepository<ProductLineEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'product_lines');
  }

  async findByName(name: string): Promise<ProductLineEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM product_lines WHERE name = $1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<ProductLineEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM product_lines WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByPhase(phase: ProductLinePhase): Promise<ProductLineEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM product_lines WHERE phase = $1 ORDER BY created_at DESC`,
      [phase],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByGitUrl(gitUrl: string): Promise<ProductLineEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM product_lines WHERE git_url = $1`,
      [gitUrl],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updatePhase(id: string, phase: ProductLinePhase, conditions?: any[]): Promise<ProductLineEntity | null> {
    const result = await this.db.query(
      `UPDATE product_lines SET phase = $1, conditions = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [phase, conditions ?? [], id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateGitStatus(id: string, gitStatus: Record<string, any>): Promise<ProductLineEntity | null> {
    const result = await this.db.query(
      `UPDATE product_lines SET git_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [gitStatus, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateStatistics(id: string, statistics: Record<string, any>): Promise<ProductLineEntity | null> {
    const result = await this.db.query(
      `UPDATE product_lines SET statistics = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [statistics, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ProductLineEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      gitUrl: row.git_url,
      gitProvider: row.git_provider ?? 'github',
      gitDefaultBranch: row.git_default_branch ?? 'main',
      gitCredentialRef: row.git_credential_ref,
      branchMode: row.branch_mode ?? 'github-flow',
      protectedBranches: row.protected_branches ?? [],
      codeOwnership: row.code_ownership ?? {},
      namingConvention: row.naming_convention ?? {},
      mergeStrategy: row.merge_strategy ?? {},
      defaultEnvironment: row.default_environment ?? 'dev',
      environmentMappings: row.environment_mappings ?? [],
      promotionConfig: row.promotion_config ?? {},
      environments: row.environments ?? [],
      defaultPipelineTemplate: row.default_pipeline_template,
      pipelineTemplates: row.pipeline_templates ?? [],
      teamBindings: row.team_bindings ?? [],
      resourceQuotas: row.resource_quotas ?? {},
      notifications: row.notifications ?? {},
      labels: row.labels ?? {},
      annotations: row.annotations ?? {},
      phase: row.phase ?? 'Pending',
      conditions: row.conditions ?? [],
      statistics: row.statistics ?? {},
      gitStatus: row.git_status ?? {},
      environmentStatuses: row.environment_statuses ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class ReleaseTrainRepository extends BaseRepository<ReleaseTrainEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'release_trains');
  }

  async findByProductLine(productLineId: string): Promise<ReleaseTrainEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM release_trains WHERE product_line_id = $1 ORDER BY created_at DESC`,
      [productLineId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByState(state: string): Promise<ReleaseTrainEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM release_trains WHERE state = $1`,
      [state],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateState(id: string, state: string, lastRun?: Date, nextRun?: Date): Promise<ReleaseTrainEntity | null> {
    const result = await this.db.query(
      `UPDATE release_trains SET state = $1, last_run = $2, next_run = $3, updated_at = NOW() WHERE id = $4 RETURNING *`,
      [state, lastRun, nextRun, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ReleaseTrainEntity {
    return {
      id: row.id,
      productLineId: row.product_line_id,
      name: row.name,
      schedule: row.schedule,
      targetBranch: row.target_branch ?? 'production',
      sourceBranch: row.source_branch ?? 'main',
      autoPromote: row.auto_promote ?? false,
      approvalRequired: row.approval_required ?? true,
      approvers: row.approvers ?? [],
      preChecks: row.pre_checks ?? [],
      postActions: row.post_actions ?? [],
      lastRun: row.last_run,
      nextRun: row.next_run,
      state: row.state ?? 'Idle',
      lastRelease: row.last_release,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class HotfixChannelRepository extends BaseRepository<HotfixChannelEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'hotfix_channels');
  }

  async findByProductLine(productLineId: string): Promise<HotfixChannelEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM hotfix_channels WHERE product_line_id = $1`,
      [productLineId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findEnabled(productLineId: string): Promise<HotfixChannelEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM hotfix_channels WHERE product_line_id = $1 AND enabled = true`,
      [productLineId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateActiveHotfixes(id: string, count: number, lastHotfix?: string): Promise<HotfixChannelEntity | null> {
    const result = await this.db.query(
      `UPDATE hotfix_channels SET active_hotfixes = $1, last_hotfix = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [count, lastHotfix ?? null, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): HotfixChannelEntity {
    return {
      id: row.id,
      productLineId: row.product_line_id,
      name: row.name,
      enabled: row.enabled ?? true,
      branchPattern: row.branch_pattern ?? '^hotfix/.*$',
      skipStages: row.skip_stages ?? [],
      requiredStages: row.required_stages ?? [],
      approvalRequired: row.approval_required ?? true,
      approvalTimeout: row.approval_timeout ?? 30,
      autoMerge: row.auto_merge ?? false,
      notifyOnCall: row.notify_on_call ?? true,
      maxDuration: row.max_duration ?? 60,
      activeHotfixes: row.active_hotfixes ?? 0,
      lastHotfix: row.last_hotfix,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}