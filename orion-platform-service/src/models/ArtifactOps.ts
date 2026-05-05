/**
 * Artifact Operations Models
 *
 * 制品运营数据模型，用于操作追踪、保留策略、安全扫描。
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * 操作类型
 */
export enum ArtifactOperationType {
  UPLOAD = 'upload',
  DOWNLOAD = 'download',
  DELETE = 'delete',
  SCAN = 'scan',
  PROMOTE = 'promote',
  QUARANTINE = 'quarantine',
}

/**
 * 制品操作记录
 */
export interface ArtifactOperation {
  id: string;
  tenant_id: string;
  artifact_id: string;
  operation_type: ArtifactOperationType;
  performed_by: string;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: Date;
}

/**
 * 制品统计
 */
export interface ArtifactStats {
  tenant_id: string;
  total_artifacts: number;
  total_size_bytes: number;
  operations_24h: number;
  operations_7d: number;
  operations_30d: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
}

/**
 * 保留策略
 */
export interface RetentionPolicy {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  retention_days: number;
  max_versions: number;
  max_size_bytes: number;
  filter_rules: Record<string, any>;
  action_on_expire: 'delete' | 'archive';
  enabled: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * 创建保留策略输入
 */
export interface RetentionPolicyCreateInput {
  name: string;
  description?: string;
  retention_days: number;
  max_versions?: number;
  max_size_bytes?: number;
  filter_rules?: Record<string, any>;
  action_on_expire?: 'delete' | 'archive';
  created_by?: string;
}

/**
 * 扫描结果
 */
export interface ScanResult {
  id: string;
  tenant_id: string;
  artifact_id: string;
  scan_type: string;
  status: 'passed' | 'failed' | 'warning' | 'pending';
  vulnerabilities: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    cve?: string;
    fix_available: boolean;
  }>;
  malicious: boolean;
  malicious_reason: string | null;
  scanned_at: Date;
  scanned_by: string;
}

/**
 * 创建操作记录（工具函数）
 */
export function createArtifactOperation(
  tenantId: string,
  artifactId: string,
  operationType: ArtifactOperationType,
  performedBy: string,
  details?: Record<string, any>,
  ipAddress?: string,
): ArtifactOperation {
  return {
    id: uuidv4(),
    tenant_id: tenantId,
    artifact_id: artifactId,
    operation_type: operationType,
    performed_by: performedBy,
    details: details || {},
    ip_address: ipAddress || null,
    created_at: new Date(),
  };
}

/**
 * 创建保留策略（工具函数）
 */
export function createRetentionPolicy(
  tenantId: string,
  input: RetentionPolicyCreateInput,
): RetentionPolicy {
  const now = new Date();
  return {
    id: uuidv4(),
    tenant_id: tenantId,
    name: input.name,
    description: input.description || '',
    retention_days: input.retention_days,
    max_versions: input.max_versions || 10,
    max_size_bytes: input.max_size_bytes || 10 * 1024 * 1024 * 1024,
    filter_rules: input.filter_rules || {},
    action_on_expire: input.action_on_expire || 'delete',
    enabled: true,
    created_by: input.created_by || 'system',
    created_at: now,
    updated_at: now,
  };
}

/**
 * 创建扫描结果（工具函数）
 */
export function createScanResult(
  tenantId: string,
  artifactId: string,
  scanType: string,
  scannedBy: string,
): ScanResult {
  return {
    id: uuidv4(),
    tenant_id: tenantId,
    artifact_id: artifactId,
    scan_type: scanType,
    status: 'pending',
    vulnerabilities: [],
    malicious: false,
    malicious_reason: null,
    scanned_at: new Date(),
    scanned_by: scannedBy,
  };
}
