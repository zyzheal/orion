/**
 * Plugin Types
 *
 * Plugin 系统共享类型定义
 */

/**
 * 资源配额配置
 */
export interface ResourceQuota {
  /** CPU 核心数限制 (2 = 2 核) */
  cpuCores: number;
  /** 内存限制 (字节) */
  memoryBytes: number;
  /** 执行超时时间 (毫秒) */
  timeoutMs: number;
  /** 最大并发执行数 */
  maxConcurrent: number;
}

/**
 * 默认资源配额
 */
export const DEFAULT_QUOTA: ResourceQuota = {
  cpuCores: 2,
  memoryBytes: 2 * 1024 * 1024 * 1024, // 2GB
  timeoutMs: 60000, // 60 秒
  maxConcurrent: 10,
};

/**
 * 安全等级对应的配额
 */
export const SECURITY_LEVEL_QUOTAS: Record<string, ResourceQuota> = {
  HIGH: {
    cpuCores: 1,
    memoryBytes: 512 * 1024 * 1024, // 512MB
    timeoutMs: 30000, // 30 秒
    maxConcurrent: 5,
  },
  MEDIUM: {
    cpuCores: 2,
    memoryBytes: 1024 * 1024 * 1024, // 1GB
    timeoutMs: 60000, // 60 秒
    maxConcurrent: 10,
  },
  LOW: {
    cpuCores: 4,
    memoryBytes: 2 * 1024 * 1024 * 1024, // 2GB
    timeoutMs: 120000, // 120 秒
    maxConcurrent: 20,
  },
};

/**
 * 资源使用情况
 */
export interface ResourceUsage {
  cpuPercent: number;
  memoryBytes: number;
  diskBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
  timestamp: Date;
}

/**
 * 执行上下文
 */
export interface ExecutionContext {
  taskId: string;
  pluginId: string;
  pipelineRunId: string;
  stageId: string;
  userId?: string;
  tenantId?: string;
  startedAt: Date;
  quota: ResourceQuota;
}

/**
 * 输入验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * 验证错误
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * DLP 检测结果
 */
export interface DLPDetectionResult {
  hasSensitiveData: boolean;
  patterns: DLPPattern[];
  redactedData?: string;
}

/**
 * DLP 模式
 */
export interface DLPPattern {
  type: 'CREDIT_CARD' | 'SSN' | 'API_KEY' | 'PASSWORD' | 'EMAIL' | 'PHONE' | 'IP_ADDRESS';
  matchedText: string;
  position: { start: number; end: number };
  confidence: number;
}

/**
 * 安全事件类型
 */
export type SecurityEventType =
  | 'QUOTA_EXCEEDED'
  | 'TIMEOUT_KILLED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'CPU_LIMIT_EXCEEDED'
  | 'SENSITIVE_DATA_DETECTED'
  | 'UNAUTHORIZED_ACCESS'
  | 'SANDBOX_VIOLATION'
  | 'INPUT_VALIDATION_FAILED';

/**
 * 安全事件
 */
export interface SecurityEvent {
  type: SecurityEventType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  taskId: string;
  pluginId: string;
  message: string;
  details: Record<string, any>;
  timestamp: Date;
}

/**
 * 审计日志级别
 */
export type AuditLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * 审计日志条目
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  level: AuditLogLevel;
  taskId: string;
  pluginId: string;
  action: string;
  message: string;
  input?: any;
  output?: any;
  durationMs?: number;
  metadata: Record<string, any>;
}

/**
 * Sandbox 执行结果
 */
export interface SandboxExecutionResult {
  taskId: string;
  success: boolean;
  exitCode: number;
  stdout?: string;
  stderr?: string;
  durationMs: number;
  resourceUsage?: ResourceUsage;
  outputs?: Record<string, string>;
  errorMessage?: string;
  killed?: boolean;
  killReason?: string;
}