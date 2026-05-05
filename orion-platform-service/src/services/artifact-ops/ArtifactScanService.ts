export interface ScanFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type: string;
  title: string;
  description: string;
  location?: string;
  cve?: string;
  remediation?: string;
}

export interface ScanReport {
  id: string;
  tenantId: string;
  artifactId: string;
  scanId: string;
  scanType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  findings: ScanFinding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  passed: boolean;
}

export interface MaliciousDetection {
  artifactId: string;
  detected: boolean;
  riskLevel: 'safe' | 'suspicious' | 'malicious';
  reasons: string[];
  details: Record<string, unknown>;
}

/**
 * ArtifactScanService — scans artifacts for vulnerabilities and malicious content.
 * Uses in-memory Map storage with tenant isolation.
 */
export class ArtifactScanService {
  private reports = new Map<string, ScanReport>();
  private reportIndex = new Map<string, string[]>(); // artifactId -> reportIds
  private maliciousDetections = new Map<string, MaliciousDetection>();

  /**
   * Scan an artifact. Simulates a scan and returns a report.
   */
  scanArtifact(
    tenantId: string,
    artifactId: string,
  ): ScanReport {
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = new Date().toISOString();

    // Simulate findings based on artifact name hash (deterministic for demo)
    const findings = this.generateFindings(artifactId);

    const summary = {
      total: findings.length,
      critical: findings.filter((f) => f.severity === 'critical').length,
      high: findings.filter((f) => f.severity === 'high').length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
      info: findings.filter((f) => f.severity === 'info').length,
    };

    const report: ScanReport = {
      id: scanId,
      tenantId,
      artifactId,
      scanId,
      scanType: 'full',
      status: 'completed',
      startedAt,
      completedAt: new Date().toISOString(),
      duration: Math.floor(Math.random() * 5000) + 500,
      findings,
      summary,
      passed: summary.critical === 0 && summary.high === 0,
    };

    this.reports.set(scanId, report);

    if (!this.reportIndex.has(artifactId)) {
      this.reportIndex.set(artifactId, []);
    }
    this.reportIndex.get(artifactId)!.push(scanId);

    return report;
  }

  /**
   * Get scan report for a specific scan.
   */
  getScanReport(scanId: string): ScanReport | undefined {
    return this.reports.get(scanId);
  }

  /**
   * Get all scan reports for an artifact.
   */
  getArtifactReports(artifactId: string): ScanReport[] {
    const ids = this.reportIndex.get(artifactId) || [];
    return ids
      .map((id) => this.reports.get(id))
      .filter((r): r is ScanReport => r !== undefined);
  }

  /**
   * Get the latest scan report for an artifact.
   */
  getLatestReport(artifactId: string): ScanReport | undefined {
    const reports = this.getArtifactReports(artifactId);
    if (reports.length === 0) return undefined;
    return reports.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )[0];
  }

  /**
   * Detect if an artifact is malicious based on its scan results and metadata.
   */
  detectMaliciousArtifact(
    artifactId: string,
  ): MaliciousDetection {
    // Check existing reports
    const reports = this.getArtifactReports(artifactId);
    const latestReport = reports.length > 0 ? this.getLatestReport(artifactId) : null;

    const reasons: string[] = [];
    let riskLevel: MaliciousDetection['riskLevel'] = 'safe';

    // Analyze scan findings
    if (latestReport) {
      if (latestReport.summary.critical > 0) {
        reasons.push(
          `${latestReport.summary.critical} critical vulnerabilities found`,
        );
      }
      if (latestReport.summary.high > 2) {
        reasons.push(
          `${latestReport.summary.high} high severity vulnerabilities found`,
        );
      }
    }

    // Deterministic check based on artifact name (simulated)
    const name = artifactId.toLowerCase();
    if (
      name.includes('malware') ||
      name.includes('trojan') ||
      name.includes('backdoor') ||
      name.includes('exploit')
    ) {
      reasons.push('Artifact name matches known malicious patterns');
    }

    // Hash-based simulation for demo
    const hash = this.simpleHash(artifactId);
    if (hash % 100 < 3) {
      reasons.push('Behavioral analysis flagged suspicious patterns');
    }

    // Determine risk level
    if (reasons.length >= 2) {
      riskLevel = 'malicious';
    } else if (reasons.length === 1) {
      riskLevel = 'suspicious';
    }

    const detection: MaliciousDetection = {
      artifactId,
      detected: riskLevel !== 'safe',
      riskLevel,
      reasons,
      details: {
        reportsAnalyzed: reports.length,
        latestScanId: latestReport?.scanId,
        scanTimestamp: latestReport?.startedAt,
        analysisTimestamp: new Date().toISOString(),
      },
    };

    this.maliciousDetections.set(artifactId, detection);
    return detection;
  }

  /**
   * Get malicious detection result for an artifact.
   */
  getMaliciousDetection(artifactId: string): MaliciousDetection | undefined {
    return this.maliciousDetections.get(artifactId);
  }

  /**
   * Get all malicious detections for a tenant.
   */
  getTenantDetections(tenantId: string): MaliciousDetection[] {
    const allReports = Array.from(this.reports.values()).filter(
      (r) => r.tenantId === tenantId,
    );
    const artifactIds = new Set(allReports.map((r) => r.artifactId));

    const detections: MaliciousDetection[] = [];
    for (const artifactId of Array.from(artifactIds)) {
      const detection = this.maliciousDetections.get(artifactId);
      if (detection && detection.detected) {
        detections.push(detection);
      }
    }

    return detections;
  }

  // ---- Helpers ----

  private generateFindings(artifactId: string): ScanFinding[] {
    const hash = this.simpleHash(artifactId);
    const findings: ScanFinding[] = [];

    // Deterministic findings based on hash
    if (hash % 7 === 0) {
      findings.push({
        id: `finding_${hash}_1`,
        severity: 'critical',
        type: 'vulnerability',
        title: 'Remote Code Execution',
        description: 'Potential RCE vulnerability detected in dependency',
        cve: 'CVE-2024-0001',
        remediation: 'Update affected dependency to latest version',
      });
    }

    if (hash % 5 === 0) {
      findings.push({
        id: `finding_${hash}_2`,
        severity: 'high',
        type: 'vulnerability',
        title: 'SQL Injection Risk',
        description: 'Unsanitized input may allow SQL injection',
        location: 'lib/db/query.ts:42',
        remediation: 'Use parameterized queries',
      });
    }

    if (hash % 3 === 0) {
      findings.push({
        id: `finding_${hash}_3`,
        severity: 'medium',
        type: 'misconfiguration',
        title: 'Insecure Default Configuration',
        description: 'Default credentials detected in configuration',
        remediation: 'Change default credentials',
      });
    }

    if (hash % 2 === 0) {
      findings.push({
        id: `finding_${hash}_4`,
        severity: 'low',
        type: 'best-practice',
        title: 'Missing Security Header',
        description: 'HTTP response missing X-Content-Type-Options header',
        remediation: 'Add security headers to HTTP responses',
      });
    }

    // Always add at least one info finding
    findings.push({
      id: `finding_${hash}_5`,
      severity: 'info',
      type: 'metadata',
      title: 'Dependency Count',
      description: `Artifact contains ${hash % 50 + 5} dependencies`,
    });

    return findings;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /**
   * Clear all data.
   */
  destroy(): void {
    this.reports.clear();
    this.reportIndex.clear();
    this.maliciousDetections.clear();
  }
}
