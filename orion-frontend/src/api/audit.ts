/**
 * Audit API Service
 * Immutable audit log chain and integrity verification
 */
import { api } from './client';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  userId: string;
  tenantId?: string;
  details: Record<string, any>;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  prevHash: string;
  contentHash: string;
  chainHash: string;
  sequenceNumber: number;
  signature?: string;
}

export interface ChainInfo {
  totalEntries: number;
  firstSequence: number;
  lastSequence: number;
  lastChainHash: string;
  genesisHash: string;
}

export interface ChainVerificationResult {
  isValid: boolean;
  verifiedCount: number;
  breaks: ChainBreak[];
  verifiedAt: string;
}

export interface ChainBreak {
  sequenceNumber: number;
  entryId: string;
  expectedHash: string;
  actualHash: string;
  breakType: 'SEQUENCE_GAP' | 'HASH_MISMATCH' | 'MISSING_ENTRY';
  description: string;
  detectedAt: string;
}

export interface IntegrityReport {
  id: string;
  generatedAt: string;
  isValid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  issues: IntegrityIssue[];
  summary: string;
}

export interface IntegrityIssue {
  type: 'CHAIN_BREAK' | 'STORAGE_TAMPERING' | 'MISSING_ENTRIES' | 'VERIFICATION_FAILED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details: Record<string, any>;
}

export interface StorageStats {
  totalEntries: number;
  storageSize: number;
  lastFlushAt?: string;
  isHealthy: boolean;
}

export interface AuditLogFilters {
  action?: string;
  userId?: string;
  tenantId?: string;
  resourceType?: string;
  resourceId?: string;
  fromSequence?: number;
  toSequence?: number;
  limit?: number;
}

// ==================== Audit Log CRUD ====================

export function getAuditLogs(filters?: AuditLogFilters) {
  return api.get<{ entries: AuditLogEntry[]; total: number }>('/api/v1/audit/logs', {
    params: filters,
  });
}

export function getAuditLog(id: string) {
  return api.get<AuditLogEntry>(`/api/v1/audit/logs/${id}`);
}

export function createAuditLog(data: {
  action: string;
  userId: string;
  tenantId?: string;
  details: Record<string, any>;
  resourceType?: string;
  resourceId?: string;
}) {
  return api.post<AuditLogEntry>('/api/v1/audit/logs', data);
}

export function verifyAuditLog(id: string) {
  return api.get<{ entry: AuditLogEntry; isValid: boolean }>(`/api/v1/audit/logs/${id}/verify`);
}

// ==================== Chain Verification ====================

export function verifyChain(params?: { fromSequence?: number; toSequence?: number }) {
  return api.post<{ result: ChainVerificationResult; verifiedAt: string }>(
    '/api/v1/audit/verify',
    params
  );
}

// ==================== Chain Info ====================

export function getChainInfo() {
  return api.get<ChainInfo>('/api/v1/audit/chain/info');
}

export function getChainGenesis() {
  return api.get<{ genesisHash: string }>('/api/v1/audit/chain/genesis');
}

export function getChainLatest() {
  return api.get<AuditLogEntry>('/api/v1/audit/chain/latest');
}

// ==================== Storage Management ====================

export function getStorageStats() {
  return api.get<StorageStats>('/api/v1/audit/storage/stats');
}

export function flushStorage() {
  return api.post<{ status: string }>('/api/v1/audit/storage/flush');
}

// ==================== Reports ====================

export function generateReport() {
  return api.post<{ report: IntegrityReport }>('/api/v1/audit/report/generate');
}

export function getReports() {
  return api.get<{ reports: IntegrityReport[] }>('/api/v1/audit/reports');
}
