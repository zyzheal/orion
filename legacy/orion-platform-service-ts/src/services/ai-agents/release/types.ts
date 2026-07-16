/**
 * Release Notes Agent 类型定义
 *
 * 涵盖版本发布说明生成相关的类型
 */

/**
 * Git 提交信息
 */
export interface GitCommit {
  /** 提交哈希 (完整) */
  hash: string;
  /** 提交哈希 (短) */
  shortHash: string;
  /** 提交信息 */
  message: string;
  /** 作者 */
  author: string;
  /** 作者邮箱 */
  authorEmail: string;
  /** 提交日期 */
  date: string;
  /** 影响的文件列表 */
  files?: string[];
  /** 提交类型 (feat, fix, docs, etc.) */
  type?: CommitType;
  /** 影响的模块/组件 */
  scopes?: string[];
}

/**
 * 提交类型 (Conventional Commits)
 */
export type CommitType =
  | 'feat'
  | 'fix'
  | 'docs'
  | 'style'
  | 'refactor'
  | 'perf'
  | 'test'
  | 'build'
  | 'ci'
  | 'chore'
  | 'revert'
  | 'breaking';

/**
 * 版本信息
 */
export interface VersionInfo {
  /** 版本号 (semver) */
  version: string;
  /** 版本类型 (major, minor, patch) */
  releaseType: 'major' | 'minor' | 'patch';
  /** 发布日期 */
  releaseDate: string;
  /** 上一个版本 */
  previousVersion?: string;
  /** 是否有破坏性变更 */
  hasBreakingChanges: boolean;
}

/**
 * Release Notes 生成选项
 */
export interface ReleaseNotesOptions {
  /** 仓库路径 */
  repoPath: string;
  /** 起始版本/标签 */
  from: string;
  /** 结束版本/标签 */
  to: string;
  /** 是否包含所有文件变更 */
  includeFileChanges?: boolean;
  /** 是否使用 AI 增强描述 */
  enhanceWithAI?: boolean;
  /** 目标语言 */
  language?: 'zh-CN' | 'en-US';
  /** 自定义分组规则 */
  customGroups?: Record<string, string[]>;
}

/**
 * Release Notes 生成结果
 */
export interface ReleaseNotesResult {
  /** 版本信息 */
  version: VersionInfo;
  /** 发布说明内容 (Markdown) */
  content: string;
  /** 分组后的变更列表 */
  changes: ReleaseChanges;
  /** AI 增强的摘要 */
  aiSummary?: string;
  /** 统计信息 */
  stats: ReleaseNotesStats;
  /** 原始提交列表 */
  commits: GitCommit[];
  /** 生成时间 */
  generatedAt: string;
}

/**
 * 分组后的变更
 */
export interface ReleaseChanges {
  /** 新功能 */
  features: ChangeItem[];
  /** Bug 修复 */
  fixes: ChangeItem[];
  /** 破坏性变更 */
  breaking: ChangeItem[];
  /** 文档更新 */
  documentation: ChangeItem[];
  /** 性能优化 */
  performance: ChangeItem[];
  /** 代码重构 */
  refactoring: ChangeItem[];
  /** 测试相关 */
  tests: ChangeItem[];
  /** 构建/CI 相关 */
  build: ChangeItem[];
  /** 其他变更 */
  other: ChangeItem[];
}

/**
 * 变更项
 */
export interface ChangeItem {
  /** 变更描述 */
  description: string;
  /** 影响的范围/模块 */
  scope?: string;
  /** 关联的提交哈希 */
  commitHash: string;
  /** 是否为重大变更 */
  isBreaking?: boolean;
  /** AI 增强的描述 */
  enhancedDescription?: string;
  /** 影响的文件 */
  files?: string[];
}

/**
 * Release Notes 统计信息
 */
export interface ReleaseNotesStats {
  /** 总提交数 */
  totalCommits: number;
  /** 新功能数 */
  featuresCount: number;
  /** Bug 修复数 */
  fixesCount: number;
  /** 破坏性变更数 */
  breakingChangesCount: number;
  /** 文档变更数 */
  docsCount: number;
  /** 贡献者数量 */
  contributorsCount: number;
  /** 新增/修改/删除行数 */
  linesChanged?: {
    added: number;
    removed: number;
    modified: number;
  };
}

/**
 * Release Notes Agent 配置
 */
export interface ReleaseNotesAgentConfig {
  /** 是否启用 AI 增强 */
  enableAIEnhancement: boolean;
  /** 默认语言 */
  defaultLanguage: 'zh-CN' | 'en-US';
  /** 是否包含文件变更详情 */
  includeFileDetails: boolean;
  /** 是否自动检测版本类型 */
  autoDetectVersionType: boolean;
}

/**
 * Git diff 结果
 */
export interface GitDiff {
  /** 文件路径 */
  file: string;
  /** 变更状态 (added, modified, deleted) */
  status: 'added' | 'modified' | 'deleted';
  /** 新增行数 */
  additions: number;
  /** 删除行数 */
  deletions: number;
  /** 变更内容 */
  diff?: string;
}

/**
 * 标签信息
 */
export interface GitTag {
  /** 标签名 */
  name: string;
  /** 标签信息 */
  message?: string;
  /** 标签日期 */
  date: string;
  /** 关联的提交哈希 */
  commit: string;
}