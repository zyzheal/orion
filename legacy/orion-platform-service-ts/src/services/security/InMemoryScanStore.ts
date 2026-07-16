/**
 * InMemoryScanStore - In-memory fallback storage for scans and findings
 * Used when PG database is unavailable (Level 1+ degradation)
 */

import {
  SecurityScanEntity,
  SecurityFindingEntity,
  CreateScanInput,
  CreateFindingInput,
} from '../../repositories/SecurityScanRepository';
import { createLogger } from '../../utils/logger';

const logger = createLogger('security-scan-store');

export interface ScanStats {
  totalScans: number;
  successCount: number;
  failedCount: number;
  avgFindings: number;
}

export class InMemoryScanStore {
  private scans: Map<string, SecurityScanEntity> = new Map();
  private findingsByScanId: Map<string, SecurityFindingEntity[]> = new Map();

  /** Memory limit: maximum scans to keep in memory */
  private readonly MAX_SCANS = 1000;
  /** Memory limit: maximum findings to keep in memory */
  private readonly MAX_FINDINGS_PER_SCAN = 500;

  /**
   * Create a new scan record in memory
   */
  async createScan(input: CreateScanInput): Promise<SecurityScanEntity> {
    const scan: SecurityScanEntity = {
      id: input.id,
      tenantId: input.tenantId ?? null,
      scanType: input.scanType,
      repository: input.repository,
      branch: input.branch ?? null,
      commitHash: input.commitHash ?? null,
      status: input.status,
      scanner: input.scanner,
      findingsCount: input.findingsCount ?? 0,
      criticalCount: input.criticalCount ?? 0,
      highCount: input.highCount ?? 0,
      mediumCount: input.mediumCount ?? 0,
      lowCount: input.lowCount ?? 0,
      infoCount: input.infoCount ?? 0,
      gateFailed: input.gateFailed ?? false,
      scanStartTime: input.scanStartTime,
      scanEndTime: input.scanEndTime,
      durationMs: input.durationMs ?? 0,
      createdAt: new Date(),
      metadata: input.metadata ?? {},
    };

    this.scans.set(scan.id, scan);

    // Enforce memory limit: evict oldest scans if over limit
    if (this.scans.size > this.MAX_SCANS) {
      const oldestKey = Array.from(this.scans.keys())[0];
      this.scans.delete(oldestKey);
      logger.warn({ evictedScanId: oldestKey, currentSize: this.scans.size }, '[InMemoryScanStore] Evicted oldest scan due to memory limit');
    }

    return scan;
  }

  /**
   * Batch create findings in memory
   */
  async createFindings(inputs: CreateFindingInput[]): Promise<SecurityFindingEntity[]> {
    const results: SecurityFindingEntity[] = [];

    for (const input of inputs) {
      const finding: SecurityFindingEntity = {
        id: input.id,
        scanId: input.scanId,
        ruleId: input.ruleId ?? null,
        severity: input.severity,
        category: input.category ?? null,
        title: input.title,
        description: input.description ?? null,
        file: input.file ?? null,
        lineStart: input.lineStart ?? null,
        lineEnd: input.lineEnd ?? null,
        codeSnippet: input.codeSnippet ?? null,
        match: input.match ?? null,
        confidence: input.confidence ?? 0.8,
        remediation: input.remediation ?? null,
        createdAt: new Date(),
        metadata: input.metadata ?? {},
      };

      results.push(finding);

      // Group by scanId for indexed lookups
      const existing = this.findingsByScanId.get(input.scanId) || [];
      existing.push(finding);

      // Enforce memory limit per scan
      if (existing.length > this.MAX_FINDINGS_PER_SCAN) {
        const evicted = existing.splice(0, existing.length - this.MAX_FINDINGS_PER_SCAN);
        logger.warn(
          { scanId: input.scanId, evictedCount: evicted.length, maxAllowed: this.MAX_FINDINGS_PER_SCAN },
          '[InMemoryScanStore] Evicted oldest findings due to per-scan memory limit',
        );
      }

      this.findingsByScanId.set(input.scanId, existing);
    }

    logger.debug({ count: results.length }, '[InMemoryScanStore] Batch created findings');

    return results;
  }

  /**
   * Find a scan by its ID
   */
  async findScanById(id: string): Promise<SecurityScanEntity | null> {
    return this.scans.get(id) ?? null;
  }

  /**
   * Find all findings associated with a scan
   */
  async findFindingsByScanId(scanId: string): Promise<SecurityFindingEntity[]> {
    return this.findingsByScanId.get(scanId) ?? [];
  }

  /**
   * Find scans by repository name, sorted by creation date descending
   */
  async findScansByRepository(
    repository: string,
    options?: { limit?: number; offset?: number }
  ): Promise<SecurityScanEntity[]> {
    const allScans = Array.from(this.scans.values())
      .filter(s => s.repository === repository)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const limit = options?.limit ?? allScans.length;
    const offset = options?.offset ?? 0;
    return allScans.slice(offset, offset + limit);
  }

  /**
   * Find recently created scans across all repositories
   */
  async findRecentScans(limit: number = 10): Promise<SecurityScanEntity[]> {
    return Array.from(this.scans.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get aggregated scan statistics from in-memory data
   */
  async getScanStats(repository?: string): Promise<ScanStats> {
    const scans = repository
      ? Array.from(this.scans.values()).filter(s => s.repository === repository)
      : Array.from(this.scans.values());

    const totalScans = scans.length;
    const successCount = scans.filter(s => s.status === 'success').length;
    const failedCount = scans.filter(s => s.status === 'failed').length;
    const totalFindings = scans.reduce((sum, s) => sum + s.findingsCount, 0);
    const avgFindings = totalScans > 0 ? totalFindings / totalScans : 0;

    return {
      totalScans,
      successCount,
      failedCount,
      avgFindings,
    };
  }

  /**
   * Clear all stored data (for testing or reset)
   */
  clear(): void {
    this.scans.clear();
    this.findingsByScanId.clear();
  }

  /**
   * Get total count of stored scans
   */
  get scanCount(): number {
    return this.scans.size;
  }

  /**
   * Get total count of stored findings
   */
  get findingCount(): number {
    let count = 0;
    for (const findings of this.findingsByScanId.values()) {
      count += findings.length;
    }
    return count;
  }
}

export default InMemoryScanStore;
