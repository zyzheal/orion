/**
 * Audit Log Chain Types
 *
 * 审计日志链式 Hash 相关类型定义
 */

/**
 * 链式审计日志条目
 */
export interface ChainedAuditLogEntry {
  /** 日志唯一 ID */
  id: string;
  /** 时间戳 */
  timestamp: Date;
  /** 操作类型 */
  action: string;
  /** 用户 ID */
  userId: string;
  /** 租户 ID */
  tenantId?: string;
  /** 前一条日志的 Hash */
  prevHash: string;
  /** 当前日志内容的 Hash */
  contentHash: string;
  /** 完整 Hash (prevHash + contentHash) */
  chainHash: string;
  /** 操作详情 */
  details: Record<string, any>;
  /** 数字签名 */
  signature?: string;
  /** 序列号 */
  sequenceNumber: number;
}

/**
 * 链式验证结果
 */
export interface ChainVerificationResult {
  /** 是否有效 */
  valid: boolean;
  /** 验证通过的条目数 */
  verifiedCount: number;
  /** 总条目数 */
  totalCount: number;
  /** 断裂点信息 */
  breaks: ChainBreak[];
  /** 验证时间 */
  verifiedAt: Date;
}

/**
 * 链断裂点
 */
export interface ChainBreak {
  /** 断裂位置的序列号 */
  sequenceNumber: number;
  /** 断裂条目 ID */
  entryId: string;
  /** 期望的 Hash */
  expectedHash: string;
  /** 实际的 Hash */
  actualHash: string;
  /** 断裂类型 */
  breakType: 'HASH_MISMATCH' | 'SEQUENCE_GAP' | 'INVALID_SIGNATURE' | 'MODIFIED_CONTENT';
  /** 断裂描述 */
  description: string;
  /** 检测时间 */
  detectedAt: Date;
}

/**
 * Hash 算法类型
 */
export type HashAlgorithm = 'SHA256' | 'SHA512';

/**
 * 链式 Hash 配置
 */
export interface ChainConfig {
  /** Hash 算法 */
  algorithm: HashAlgorithm;
  /** 创世 Hash (链首的 prevHash) */
  genesisHash: string;
  /** 是否启用签名 */
  enableSignature: boolean;
  /** 签名密钥 (可选) */
  signingKey?: string;
}

/**
 * 默认配置
 */
export const DEFAULT_CHAIN_CONFIG: ChainConfig = {
  algorithm: 'SHA256',
  genesisHash: '0'.repeat(64), // 64 个 0 作为创世 Hash
  enableSignature: false,
};

/**
 * 完整性校验报告
 */
export interface IntegrityReport {
  /** 报告 ID */
  id: string;
  /** 校验时间 */
  verifiedAt: Date;
  /** 校验范围起始 */
  rangeStart: Date;
  /** 校验范围结束 */
  rangeEnd: Date;
  /** 总条目数 */
  totalEntries: number;
  /** 有效条目数 */
  validEntries: number;
  /** 发现的问题 */
  issues: IntegrityIssue[];
  /** 校验状态 */
  status: 'PASSED' | 'WARNING' | 'FAILED';
  /** 校验耗时 (毫秒) */
  durationMs: number;
}

/**
 * 完整性问题
 */
export interface IntegrityIssue {
  /** 问题类型 */
  type: 'CHAIN_BREAK' | 'MODIFIED_ENTRY' | 'MISSING_ENTRY' | 'MISSING_ENTRIES' | 'INVALID_SIGNATURE' | 'STORAGE_TAMPERING';
  /** 严重程度 */
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** 相关条目 ID */
  entryId?: string;
  /** 序列号 */
  sequenceNumber?: number;
  /** 问题描述 */
  description: string;
  /** 额外详情 */
  details?: Record<string, any>;
}

/**
 * 告警配置
 */
export interface AlertConfig {
  /** 是否启用告警 */
  enabled: boolean;
  /** 告警阈值 - 断裂数 */
  breakThreshold: number;
  /** 通知方式 */
  channels: ('email' | 'webhook' | 'slack')[];
  /** Webhook URL */
  webhookUrl?: string;
  /** Email 收件人 */
  emailRecipients?: string[];
}

/**
 * 默认告警配置
 */
export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: true,
  breakThreshold: 1,
  channels: ['webhook'],
};

/**
 * 校验调度配置
 */
export interface VerificationSchedule {
  /** 是否启用 */
  enabled: boolean;
  /** Cron 表达式 */
  cronExpression: string;
  /** 批次大小 */
  batchSize: number;
}

/**
 * 默认校验调度配置 (每日凌晨 2 点)
 */
export const DEFAULT_VERIFICATION_SCHEDULE: VerificationSchedule = {
  enabled: true,
  cronExpression: '0 2 * * *',
  batchSize: 1000,
};