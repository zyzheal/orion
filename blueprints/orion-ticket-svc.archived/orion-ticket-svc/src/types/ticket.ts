/**
 * Orion ITSM Ticket Service - Type Definitions
 * 工单服务完整类型定义
 */

// ============================================================
// 基础枚举
// ============================================================

/** 工单状态 */
export enum TicketStatus {
  NEW = 'new',
  OPEN = 'open',
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  WAITING_CUSTOMER = 'waiting_customer',
  WAITING_VENDOR = 'waiting_vendor',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

/** 工单优先级 */
export enum TicketPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  PLANNED = 'planned',
}

/** 工单类型 */
export enum TicketType {
  INCIDENT = 'incident',
  SERVICE_REQUEST = 'service_request',
  PROBLEM = 'problem',
  CHANGE = 'change',
  TASK = 'task',
}

/** 工单来源 */
export enum TicketSource {
  WEB = 'web',
  EMAIL = 'email',
  API = 'api',
  MONITORING = 'monitoring',
  AI_CLASSIFIER = 'ai_classifier',
  MANUAL = 'manual',
}

/** 变更风险等级 */
export enum ChangeRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/** 变更类型 */
export enum ChangeType {
  STANDARD = 'standard',
  NORMAL = 'normal',
  EMERGENCY = 'emergency',
}

/** 变更状态 */
export enum ChangeStatus {
  DRAFT = 'draft',
  REQUESTED = 'requested',
  ASSESSMENT = 'assessment',
  AUTHORIZATION = 'authorization',
  SCHEDULED = 'scheduled',
  IMPLEMENTING = 'implementing',
  REVIEW = 'review',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/** SLA 指标类型 */
export enum SLAMetricType {
  RESPONSE_TIME = 'response_time',
  RESOLUTION_TIME = 'resolution_time',
  UPDATE_FREQUENCY = 'update_frequency',
  FIRST_CONTACT_RESOLUTION = 'first_contact_resolution',
}

/** SLA 状态 */
export enum SLAStatus {
  WITHIN_SLA = 'within_sla',
  WARNING = 'warning',
  BREACHED = 'breached',
  PAUSED = 'paused',
}

/** 派单策略 */
export enum DispatchStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_LOADED = 'least_loaded',
  SKILL_BASED = 'skill_based',
  LOAD_BALANCED = 'load_balanced',
  AI_RECOMMENDED = 'ai_recommended',
}

/** 派单状态 */
export enum DispatchStatus {
  PENDING = 'pending',
  MATCHING = 'matching',
  ASSIGNED = 'assigned',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  ESCALATED = 'escalated',
}

/** 工作流节点类型 */
export enum WorkflowNodeType {
  START = 'start',
  END = 'end',
  CONDITION = 'condition',
  APPROVAL = 'approval',
  TASK = 'task',
  PARALLEL = 'parallel',
  SUBWORKFLOW = 'subworkflow',
  TIMER = 'timer',
  NOTIFICATION = 'notification',
}

/** 审批状态 */
export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DELEGATED = 'delegated',
  ESCALATED = 'escalated',
  WITHDRAWN = 'withdrawn',
}

/** 通知渠道 */
export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  IN_APP = 'in_app',
  DINGTALK = 'dingtalk',
  WEWORK = 'wework',
}

/** BI 看板类型 */
export enum DashboardType {
  EXECUTIVE = 'executive',
  MANAGER = 'manager',
  OPERATOR = 'operator',
  CUSTOMER = 'customer',
}

/** 时间范围 */
export enum TimeRange {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  THIS_WEEK = 'this_week',
  LAST_WEEK = 'last_week',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  LAST_90_DAYS = 'last_90_days',
  CUSTOM = 'custom',
}

/** 排序字段 */
export enum SortField {
  CREATED_AT = 'created_at',
  UPDATED_AT = 'updated_at',
  PRIORITY = 'priority',
  STATUS = 'status',
  TITLE = 'title',
  ASSIGNEE = 'assignee',
  DUE_DATE = 'due_date',
  SLA_DEADLINE = 'sla_deadline',
}

/** 排序方向 */
export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

// ============================================================
// 核心工单类型
// ============================================================

/** 工单 */
export interface Ticket {
  id: string;
  ticketNumber: string;
  tenantId: string;
  type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  title: string;
  description: string;
  reporterId: string;
  assigneeId: string | null;
  groupId: string | null;
  categoryId: string;
  subCategoryId: string | null;
  source: TicketSource;
  tags: string[];
  attachments: Attachment[];
  customFields: Record<string, unknown>;
  slaInfo: TicketSLAInfo | null;
  changeInfo: ChangeInfo | null;
  metadata: TicketMetadata;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  dueDate: Date | null;
}

/** 工单 SLA 信息 */
export interface TicketSLAInfo {
  policyId: string;
  policyName: string;
  responseDeadline: Date | null;
  resolutionDeadline: Date | null;
  responseStatus: SLAStatus;
  resolutionStatus: SLAStatus;
  pausedAt: Date | null;
  totalPausedSeconds: number;
}

/** 变更工单信息 */
export interface ChangeInfo {
  changeType: ChangeType;
  riskLevel: ChangeRiskLevel;
  changeStatus: ChangeStatus;
  implementationPlan: string;
  rollbackPlan: string;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  cabMeetingId: string | null;
  approvedBy: string[];
}

/** 工单元数据 */
export interface TicketMetadata {
  ipAddresses: string[];
  affectedCIs: string[];
  impactedServices: string[];
  monitoringAlertId: string | null;
  aiClassification: AIClassification | null;
  dispatchInfo: DispatchInfo | null;
}

/** AI 分类结果 */
export interface AIClassification {
  categoryId: string;
  subCategoryId: string | null;
  confidence: number;
  model: string;
  classifiedAt: Date;
}

/** 附件 */
export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
}

// ============================================================
// 工单历史与流转
// ============================================================

/** 工单历史记录 */
export interface TicketHistory {
  id: string;
  ticketId: string;
  action: HistoryAction;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  actorId: string;
  comment: string;
  fieldsChanged: FieldChange[];
  createdAt: Date;
}

/** 历史操作类型 */
export type HistoryAction =
  | 'created'
  | 'updated'
  | 'transitioned'
  | 'assigned'
  | 'escalated'
  | 'resolved'
  | 'closed'
  | 'cancelled'
  | 'commented'
  | 'attachment_added'
  | 'sla_set'
  | 'sla_breached'
  | 'dispatched'
  | 'dispatch_rejected'
  | 'approval_requested'
  | 'approval_completed';

/** 字段变更记录 */
export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

// ============================================================
// 工单评论
// ============================================================

/** 工单评论 */
export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  isPublic: boolean;
  isInternal: boolean;
  attachments: Attachment[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// 派单相关
// ============================================================

/** 派单信息 */
export interface DispatchInfo {
  dispatchId: string;
  strategy: DispatchStrategy;
  status: DispatchStatus;
  recommendedAssignees: DispatchCandidate[];
  selectedAssignee: string | null;
  dispatchedAt: Date | null;
  acceptedAt: Date | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  escalationLevel: number;
  maxEscalationLevel: number;
}

/** 派单候选人 */
export interface DispatchCandidate {
  userId: string;
  userName: string;
  groupId: string;
  matchScore: number;
  matchReasons: string[];
  currentWorkload: number;
  skillLevel: number;
  availability: boolean;
}

/** 派单请求 */
export interface DispatchRequest {
  ticketId: string;
  strategy?: DispatchStrategy;
  forceDispatch?: boolean;
  excludeAssignees?: string[];
}

/** 派单结果 */
export interface DispatchResult {
  dispatchId: string;
  ticketId: string;
  status: DispatchStatus;
  assignedTo: string | null;
  candidates: DispatchCandidate[];
  matchDetails: MatchDetail[];
  dispatchedAt: Date;
}

/** 匹配详情 */
export interface MatchDetail {
  userId: string;
  skillScore: number;
  workloadScore: number;
  availabilityScore: number;
  historyScore: number;
  totalScore: number;
  weights: MatchWeights;
}

/** 匹配权重 */
export interface MatchWeights {
  skill: number;
  workload: number;
  availability: number;
  history: number;
}

/** 派单规则 */
export interface DispatchRule {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: DispatchCondition[];
  strategy: DispatchStrategy;
  targetGroupIds: string[];
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 派单条件 */
export interface DispatchCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

/** 条件操作符 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'exists'
  | 'not_exists';

// ============================================================
// SLA 相关
// ============================================================

/** SLA 策略 */
export interface SLAPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  enabled: boolean;
  ticketType: TicketType;
  priority: TicketPriority;
  conditions: SLACondition[];
  metrics: SLAMetric[];
  escalationRules: SLAEscalationRule[];
  scheduleId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** SLA 条件 */
export interface SLACondition {
  categoryId: string | null;
  subCategoryId: string | null;
  groupId: string | null;
  customFields: Record<string, unknown>;
}

/** SLA 指标 */
export interface SLAMetric {
  type: SLAMetricType;
  targetSeconds: number;
  warningThreshold: number;
  enabled: boolean;
}

/** SLA 升级规则 */
export interface SLAEscalationRule {
  id: string;
  metricType: SLAMetricType;
  afterSeconds: number;
  action: EscalationAction;
  notifyUsers: string[];
  notifyGroups: string[];
  channels: NotificationChannel[];
}

/** 升级动作 */
export type EscalationAction =
  | 'notify'
  | 'reassign'
  | 'escalate_priority'
  | 'notify_manager'
  | 'create_incident';

/** SLA 排班 */
export interface SLASchedule {
  id: string;
  tenantId: string;
  name: string;
  timezone: string;
  workHours: WorkHours[];
  holidays: Holiday[];
  createdAt: Date;
  updatedAt: Date;
}

/** 工作时间 */
export interface WorkHours {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/** 节假日 */
export interface Holiday {
  date: Date;
  name: string;
  recurring: boolean;
}

/** SLA 合规报告 */
export interface SLAReport {
  periodStart: Date;
  periodEnd: Date;
  totalTickets: number;
  withinSLA: number;
  breached: number;
  complianceRate: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  byPriority: SLAReportByPriority[];
  byCategory: SLAReportByCategory[];
  trends: SLATrend[];
}

/** 按优先级的 SLA 报告 */
export interface SLAReportByPriority {
  priority: TicketPriority;
  total: number;
  withinSLA: number;
  breached: number;
  complianceRate: number;
}

/** 按分类的 SLA 报告 */
export interface SLAReportByCategory {
  categoryId: string;
  categoryName: string;
  total: number;
  withinSLA: number;
  breached: number;
  complianceRate: number;
}

/** SLA 趋势 */
export interface SLATrend {
  date: Date;
  complianceRate: number;
  ticketCount: number;
  averageResponseTime: number;
  averageResolutionTime: number;
}

// ============================================================
// 工作流相关
// ============================================================

/** 工作流定义 */
export interface WorkflowDefinition {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  ticketType: TicketType;
  version: number;
  enabled: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  startNodeId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 工作流节点 */
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  config: WorkflowNodeConfig;
  position: { x: number; y: number };
}

/** 工作流节点配置 */
export interface WorkflowNodeConfig {
  condition?: string;
  approvalConfig?: ApprovalConfig;
  taskConfig?: TaskConfig;
  notificationConfig?: NotificationConfig;
  timerConfig?: TimerConfig;
}

/** 审批配置 */
export interface ApprovalConfig {
  approverIds: string[];
  approverGroupId: string | null;
  approvalType: 'any' | 'all' | 'sequential';
  escalationAfterSeconds: number;
  allowDelegation: boolean;
}

/** 任务配置 */
export interface TaskConfig {
  assigneeIds: string[];
  dueDateOffsetSeconds: number;
  autoAssign: boolean;
}

/** 通知配置 */
export interface NotificationConfig {
  channels: NotificationChannel[];
  templateId: string;
  recipients: string[];
}

/** 计时器配置 */
export interface TimerConfig {
  durationSeconds: number;
  onTimeout: 'transition' | 'escalate' | 'notify';
  targetNodeId: string | null;
}

/** 工作流边 */
export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  condition?: string;
  label?: string;
}

/** 工作流实例 */
export interface WorkflowInstance {
  id: string;
  ticketId: string;
  workflowDefinitionId: string;
  currentNodeId: string | null;
  status: 'running' | 'completed' | 'paused' | 'failed';
  nodeInstances: WorkflowNodeInstance[];
  startedAt: Date;
  completedAt: Date | null;
}

/** 工作流节点实例 */
export interface WorkflowNodeInstance {
  id: string;
  workflowInstanceId: string;
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  startedAt: Date | null;
  completedAt: Date | null;
}

/** 审批记录 */
export interface ApprovalRecord {
  id: string;
  ticketId: string;
  workflowNodeId: string;
  approverId: string;
  status: ApprovalStatus;
  comment: string;
  approvedAt: Date | null;
  delegatedTo: string | null;
}

// ============================================================
// BI 分析相关
// ============================================================

/** BI 看板数据 */
export interface BIDashboardData {
  type: DashboardType;
  period: TimeRange;
  dateRange: { start: Date; end: Date };
  summary: DashboardSummary;
  charts: DashboardChart[];
  tables: DashboardTable[];
  alerts: DashboardAlert[];
}

/** 看板摘要 */
export interface DashboardSummary {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  slaComplianceRate: number;
  averageResolutionTime: number;
  averageCustomerSatisfaction: number;
  periodOverPeriodChange: number;
}

/** 看板图表 */
export interface DashboardChart {
  id: string;
  title: string;
  chartType: 'line' | 'bar' | 'pie' | 'area' | 'heatmap';
  data: Record<string, unknown>[];
  xField: string;
  yField: string;
}

/** 看板表格 */
export interface DashboardTable {
  id: string;
  title: string;
  columns: TableColumn[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

/** 表格列 */
export interface TableColumn {
  key: string;
  title: string;
  sortable: boolean;
  width?: number;
}

/** 看板告警 */
export interface DashboardAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  ticketId: string | null;
  createdAt: Date;
}

/** BI 统计维度 */
export interface BIStats {
  totalTickets: number;
  byType: Record<TicketType, number>;
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  bySource: Record<TicketSource, number>;
  byAssignee: AssigneeStats[];
  byGroup: GroupStats[];
  byCategory: CategoryStats[];
  trends: TicketTrend[];
  slaStats: SLAStats;
  dispatchStats: DispatchStats;
}

/** 分配人统计 */
export interface AssigneeStats {
  assigneeId: string;
  assigneeName: string;
  totalTickets: number;
  resolvedTickets: number;
  averageResolutionTime: number;
  slaComplianceRate: number;
  currentWorkload: number;
}

/** 组统计 */
export interface GroupStats {
  groupId: string;
  groupName: string;
  totalTickets: number;
  resolvedTickets: number;
  averageResolutionTime: number;
  slaComplianceRate: number;
}

/** 分类统计 */
export interface CategoryStats {
  categoryId: string;
  categoryName: string;
  totalTickets: number;
  averageResolutionTime: number;
  slaComplianceRate: number;
}

/** 工单趋势 */
export interface TicketTrend {
  date: Date;
  created: number;
  resolved: number;
  closed: number;
  breached: number;
}

/** SLA 统计 */
export interface SLAStats {
  overallComplianceRate: number;
  responseTimeCompliance: number;
  resolutionTimeCompliance: number;
  breachCount: number;
  averageTimeToBreach: number;
}

/** 派单统计 */
export interface DispatchStats {
  autoDispatchRate: number;
  averageMatchScore: number;
  rejectionRate: number;
  averageEscalationLevel: number;
}

// ============================================================
// 请求/响应类型
// ============================================================

/** 创建工单请求 */
export interface CreateTicketRequest {
  type: TicketType;
  title: string;
  description: string;
  priority?: TicketPriority;
  categoryId: string;
  subCategoryId?: string;
  reporterId: string;
  assigneeId?: string;
  groupId?: string;
  tags?: string[];
  attachments?: CreateAttachmentRequest[];
  customFields?: Record<string, unknown>;
  source?: TicketSource;
}

/** 创建附件请求 */
export interface CreateAttachmentRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
}

/** 工单状态流转请求 */
export interface TransitionTicketRequest {
  toStatus: TicketStatus;
  comment?: string;
  resolution?: string;
  resolutionCode?: string;
}

/** 分配工单请求 */
export interface AssignTicketRequest {
  assigneeId: string;
  groupId?: string;
  comment?: string;
}

/** 设置 SLA 请求 */
export interface SetSLARequest {
  policyId: string;
  ticketId: string;
}

/** 列表查询参数 */
export interface TicketListQuery {
  page?: number;
  pageSize?: number;
  status?: TicketStatus[];
  priority?: TicketPriority[];
  type?: TicketType[];
  assigneeId?: string;
  groupId?: string;
  reporterId?: string;
  categoryId?: string;
  source?: TicketSource;
  tags?: string[];
  searchQuery?: string;
  sortBy?: SortField;
  sortOrder?: SortDirection;
  dateFrom?: Date;
  dateTo?: Date;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/** 通用 API 响应 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: Date;
  requestId: string;
}

/** 错误响应 */
export interface APIErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: Date;
  requestId: string;
}

// ============================================================
// 监控告警转工单
// ============================================================

/** 监控告警转工单请求 */
export interface AlertToTicketRequest {
  alertId: string;
  source: string;
  severity: TicketPriority;
  title: string;
  description: string;
  affectedService: string;
  affectedCI: string;
  ipAddress: string;
  occurrenceCount: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  alertUrl: string;
  autoResolve: boolean;
}

// ============================================================
// 知识库关联
// ============================================================

/** 知识库关联 */
export interface KnowledgeAssociation {
  id: string;
  ticketId: string;
  articleId: string;
  articleTitle: string;
  relevanceScore: number;
  associatedBy: string;
  associatedAt: Date;
  wasHelpful: boolean | null;
}

// ============================================================
// 工单模版
// ============================================================

/** 工单模版 */
export interface TicketTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  ticketType: TicketType;
  categoryId: string;
  subCategoryId: string | null;
  defaultPriority: TicketPriority;
  defaultAssigneeId: string | null;
  defaultGroupId: string | null;
  defaultTags: string[];
  customFieldDefaults: Record<string, unknown>;
  slaPolicyId: string | null;
  workflowDefinitionId: string | null;
  enabled: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// 通知
// ============================================================

/** 通知 */
export interface TicketNotification {
  id: string;
  ticketId: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipientId: string;
  status: NotificationStatus;
  content: NotificationContent;
  sentAt: Date | null;
  error: string | null;
  retryCount: number;
  maxRetries: number;
}

/** 通知类型 */
export type NotificationType =
  | 'ticket_created'
  | 'ticket_assigned'
  | 'ticket_status_changed'
  | 'ticket_comment'
  | 'sla_warning'
  | 'sla_breached'
  | 'approval_requested'
  | 'approval_completed'
  | 'dispatch_result'
  | 'ticket_resolved'
  | 'ticket_closed';

/** 通知状态 */
export type NotificationStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled';

/** 通知内容 */
export interface NotificationContent {
  subject: string;
  body: string;
  variables: Record<string, string>;
}

// ============================================================
// 工单关联
// ============================================================

/** 工单关联关系 */
export interface TicketRelation {
  id: string;
  sourceTicketId: string;
  targetTicketId: string;
  relationType: TicketRelationType;
  comment: string;
  createdAt: Date;
}

/** 关联类型 */
export type TicketRelationType =
  | 'blocks'
  | 'blocked_by'
  | 'relates_to'
  | 'duplicates'
  | 'duplicated_by'
  | 'causes'
  | 'caused_by'
  | 'parent'
  | 'child'
  | 'follow_up';

// ============================================================
// 工单满意度
// ============================================================

/** 满意度调查 */
export interface SatisfactionSurvey {
  id: string;
  ticketId: string;
  sentAt: Date;
  respondedAt: Date | null;
  rating: number | null;
  comment: string | null;
  surveyLink: string;
  status: SurveyStatus;
}

/** 调查状态 */
export type SurveyStatus = 'sent' | 'opened' | 'completed' | 'expired';

// ============================================================
// 服务目录
// ============================================================

/** 服务目录 */
export interface ServiceCatalog {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  categoryId: string;
  ticketType: TicketType;
  slaPolicyId: string | null;
  templateId: string | null;
  requestForm: FormField[];
  visible: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 表单字段 */
export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'date' | 'number' | 'checkbox';
  required: boolean;
  options: string[];
  defaultValue: unknown;
  validation?: string;
}
