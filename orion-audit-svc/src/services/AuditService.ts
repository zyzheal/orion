import { createHash } from 'crypto';
import { config } from '../config/index.js';
import { AuditRepository } from '../utils/database.js';
import type {
  AuditLog,
  AuditLogInput,
  AuditChainInfo,
  AuditStorageStats,
  AuditLogQuery,
  AuditActionResult,
  ResourceTypeCount,
} from '../types/audit.js';

function computeHash(payload: string): string {
  return createHash(config.audit.hashAlgorithm).update(payload).digest('hex');
}

function buildHashPayload(log: AuditLogInput, previousHash: string, chainIndex: number): string {
  return `${previousHash}|${log.userId}|${log.action}|${log.resourceType}|${log.resourceId}|${JSON.stringify(log.details || {})}|${chainIndex}|${Date.now()}`;
}

export class AuditService {
  async createLog(input: AuditLogInput): Promise<AuditLog> {
    const chainIndex = (await AuditRepository.getLatestChainIndex()) + 1;
    const previousEntry = chainIndex === 1
      ? null
      : await this.getLogByChainIndex(chainIndex - 1);

    const previousHash = previousEntry
      ? previousEntry.currentHash
      : config.audit.chainGenesisHash;

    const hashPayload = buildHashPayload(input, previousHash, chainIndex);
    const currentHash = computeHash(hashPayload);

    let auditLog = await AuditRepository.create(input, previousHash, chainIndex);
    await AuditRepository.updateHash(auditLog.id, currentHash);

    auditLog = { ...auditLog, currentHash };
    return auditLog;
  }

  async getLogById(id: string): Promise<AuditLog | null> {
    return AuditRepository.findById(id);
  }

  async getLogByChainIndex(index: number): Promise<AuditLog | null> {
    const result = await AuditRepository.findMany({
      limit: 1,
      sortBy: 'chainIndex',
    });
    const match = result.logs.find((l) => l.chainIndex === index);
    return match || null;
  }

  async queryLogs(queryParams: AuditLogQuery): Promise<{ logs: AuditLog[]; total: number }> {
    return AuditRepository.findMany(queryParams);
  }

  async deleteLog(id: string): Promise<boolean> {
    return AuditRepository.deleteById(id);
  }

  async verifyLog(id: string): Promise<{ valid: boolean; reason: string; log: AuditLog | null }> {
    const log = await AuditRepository.findById(id);
    if (!log) {
      return { valid: false, reason: 'Log entry not found', log: null };
    }

    if (log.status === 'tampered') {
      return { valid: false, reason: 'Log entry previously marked as tampered', log };
    }

    const expectedHash = computeHash(buildHashPayload(
      {
        userId: log.userId,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        details: log.details,
        ipAddress: log.ipAddress || undefined,
        userAgent: log.userAgent || undefined,
        severity: log.severity,
        tenantId: log.tenantId || undefined,
      },
      log.previousHash,
      log.chainIndex
    ));

    if (expectedHash !== log.currentHash) {
      await AuditRepository.updateStatus(id, 'tampered');
      return { valid: false, reason: 'Hash mismatch - possible tampering detected', log };
    }

    if (log.chainIndex > 1) {
      const prevLog = await this.getLogByChainIndex(log.chainIndex - 1);
      if (prevLog && prevLog.currentHash !== log.previousHash) {
        await AuditRepository.updateStatus(id, 'tampered');
        return { valid: false, reason: 'Previous hash does not match preceding entry', log };
      }
    }

    await AuditRepository.updateStatus(id, 'verified');
    return { valid: true, reason: 'Chain integrity verified', log };
  }

  async verifyChain(): Promise<{ valid: boolean; totalVerified: number; firstInvalidIndex: number | null }> {
    const allLogs = await AuditRepository.findMany({ limit: 100000, sortBy: 'chainIndex', sortOrder: 'asc' });
    let previousHash = config.audit.chainGenesisHash;

    for (const log of allLogs.logs) {
      if (log.previousHash !== previousHash) {
        await AuditRepository.updateStatus(log.id, 'tampered');
        return { valid: false, totalVerified: log.chainIndex - 1, firstInvalidIndex: log.chainIndex };
      }

      const expectedHash = computeHash(buildHashPayload(
        {
          userId: log.userId,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          details: log.details,
          ipAddress: log.ipAddress || undefined,
          userAgent: log.userAgent || undefined,
          severity: log.severity,
          tenantId: log.tenantId || undefined,
        },
        log.previousHash,
        log.chainIndex
      ));

      if (expectedHash !== log.currentHash) {
        await AuditRepository.updateStatus(log.id, 'tampered');
        return { valid: false, totalVerified: log.chainIndex - 1, firstInvalidIndex: log.chainIndex };
      }

      previousHash = log.currentHash;
    }

    return { valid: true, totalVerified: allLogs.logs.length, firstInvalidIndex: null };
  }

  async getChainInfo(): Promise<AuditChainInfo> {
    return AuditRepository.getChainInfo();
  }

  async getStorageStats(): Promise<AuditStorageStats> {
    return AuditRepository.getStorageStats();
  }

  async getActionsSummary(): Promise<AuditActionResult[]> {
    return AuditRepository.getActionsSummary();
  }

  async getResourceTypes(): Promise<ResourceTypeCount[]> {
    return AuditRepository.getResourceTypes();
  }

  async getGenesisEntry(): Promise<AuditLog | null> {
    const result = await AuditRepository.findMany({ limit: 1, sortBy: 'chainIndex', sortOrder: 'asc' });
    return result.logs[0] || null;
  }

  async getLatestEntry(): Promise<AuditLog | null> {
    const result = await AuditRepository.findMany({ limit: 1, sortBy: 'chainIndex', sortOrder: 'desc' });
    return result.logs[0] || null;
  }
}
