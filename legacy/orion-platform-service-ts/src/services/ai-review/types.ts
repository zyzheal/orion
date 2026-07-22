/**
 * AI Code Review - 类型定义
 *
 * 涵盖审查规则、审查评论、审查结果、审查配置等核心类型。
 */

// ==================== 审查规则类型 ====================

/** 审查规则分类 */
export enum RuleCategory {
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  STYLE = 'style',
  BEST_PRACTICE = 'best-practice',
}

/** 严重程度 */
export enum Severity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
  SUGGESTION = 'suggestion',
}

/** 审查规则 */
export interface ReviewRule {
  /** 规则唯一标识 */
  id: string;
  /** 规则名称 */
  name: string;
  /** 规则分类 */
  category: RuleCategory;
  /** 严重程度 */
  severity: Severity;
  /** 匹配模式 (正则或关键字) */
  pattern: string;
  /** 规则描述 */
  description: string;
  /** 修复建议 */
  suggestion?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 适用的文件扩展名过滤 (空表示所有文件) */
  fileExtensions?: string[];
  /** 元数据 */
  metadata?: {
    createdAt: Date;
    updatedAt: Date;
    author?: string;
    tags?: string[];
  };
}

// ==================== 审查评论类型 ====================

/** 审查评论 (单条发现的问题) */
export interface ReviewComment {
  /** 评论唯一标识 */
  id: string;
  /** 触发的规则 ID (如果是 AI 生成的则为 'ai-generated') */
  ruleId: string;
  /** 文件路径 */
  filePath: string;
  /** 行号 */
  lineNumber: number;
  /** 严重程度 */
  severity: Severity;
  /** 评论内容 */
  message: string;
  /** 修复建议 */
  suggestion?: string;
  /** 原始代码行 */
  codeSnippet?: string;
  /** 是否重复 (被去重标记) */
  isDuplicate?: boolean;
  /** 来源: 'rule' | 'ai' | 'manual' */
  source: 'rule' | 'ai' | 'manual';
  /** 创建时间 */
  createdAt: Date;
}

// ==================== 审查结果类型 ====================

/** 审查结果汇总 */
export interface ReviewResult {
  /** 审查结果唯一标识 */
  id: string;
  /** 关联的 PR/MR ID */
  prId: string;
  /** 仓库 ID */
  repoId: string;
  /** 审查评论列表 */
  comments: ReviewComment[];
  /** 审查摘要 */
  summary: ReviewSummary;
  /** 审查评分 (0-100) */
  score: number;
  /** 审查耗时 (毫秒) */
  duration: number;
  /** 审查状态 */
  status: ReviewStatus;
  /** 是否自动批准 */
  autoApproved: boolean;
  /** 创建时间 */
  createdAt: Date;
  /** 完成时间 */
  completedAt?: Date;
}

/** 审查摘要 */
export interface ReviewSummary {
  /** 总问题数 */
  totalIssues: number;
  /** 按严重程度分类的计数 */
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  suggestionCount: number;
  /** 按分类统计 */
  categoryBreakdown: Record<RuleCategory, number>;
  /** 涉及的文件数 */
  affectedFiles: number;
  /** 审查结论 */
  verdict: 'approved' | 'changes_requested' | 'needs_review';
  /** 审查结论说明 */
  verdictReason: string;
}

/** 审查状态 */
export type ReviewStatus = 'pending' | 'running' | 'completed' | 'failed';

// ==================== 审查配置类型 ====================

/** 审查配置 */
export interface ReviewConfig {
  /** 启用的审查规则 */
  rules: ReviewRule[];
  /** 启用的规则分类 */
  enabledCategories: RuleCategory[];
  /** 每个文件最大评论数 */
  maxCommentsPerFile: number;
  /** 总评论数上限 */
  maxTotalComments: number;
  /** 自动批准阈值 (评分 >= 此值自动批准) */
  autoApproveThreshold: number;
  /** 是否去重 */
  deduplicationEnabled: boolean;
  /** 相似度阈值 (用于去重, 0-1) */
  similarityThreshold: number;
  /** 是否发布评论到 PR */
  postCommentsToPR: boolean;
  /** LLM 配置 */
  llm?: {
    provider: 'openai' | 'anthropic' | 'mock';
    apiKey?: string;
    model?: string;
    temperature?: number;
  };
  /** GitLab 配置 */
  gitlab?: {
    apiUrl: string;
    token: string;
  };
  /** Gerrit 配置 */
  gerrit?: {
    apiUrl: string;
    user: string;
    password: string;
  };
}

// ==================== Diff 分析类型 ====================

/** 文件变更块 */
export interface DiffHunk {
  /** 原始文件起始行 */
  oldStart: number;
  /** 原始文件行数 */
  oldLines: number;
  /** 新文件起始行 */
  newStart: number;
  /** 新文件行数 */
  newLines: number;
  /** 变更内容行 */
  lines: DiffLine[];
  /** 原始 header */
  header: string;
}

/** 单行变更 */
export interface DiffLine {
  /** 行号 (在新文件中) */
  lineNumber: number;
  /** 行号 (在旧文件中) */
  oldLineNumber?: number;
  /** 变更类型 */
  type: 'added' | 'removed' | 'context';
  /** 行内容 */
  content: string;
}

/** 文件变更 */
export interface FileDiff {
  /** 旧文件路径 */
  oldPath: string;
  /** 新文件路径 */
  newPath: string;
  /** 是否是新增文件 */
  isNewFile: boolean;
  /** 是否是删除文件 */
  isDeletedFile: boolean;
  /** 是否重命名 */
  isRenamed: boolean;
  /** 变更块列表 */
  hunks: DiffHunk[];
  /** 新增行数 */
  additions: number;
  /** 删除行数 */
  deletions: number;
}

/** 变更行信息 (用于审查评论定位) */
export interface ChangedLine {
  /** 文件路径 */
  filePath: string;
  /** 行号 */
  lineNumber: number;
  /** 行内容 */
  content: string;
}

// ==================== Diff 解析结果 ====================

export interface DiffParseResult {
  /** 变更的文件列表 */
  files: FileDiff[];
  /** 所有变更行 */
  changedLines: ChangedLine[];
  /** 总新增行数 */
  totalAdditions: number;
  /** 总删除行数 */
  totalDeletions: number;
}

// ==================== API 请求/响应类型 ====================

/** 触发审查请求 */
export interface ReviewRequest {
  /** PR/MR ID */
  prId: string;
  /** 仓库 ID */
  repoId: string;
  /** Git diff 内容 */
  diff: string;
  /** 仓库类型 */
  repoType?: 'gitlab' | 'gerrit' | 'github';
  /** 额外上下文 */
  context?: Record<string, unknown>;
}

/** 审查响应 */
export interface ReviewResponse {
  /** 审查结果 */
  result: ReviewResult;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/** 审查历史查询参数 */
export interface ReviewHistoryQuery {
  /** 仓库 ID */
  repoId?: string;
  /** PR ID */
  prId?: string;
  /** 状态过滤 */
  status?: ReviewStatus;
  /** 分页页码 */
  page?: number;
  /** 每页数量 */
  perPage?: number;
}

/** 分页审查历史 */
export interface ReviewHistoryPage {
  /** 审查结果列表 */
  results: ReviewResult[];
  /** 总数 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页数量 */
  perPage: number;
}

/** 规则管理请求 */
export interface RuleCreateRequest {
  name: string;
  category: RuleCategory;
  severity: Severity;
  pattern: string;
  description: string;
  suggestion?: string;
  fileExtensions?: string[];
}

export interface RuleUpdateRequest {
  name?: string;
  category?: RuleCategory;
  severity?: Severity;
  pattern?: string;
  description?: string;
  suggestion?: string;
  enabled?: boolean;
  fileExtensions?: string[];
}
