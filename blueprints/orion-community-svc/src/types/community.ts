/**
 * Community Ecosystem - 类型定义
 */

/** 贡献类型 */
export enum ContributionType {
  PLUGIN = 'plugin',
  TEMPLATE = 'template',
  TOOL = 'tool',
  DOCUMENTATION = 'documentation',
  OTHER = 'other',
}

/** 贡献状态 */
export enum ContributionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

/** 贡献实体 */
export interface Contribution {
  id: string;
  authorId: string;
  authorName: string;
  type: ContributionType;
  title: string;
  description?: string;
  repositoryUrl?: string;
  documentationUrl?: string;
  version: string;
  status: ContributionStatus;
  tags: string[];
  downloadsCount: number;
  starsCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 创建贡献请求 */
export interface CreateContributionInput {
  authorId: string;
  authorName: string;
  type: ContributionType;
  title: string;
  description?: string;
  repositoryUrl?: string;
  documentationUrl?: string;
  version?: string;
  tags?: string[];
}

/** 更新贡献请求 */
export interface UpdateContributionInput {
  title?: string;
  description?: string;
  repositoryUrl?: string;
  documentationUrl?: string;
  version?: string;
  tags?: string[];
  status?: ContributionStatus;
}

/** 插件状态 */
export enum PluginStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PUBLISHED = 'published',
  DEPRECATED = 'deprecated',
}

/** 插件实体 */
export interface Plugin {
  id: string;
  contributionId?: string;
  name: string;
  description?: string;
  authorId: string;
  authorName: string;
  version: string;
  manifest: Record<string, unknown>;
  downloadUrl?: string;
  checksumSha256?: string;
  status: PluginStatus;
  category?: string;
  tags: string[];
  downloadsCount: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 提交插件请求 */
export interface SubmitPluginInput {
  name: string;
  description?: string;
  authorId: string;
  authorName: string;
  version?: string;
  manifest: Record<string, unknown>;
  downloadUrl?: string;
  checksumSha256?: string;
  category?: string;
  tags?: string[];
}

/** 评论状态 */
export enum ReviewStatus {
  PUBLISHED = 'published',
  HIDDEN = 'hidden',
  FLAGGED = 'flagged',
}

/** 评论实体 */
export interface Review {
  id: string;
  targetId: string;
  targetType: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  title?: string;
  content?: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

/** 创建评论请求 */
export interface CreateReviewInput {
  targetId: string;
  targetType: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  title?: string;
  content?: string;
}

/** 反馈状态 */
export enum FeedbackStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  REJECTED = 'rejected',
}

/** 反馈严重性 */
export enum FeedbackSeverity {
  INFO = 'info',
  MINOR = 'minor',
  MAJOR = 'major',
  CRITICAL = 'critical',
}

/** 反馈实体 */
export interface Feedback {
  id: string;
  targetId: string;
  targetType: string;
  userId: string;
  userName: string;
  type: string;
  content: string;
  severity: FeedbackSeverity;
  status: FeedbackStatus;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

/** 创建反馈请求 */
export interface CreateFeedbackInput {
  targetId: string;
  targetType: string;
  userId: string;
  userName: string;
  type?: string;
  content: string;
  severity?: FeedbackSeverity;
}

/** 分页参数 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
