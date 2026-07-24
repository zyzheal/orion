/**
 * Internal Library Types - 二方库类型定义
 *
 * 基于 M30 二方库管理设计
 */

// ==================== 基础类型 ====================

export type LibraryLanguage = 'java' | 'node' | 'python' | 'go' | 'rust' | 'dotnet';
export type LibraryStatus = 'active' | 'deprecated' | 'archived' | 'development';
export type VersionStatus = 'snapshot' | 'alpha' | 'beta' | 'rc' | 'stable' | 'deprecated';

// ==================== 二方库版本 ====================

export interface LibraryVersion {
  version: string;
  status: VersionStatus;
  releasedAt: Date;
  changelog?: string;

  // 安全信息
  securityScore?: number;
  vulnerabilities?: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    count: number;
  }>;

  // 质量信息
  testCoverage?: number;

  // 废弃信息
  eolDate?: Date;
  deprecationReason?: string;
  migrationGuide?: string;

  // 发布信息
  publishedTo?: string[]; // 仓库列表
  artifactId?: string; // 对应产物 ID
}

// ==================== Breaking Change ====================

export interface BreakingChange {
  version: string;
  changes: string[];
  migrationGuide: string;
  deprecationPeriod: string; // e.g., "6 months"
  announcedAt: Date;
  effectiveAt: Date;
}

// ==================== 二方库依赖者 ====================

export interface LibraryDependent {
  repoName: string;
  teamName: string;
  currentVersion: string;
  latestCompatibleVersion?: string;
  upgradeAvailable: boolean;
  upgradeType?: 'patch' | 'minor' | 'major' | 'breaking';
  lastUpdated: Date;
}

// ==================== 二方库质量指标 ====================

export interface LibraryQuality {
  testCoverage?: number;
  securityScore?: number;
  openIssues?: number;
  openPRs?: number;
  lastReleaseAge?: number; // days
  staleBranches?: number;

  // AI 使用统计
  aiReviewScore?: number;
}

// ==================== 二方库实体 ====================

export interface InternalLibrary {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  language: LibraryLanguage;
  status: LibraryStatus;

  // 基本信息
  owner: string; // team name
  maintainers: string[]; // user IDs
  repository: string; // Git URL
  documentation?: string;
  sla?: string;

  // 版本信息
  currentVersion: string;
  latestStableVersion: string;
  versions: LibraryVersion[];

  // Breaking Changes
  breakingChanges?: BreakingChange[];

  // 依赖统计
  dependents: {
    totalRepos: number;
    totalTeams: number;
    reposUsingLatest: number;
    reposNeedingUpgrade: number;
    list?: LibraryDependent[];
  };

  // 质量指标
  quality?: LibraryQuality;

  // 发布配置
  publishConfig?: {
    repository?: string;
    autoPublish?: boolean;
    requireApproval?: boolean;
    approvers?: string[];
  };

  // 标签
  labels?: Record<string, string>;
  annotations?: Record<string, string>;

  // 时间戳
  createdAt: Date;
  updatedAt: Date;

  // 租户
  tenantId?: string;
}

// ==================== 创建二方库输入 ====================

export interface CreateLibraryInput {
  name: string;
  displayName?: string;
  description?: string;
  language: LibraryLanguage;

  owner: string;
  maintainers?: string[];
  repository: string;
  documentation?: string;
  sla?: string;

  publishConfig?: {
    repository?: string;
    autoPublish?: boolean;
    requireApproval?: boolean;
    approvers?: string[];
  };

  labels?: Record<string, string>;

  tenantId?: string;
}

// ==================== 发布版本输入 ====================

export interface PublishVersionInput {
  libraryId: string;
  version: string;
  status?: VersionStatus;
  changelog?: string;
  artifactId?: string;

  securityScore?: number;
  testCoverage?: number;

  publishedTo?: string[];
}

// ==================== 废弃二方库输入 ====================

export interface DeprecateLibraryInput {
  libraryId: string;
  reason: string;
  eolDate: Date;
  migrationGuide?: string;
  replacementLibrary?: string;
}

// ==================== 二方库查询选项 ====================

export interface LibraryQueryOptions {
  language?: LibraryLanguage;
  status?: LibraryStatus;
  owner?: string;
  name?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'dependentsCount';
  sortOrder?: 'ASC' | 'DESC';
}

// ==================== 依赖检查结果 ====================

export interface DependencyCheckResult {
  libraryName: string;
  currentVersion: string;
  latestVersion: string;
  status: 'latest' | 'upgrade_available' | 'breaking_change' | 'deprecated';

  upgradeType?: 'patch' | 'minor' | 'major' | 'breaking';
  securityScore?: number;
  breakingChanges?: string[];
  migrationGuide?: string;
}

// ==================== 自动升级 PR ====================

export interface AutoUpgradePR {
  id: string;
  libraryId: string;
  libraryName: string;
  libraryVersion: string;
  targetRepo: string;
  targetBranch: string;

  oldVersion: string;
  newVersion: string;
  upgradeType: 'patch' | 'minor' | 'major';

  prTitle: string;
  prBody: string;
  prUrl?: string;
  prNumber?: number;

  ciStatus?: 'pending' | 'passed' | 'failed';
  merged?: boolean;

  createdAt: Date;
  updatedAt: Date;
}