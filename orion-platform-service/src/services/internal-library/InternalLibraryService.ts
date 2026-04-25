/**
 * Internal Library Service - 二方库管理服务
 *
 * 基于 M30 二方库管理设计
 */

import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import {
  InternalLibrary,
  LibraryVersion,
  LibraryDependent,
  CreateLibraryInput,
  PublishVersionInput,
  DeprecateLibraryInput,
  LibraryQueryOptions,
  DependencyCheckResult,
  LibraryLanguage,
  LibraryStatus,
  VersionStatus,
} from '../../models/InternalLibrary';
import {
  InternalLibraryRepository,
  LibraryVersionRepository,
  LibraryDependentRepository,
  LibraryEntity,
} from '../../repositories/InternalLibraryRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class InternalLibraryService {
  private libraryRepo?: InternalLibraryRepository;
  private versionRepo?: LibraryVersionRepository;
  private dependentRepo?: LibraryDependentRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.libraryRepo = new InternalLibraryRepository(db);
      this.versionRepo = new LibraryVersionRepository(db);
      this.dependentRepo = new LibraryDependentRepository(db);
    }
  }

  // ==================== CRUD ====================

  /**
   * 创建二方库
   */
  async create(input: CreateLibraryInput): Promise<InternalLibrary> {
    if (!this.libraryRepo) throw new Error('Database not configured');

    const id = uuidv4();
    const now = new Date();

    const entity = await this.libraryRepo.create({
      id,
      tenantId: input.tenantId ?? null,
      name: input.name,
      displayName: input.displayName ?? null,
      description: input.description ?? null,
      language: input.language,
      status: 'development',

      owner: input.owner,
      maintainers: input.maintainers ?? [],
      repository: input.repository,
      documentation: input.documentation ?? null,
      sla: input.sla ?? null,

      currentVersion: '',
      latestStableVersion: '',
      versions: [],
      breakingChanges: [],
      dependentsTotal: 0,
      dependentsTeams: 0,
      dependentsUsingLatest: 0,
      dependentsNeedingUpgrade: 0,
      dependentsList: [],

      qualityTestCoverage: null,
      qualitySecurityScore: null,
      qualityOpenIssues: 0,
      qualityOpenPRs: 0,
      qualityLastReleaseAge: null,

      publishRepository: input.publishConfig?.repository ?? null,
      publishAutoPublish: input.publishConfig?.autoPublish ?? false,
      publishRequireApproval: input.publishConfig?.requireApproval ?? true,
      publishApprovers: input.publishConfig?.approvers ?? [],

      labels: input.labels ?? {},
      annotations: {},
      createdAt: now,
      updatedAt: now,
    });

    logger.info({ libraryId: entity.id, name: entity.name, language: entity.language }, 'Internal library created');
    return this.mapEntityToLibrary(entity);
  }

  /**
   * 获取二方库详情
   */
  async getById(id: string): Promise<InternalLibrary | undefined> {
    if (!this.libraryRepo) return undefined;
    const entity = await this.libraryRepo.findById(id);
    return entity ? this.mapEntityToLibrary(entity) : undefined;
  }

  /**
   * 按名称获取二方库
   */
  async getByName(name: string): Promise<InternalLibrary | undefined> {
    if (!this.libraryRepo) return undefined;
    const entity = await this.libraryRepo.findByName(name);
    return entity ? this.mapEntityToLibrary(entity) : undefined;
  }

  /**
   * 列出二方库
   */
  async list(options?: LibraryQueryOptions): Promise<InternalLibrary[]> {
    if (!this.libraryRepo) return [];
    const result = await this.libraryRepo.find(options ?? {});
    return result.entities.map(e => this.mapEntityToLibrary(e));
  }

  /**
   * 按语言列出二方库
   */
  async listByLanguage(language: LibraryLanguage): Promise<InternalLibrary[]> {
    if (!this.libraryRepo) return [];
    const entities = await this.libraryRepo.findByLanguage(language);
    return entities.map(e => this.mapEntityToLibrary(e));
  }

  /**
   * 按团队列出二方库
   */
  async listByOwner(owner: string): Promise<InternalLibrary[]> {
    if (!this.libraryRepo) return [];
    const entities = await this.libraryRepo.findByOwner(owner);
    return entities.map(e => this.mapEntityToLibrary(e));
  }

  /**
   * 删除二方库
   */
  async delete(id: string): Promise<boolean> {
    if (!this.libraryRepo) return false;
    return this.libraryRepo.delete(id);
  }

  // ==================== 版本管理 ====================

  /**
   * 发布新版本
   */
  async publishVersion(input: PublishVersionInput): Promise<LibraryVersion> {
    if (!this.versionRepo || !this.libraryRepo) throw new Error('Database not configured');

    const library = await this.libraryRepo.findById(input.libraryId);
    if (!library) throw new Error('Library not found');

    const versionId = uuidv4();
    const now = new Date();

    const versionEntity = await this.versionRepo.create({
      id: versionId,
      libraryId: input.libraryId,
      version: input.version,
      status: input.status ?? 'stable',
      releasedAt: now,
      changelog: input.changelog ?? null,

      securityScore: input.securityScore ?? null,
      vulnerabilities: [],
      testCoverage: input.testCoverage ?? null,

      eolDate: null,
      deprecationReason: null,
      migrationGuide: null,

      publishedTo: input.publishedTo ?? [],
      artifactId: input.artifactId ?? null,

      createdAt: now,
    });

    // 更新库的版本信息
    const versions = library.versions ?? [];
    versions.push({
      version: input.version,
      status: input.status ?? 'stable',
      releasedAt: now,
    });

    await this.libraryRepo.updateVersion(
      input.libraryId,
      input.version,
      input.status === 'stable' ? input.version : library.latest_stable_version
    );

    logger.info({ libraryId: input.libraryId, version: input.version }, 'Library version published');
    return this.mapEntityToVersion(versionEntity);
  }

  /**
   * 获取二方库版本列表
   */
  async getVersions(libraryId: string): Promise<LibraryVersion[]> {
    if (!this.versionRepo) return [];
    const entities = await this.versionRepo.findByLibrary(libraryId);
    return entities.map(e => this.mapEntityToVersion(e));
  }

  /**
   * 获取特定版本
   */
  async getVersion(libraryId: string, version: string): Promise<LibraryVersion | undefined> {
    if (!this.versionRepo) return undefined;
    const entity = await this.versionRepo.findByLibraryAndVersion(libraryId, version);
    return entity ? this.mapEntityToVersion(entity) : undefined;
  }

  /**
   * 废弃版本
   */
  async deprecateVersion(libraryId: string, version: string, reason: string, eolDate: Date, migrationGuide?: string): Promise<LibraryVersion | null> {
    if (!this.versionRepo) return null;

    const entity = await this.versionRepo.findByLibraryAndVersion(libraryId, version);
    if (!entity) return null;

    const result = await this.versionRepo.updateStatus(entity.id, 'deprecated');
    return result ? this.mapEntityToVersion(result) : null;
  }

  // ==================== 废弃管理 ====================

  /**
   * 废弃二方库
   */
  async deprecate(input: DeprecateLibraryInput): Promise<InternalLibrary | null> {
    if (!this.libraryRepo) return null;

    const library = await this.libraryRepo.findById(input.libraryId);
    if (!library) return null;

    const result = await this.libraryRepo.updateStatus(input.libraryId, 'deprecated');
    if (!result) return null;

    logger.info({ libraryId: input.libraryId, reason: input.reason, eolDate: input.eolDate }, 'Library deprecated');
    return this.mapEntityToLibrary(result);
  }

  /**
   * 激活二方库
   */
  async activate(id: string): Promise<InternalLibrary | null> {
    if (!this.libraryRepo) return null;
    const result = await this.libraryRepo.updateStatus(id, 'active');
    return result ? this.mapEntityToLibrary(result) : null;
  }

  // ==================== 依赖追踪 ====================

  /**
   * 获取依赖者列表
   */
  async getDependents(libraryId: string): Promise<LibraryDependent[]> {
    if (!this.dependentRepo) return [];
    const entities = await this.dependentRepo.findByLibrary(libraryId);
    return entities.map(e => ({
      id: e.id,
      libraryId: e.libraryId,
      repoName: e.repoName,
      teamName: e.teamName,
      currentVersion: e.currentVersion,
      latestCompatibleVersion: e.latestCompatibleVersion,
      upgradeAvailable: e.upgradeAvailable,
      upgradeType: e.upgradeType as 'patch' | 'minor' | 'major' | 'breaking' | undefined,
      lastUpdated: e.lastUpdated,
    }));
  }

  /**
   * 添加依赖关系
   */
  async addDependent(libraryId: string, repoName: string, teamName: string, version: string): Promise<LibraryDependent> {
    if (!this.dependentRepo) throw new Error('Database not configured');

    const now = new Date();
    const entity = await this.dependentRepo.create({
      id: uuidv4(),
      libraryId,
      repoName,
      teamName,
      currentVersion: version,
      latestCompatibleVersion: null,
      upgradeAvailable: false,
      upgradeType: null,
      lastUpdated: now,
      createdAt: now,
    });

    logger.info({ libraryId, repoName, version }, 'Library dependent added');
    return {
      id: entity.id,
      libraryId: entity.libraryId,
      repoName: entity.repoName,
      teamName: entity.teamName,
      currentVersion: entity.currentVersion,
      upgradeAvailable: entity.upgradeAvailable,
      lastUpdated: entity.lastUpdated,
    };
  }

  /**
   * 更新依赖版本
   */
  async updateDependentVersion(libraryId: string, repoName: string, newVersion: string): Promise<boolean> {
    if (!this.dependentRepo) return false;

    const dependents = await this.dependentRepo.findByLibrary(libraryId);
    const dependent = dependents.find(d => d.repoName === repoName);
    if (!dependent) return false;

    // 检查是否需要升级
    const library = await this.libraryRepo?.findById(libraryId);
    const latestVersion = library?.latest_stable_version ?? '';
    const upgradeAvailable = newVersion !== latestVersion;

    let upgradeType: string | null = null;
    if (upgradeAvailable) {
      upgradeType = this.determineUpgradeType(newVersion, latestVersion);
    }

    await this.dependentRepo.updateVersion(dependent.id, newVersion, upgradeAvailable, upgradeType);
    return true;
  }

  /**
   * 检查项目依赖
   */
  async checkDependencies(repoName: string): Promise<DependencyCheckResult[]> {
    if (!this.dependentRepo || !this.libraryRepo) return [];

    const dependents = await this.dependentRepo.findByRepo(repoName);
    const results: DependencyCheckResult[] = [];

    for (const dep of dependents) {
      const library = await this.libraryRepo.findById(dep.libraryId);
      if (!library) continue;

      const latestVersion = library.latest_stable_version;
      const isLatest = dep.currentVersion === latestVersion;
      const isDeprecated = library.status === 'deprecated';

      let status: 'latest' | 'upgrade_available' | 'breaking_change' | 'deprecated';
      if (isDeprecated) {
        status = 'deprecated';
      } else if (!isLatest) {
        const upgradeType = this.determineUpgradeType(dep.currentVersion, latestVersion);
        status = upgradeType === 'breaking' ? 'breaking_change' : 'upgrade_available';
      } else {
        status = 'latest';
      }

      results.push({
        libraryName: library.name,
        currentVersion: dep.currentVersion,
        latestVersion,
        status,
        upgradeType: isLatest ? undefined : (this.determineUpgradeType(dep.currentVersion, latestVersion) as 'patch' | 'minor' | 'major' | 'breaking'),
        securityScore: library.quality_security_score ?? undefined,
      });
    }

    return results;
  }

  // ==================== 统计更新 ====================

  /**
   * 更新依赖统计
   */
  async updateDependentsStats(libraryId: string): Promise<void> {
    if (!this.dependentRepo || !this.libraryRepo) return;

    const dependents = await this.dependentRepo.findByLibrary(libraryId);
    const totalRepos = dependents.length;
    const teams = new Set(dependents.map(d => d.teamName));
    const totalTeams = teams.size;

    const library = await this.libraryRepo.findById(libraryId);
    const latestVersion = library?.latest_stable_version ?? '';
    const usingLatest = dependents.filter(d => d.currentVersion === latestVersion).length;
    const needingUpgrade = totalRepos - usingLatest;

    await this.libraryRepo.updateDependentsStats(libraryId, totalRepos, totalTeams, usingLatest, needingUpgrade);
  }

  // ==================== 辅助方法 ====================

  private determineUpgradeType(currentVersion: string, targetVersion: string): 'patch' | 'minor' | 'major' | 'breaking' {
    // 简化版本比较
    const currentParts = currentVersion.split('.').map(Number);
    const targetParts = targetVersion.split('.').map(Number);

    if (targetParts[0] > currentParts[0]) return 'major';
    if (targetParts[1] > currentParts[1]) return 'minor';
    return 'patch';
  }

  private mapEntityToLibrary(entity: LibraryEntity): InternalLibrary {
    return {
      id: entity.id,
      name: entity.name,
      displayName: entity.displayName,
      description: entity.description,
      language: entity.language as LibraryLanguage,
      status: entity.status as LibraryStatus,

      owner: entity.owner,
      maintainers: entity.maintainers,
      repository: entity.repository,
      documentation: entity.documentation,
      sla: entity.sla,

      currentVersion: entity.currentVersion,
      latestStableVersion: entity.latestStableVersion,
      versions: entity.versions,
      breakingChanges: entity.breakingChanges,

      dependents: {
        totalRepos: entity.dependentsTotal,
        totalTeams: entity.dependentsTeams,
        reposUsingLatest: entity.dependentsUsingLatest,
        reposNeedingUpgrade: entity.dependentsNeedingUpgrade,
        list: entity.dependentsList,
      },

      quality: {
        testCoverage: entity.qualityTestCoverage,
        securityScore: entity.qualitySecurityScore,
        openIssues: entity.qualityOpenIssues,
        openPRs: entity.qualityOpenPRs,
        lastReleaseAge: entity.qualityLastReleaseAge,
      },

      publishConfig: {
        repository: entity.publishRepository,
        autoPublish: entity.publishAutoPublish,
        requireApproval: entity.publishRequireApproval,
        approvers: entity.publishApprovers,
      },

      labels: entity.labels,
      annotations: entity.annotations,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      tenantId: entity.tenantId,
    };
  }

  private mapEntityToVersion(entity: any): LibraryVersion {
    return {
      version: entity.version,
      status: entity.status as VersionStatus,
      releasedAt: entity.releasedAt,
      changelog: entity.changelog,

      securityScore: entity.securityScore,
      vulnerabilities: entity.vulnerabilities,
      testCoverage: entity.testCoverage,

      eolDate: entity.eolDate,
      deprecationReason: entity.deprecationReason,
      migrationGuide: entity.migrationGuide,

      publishedTo: entity.publishedTo,
      artifactId: entity.artifactId,
    };
  }
}