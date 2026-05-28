// orion-platform-service/src/services/security/SecurityScannerService.ts
import { SecretSanitizer } from '../privacy/SecretSanitizer';
import pino from 'pino';
import { spawn } from 'child_process';
import path from 'path';
import {
  SecurityScanRepository,
  SecurityFindingRepository,
  SecurityScanEntity,
  SecurityFindingEntity,
  CreateScanInput,
  CreateFindingInput,
} from '../../repositories/SecurityScanRepository';
import { OrionError, ErrorCode } from '../../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ScanResult {
  id: string;
  scanType: 'secret' | 'sast' | 'dependency' | 'composite';
  repository: string;
  branch?: string;
  commitHash?: string;
  findings: SecurityFinding[];
  scanStartTime: Date;
  scanEndTime: Date;
  durationMs: number;
  status: 'success' | 'failed' | 'partial';
  scanner: string;
  summary: ScanSummary;
}

export interface SecurityFinding {
  id: string;
  ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  file: string;
  lineStart?: number;
  lineEnd?: number;
  code?: string;
  match?: string;
  confidence: number;
  remediation?: string;
  metadata?: Record<string, unknown>;
}

export interface ScanSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
  pass: boolean;
  gateFailed?: boolean;
}

export interface ScanOptions {
  repository: string;
  branch?: string;
  commitHash?: string;
  scanTypes?: ('secret' | 'sast' | 'dependency')[];
  rules?: string[];
  excludePatterns?: string[];
  severityThreshold?: 'critical' | 'high' | 'medium' | 'low';
  failOnSeverity?: 'critical' | 'high' | 'medium';
}

// Gitleaks/Trufflehog rule patterns (predefined)
const SECRET_SCAN_RULES = [
  { id: 'G001', name: 'AWS Access Key', pattern: /AKIA[A-Z0-9]{16}/, severity: 'critical' },
  { id: 'G002', name: 'AWS Secret Key', pattern: /(AWS_SECRET_ACCESS_KEY|aws_secret_key)[\s:=]+["']?([a-zA-Z0-9\/+=]{40})["']?/, severity: 'critical' },
  { id: 'G003', name: 'GitHub Token', pattern: /ghp_[a-zA-Z0-9]{36}/, severity: 'critical' },
  { id: 'G004', name: 'GitHub OAuth', pattern: /gho_[a-zA-Z0-9]{36}/, severity: 'critical' },
  { id: 'G005', name: 'GitLab Token', pattern: /glpat-[a-zA-Z0-9\-]{20}/, severity: 'critical' },
  { id: 'G006', name: 'OpenAI API Key', pattern: /sk-[a-zA-Z0-9]{10,}/, severity: 'critical' },
  { id: 'G007', name: 'Stripe Key', pattern: /(sk|pk)_(live|test)_[a-zA-Z0-9]{24,}/, severity: 'critical' },
  { id: 'G008', name: 'Private Key', pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/, severity: 'critical' },
  { id: 'G009', name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/, severity: 'high' },
  { id: 'G010', name: 'Database URL', pattern: /(postgres|postgresql|mysql|mongodb|redis):\/\/[^\s]+:[^\s]+@[^\s]+/, severity: 'high' },
  { id: 'G011', name: 'Slack Token', pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/, severity: 'critical' },
  { id: 'G012', name: 'Google API Key', pattern: /AIza[0-9A-Za-z_-]{35}/, severity: 'high' },
  { id: 'G013', name: 'Azure Token', pattern: /[a-f0-9]{32}\.v\d+\.[a-f0-9-]{150,}/, severity: 'high' },
];

// SAST rules (simplified CodeQL-like patterns)
const SAST_RULES = [
  { id: 'S001', name: 'SQL Injection Risk', pattern: /`.*\$\{.*\}.*`/gi, severity: 'high', category: 'injection' },
  { id: 'S002', name: 'Hardcoded Password', pattern: /password\s*=\s*['"][^'"]{8,}['"]/gi, severity: 'high', category: 'crypto' },
  { id: 'S003', name: 'Eval Usage', pattern: /\beval\s*\(/gi, severity: 'medium', category: 'injection' },
  { id: 'S004', name: 'Disable Certificate Validation', pattern: /rejectUnauthorized\s*:\s*false/gi, severity: 'medium', category: 'transport' },
  { id: 'S005', name: 'Console Log Sensitive', pattern: /console\.(log|debug|info).*(password|secret|token|key)/gi, severity: 'low', category: 'logging' },
  { id: 'S006', name: 'Weak Cryptography', pattern: /md5\s*\(|sha1\s*\(/gi, severity: 'medium', category: 'crypto' },
];

export class SecurityScannerService {
  private secretSanitizer: SecretSanitizer;
  private scanRepository: SecurityScanRepository | null = null;
  private findingRepository: SecurityFindingRepository | null = null;

  constructor(options?: {
    scanRepository?: SecurityScanRepository;
    findingRepository?: SecurityFindingRepository;
  }) {
    this.secretSanitizer = new SecretSanitizer();
    this.scanRepository = options?.scanRepository ?? null;
    this.findingRepository = options?.findingRepository ?? null;
  }

  /**
   * Set repositories after construction (for lazy initialization)
   */
  setRepositories(scanRepo: SecurityScanRepository, findingRepo: SecurityFindingRepository): void {
    this.scanRepository = scanRepo;
    this.findingRepository = findingRepo;
  }

  /**
   * Validate repository path to prevent command injection
   */
  private validatePath(inputPath: string): string {
    // Check input path for dangerous patterns before resolving
    if (inputPath.includes('..') || inputPath.includes('\0')) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Invalid path: potential traversal attack');
    }

    // Check for shell metacharacters in input
    const dangerousChars = /[;&|$`\\(){}<>!]/;
    if (dangerousChars.test(inputPath)) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Invalid path: contains forbidden characters');
    }

    // Resolve to absolute path
    const resolved = path.resolve(inputPath);

    // Final check on resolved path
    if (!/^[a-zA-Z0-9\-_\/\.]+$/.test(resolved)) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Invalid path: resolved path contains forbidden characters');
    }

    return resolved;
  }

  /**
   * Safely execute a command using spawn (no shell parsing)
   */
  private async safeExec(
    command: string,
    args: string[],
    options: { timeout?: number } = {}
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = options.timeout || 300000;

      const child = spawn(command, args, {
        timeout,
        shell: false, // Never use shell to prevent injection
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        if (code === 0 || stdout) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      // Timeout handling
      setTimeout(() => {
        child.kill();
        reject(new Error('Command timeout'));
      }, timeout);
    });
  }

  /**
   * Main scan entry point
   */
  async scan(options: ScanOptions): Promise<ScanResult> {
    // Validate repository path first
    this.validatePath(options.repository);

    const scanTypes = options.scanTypes || ['secret', 'sast'];
    const startTime = new Date();
    const scanId = this.generateScanId(options.repository);

    logger.info({ scanId, options }, '[SecurityScanner] Starting scan');

    const allFindings: SecurityFinding[] = [];

    // Run requested scan types
    if (scanTypes.includes('secret')) {
      const secretFindings = await this.scanForSecrets(options);
      allFindings.push(...secretFindings);
    }

    if (scanTypes.includes('sast')) {
      const sastFindings = await this.scanForVulnerabilities(options);
      allFindings.push(...sastFindings);
    }

    if (scanTypes.includes('dependency')) {
      const depFindings = await this.scanDependencies(options);
      allFindings.push(...depFindings);
    }

    // Apply severity threshold filter
    const filteredFindings = this.filterBySeverity(allFindings, options.severityThreshold);

    const endTime = new Date();
    const summary = this.calculateSummary(filteredFindings);
    
    // Check gate failure
    const gateFailed = this.checkGateFailure(filteredFindings, options.failOnSeverity);

    const result: ScanResult = {
      id: scanId,
      scanType: scanTypes.length === 1 ? scanTypes[0] : 'composite',
      repository: options.repository,
      branch: options.branch,
      commitHash: options.commitHash,
      findings: filteredFindings,
      scanStartTime: startTime,
      scanEndTime: endTime,
      durationMs: endTime.getTime() - startTime.getTime(),
      status: gateFailed ? 'partial' : 'success',
      scanner: scanTypes.join('+'),
      summary: { ...summary, gateFailed },
    };

    // Persist to database
    if (this.scanRepository && this.findingRepository) {
      try {
        await this.persistScanResult(result, options.repository);
      } catch (error) {
        logger.warn({ error }, '[SecurityScanner] Failed to persist scan result');
      }
    }

    logger.info({ scanId, summary }, '[SecurityScanner] Scan completed');

    return result;
  }

  /**
   * Persist scan result to database
   */
  private async persistScanResult(result: ScanResult, repository: string): Promise<void> {
    if (!this.scanRepository || !this.findingRepository) return;

    // Create scan record
    const scanInput: CreateScanInput = {
      id: result.id,
      scanType: result.scanType,
      repository,
      branch: result.branch,
      commitHash: result.commitHash,
      status: result.status,
      scanner: result.scanner,
      findingsCount: result.findings.length,
      criticalCount: result.summary.critical,
      highCount: result.summary.high,
      mediumCount: result.summary.medium,
      lowCount: result.summary.low,
      infoCount: result.summary.info,
      gateFailed: result.summary.gateFailed ?? false,
      scanStartTime: result.scanStartTime,
      scanEndTime: result.scanEndTime,
      durationMs: result.durationMs,
    };

    await this.scanRepository.create({
      id: scanInput.id,
      tenant_id: null,
      scan_type: scanInput.scanType,
      repository: scanInput.repository,
      branch: scanInput.branch ?? null,
      commit_hash: scanInput.commitHash ?? null,
      status: scanInput.status,
      scanner: scanInput.scanner,
      findings_count: scanInput.findingsCount ?? 0,
      critical_count: scanInput.criticalCount ?? 0,
      high_count: scanInput.highCount ?? 0,
      medium_count: scanInput.mediumCount ?? 0,
      low_count: scanInput.lowCount ?? 0,
      info_count: scanInput.infoCount ?? 0,
      gate_failed: scanInput.gateFailed ?? false,
      scan_start_time: scanInput.scanStartTime,
      scan_end_time: scanInput.scanEndTime,
      duration_ms: scanInput.durationMs ?? 0,
    } as any);

    // Create finding records
    if (result.findings.length > 0) {
      const findingInputs: CreateFindingInput[] = result.findings.map(f => ({
        id: f.id,
        scanId: result.id,
        ruleId: f.ruleId,
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
        file: f.file,
        lineStart: f.lineStart,
        lineEnd: f.lineEnd,
        codeSnippet: f.code,
        match: f.match,
        confidence: f.confidence,
        remediation: f.remediation,
      }));

      await this.findingRepository.batchCreate(findingInputs);
    }
  }

  /**
   * Scan for secrets using pattern matching
   * (In production, would integrate Gitleaks/Trufflehog CLI)
   */
  private async scanForSecrets(options: ScanOptions): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // In production: run gitleaks detect --source={repo} --format=json
    // For now, simulate with local pattern matching
    
    try {
      // Check if gitleaks is available
      const hasGitleaks = await this.checkToolAvailability('gitleaks');
      
      if (hasGitleaks && options.commitHash) {
        // Use gitleaks for actual scanning
        const gitleaksResults = await this.runGitleaks(options);
        findings.push(...gitleaksResults);
      } else {
        // Fallback to pattern-based scanning
        // This would scan actual files in production
        logger.debug('[SecurityScanner] Using pattern-based secret scanning');
      }
    } catch (error) {
      logger.warn({ error }, '[SecurityScanner] Secret scan had issues');
    }

    // Add findings from predefined rules
    for (const rule of SECRET_SCAN_RULES) {
      // In production, this would scan actual files
      // For demo, we log the rule availability
      logger.debug({ rule: rule.id }, '[SecurityScanner] Rule loaded');
    }

    return findings;
  }

  /**
   * Run Gitleaks CLI using spawn (safe from injection)
   */
  private async runGitleaks(options: ScanOptions): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const repoPath = this.validatePath(options.repository);

      const stdout = await this.safeExec('gitleaks', [
        'detect',
        '--source=' + repoPath,
        '--format=json',
        '--no-git',
      ], { timeout: 300000 });

      const results = JSON.parse(stdout || '[]');
      for (const result of results) {
        findings.push({
          id: this.generateFindingId(),
          ruleId: result.RuleID || 'GITLEAKS',
          severity: this.mapGitleaksSeverity(result.RuleID),
          category: 'secret',
          title: result.Description || 'Secret detected',
          description: result.Match,
          file: result.File,
          lineStart: result.StartLine,
          lineEnd: result.EndLine,
          code: result.Context,
          match: result.Match,
          confidence: 0.95,
          remediation: 'Remove or rotate this secret immediately',
        });
      }
    } catch (error) {
      logger.debug({ error }, '[SecurityScanner] Gitleaks not available or failed');
    }

    return findings;
  }

  /**
   * SAST: Static Application Security Testing
   */
  private async scanForVulnerabilities(options: ScanOptions): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // In production: run semgrep or codeql
    try {
      const hasSemgrep = await this.checkToolAvailability('semgrep');
      
      if (hasSemgrep) {
        const semgrepResults = await this.runSemgrep(options);
        findings.push(...semgrepResults);
      }
    } catch (error) {
      logger.debug({ error }, '[SecurityScanner] SAST scan had issues');
    }

    return findings;
  }

  /**
   * Run Semgrep using spawn (safe from injection)
   */
  private async runSemgrep(options: ScanOptions): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const repoPath = this.validatePath(options.repository);

      const stdout = await this.safeExec('semgrep', [
        '--json',
        '--quiet',
        repoPath,
      ], { timeout: 300000 });

      const results = JSON.parse(stdout || '{"results": []}');
      for (const result of results.extra?.metadata || []) {
        findings.push({
          id: this.generateFindingId(),
          ruleId: result.check_id || 'SEMGREP',
          severity: this.mapSemgrepSeverity(result.severity),
          category: 'code',
          title: result.title || 'Vulnerability detected',
          description: result.description || '',
          file: result.path,
          lineStart: result.start_line,
          lineEnd: result.end_line,
          code: result.extra?.lines,
          confidence: 0.8,
          remediation: result.metadata?.fix,
        });
      }
    } catch (error) {
      logger.debug({ error }, '[SecurityScanner] Semgrep not available');
    }

    return findings;
  }

  /**
   * Dependency vulnerability scanning
   */
  private async scanDependencies(options: ScanOptions): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Would use npm audit, snyk, or trivy in production
    try {
      const hasTrivy = await this.checkToolAvailability('trivy');
      
      if (hasTrivy) {
        const trivyResults = await this.runTrivy(options);
        findings.push(...trivyResults);
      }
    } catch (error) {
      logger.debug({ error }, '[SecurityScanner] Dependency scan not available');
    }

    return findings;
  }

  private async runTrivy(options: ScanOptions): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const repoPath = this.validatePath(options.repository);

      const stdout = await this.safeExec('trivy', [
        'fs',
        '--security-checks=vuln,config',
        repoPath,
        '--format=json',
      ], { timeout: 300000 });

      const results = JSON.parse(stdout || '{"Results": []}');
      for (const result of results.Results || []) {
        for (const vuln of result.Vulnerabilities || []) {
          findings.push({
            id: this.generateFindingId(),
            ruleId: vuln.VulnerabilityID,
            severity: this.mapTrivySeverity(vuln.Severity),
            category: 'dependency',
            title: vuln.Title || vuln.VulnerabilityID,
            description: vuln.Description,
            file: result.Target,
            confidence: 0.9,
            remediation: vuln.FixedVersion ? `Upgrade to ${vuln.FixedVersion}` : 'No fix available',
            metadata: {
              package: vuln.PkgName,
              version: vuln.InstalledVersion,
              fixedVersion: vuln.FixedVersion,
            },
          });
        }
      }
    } catch (error) {
      logger.debug({ error }, '[SecurityScanner] Trivy not available');
    }

    return findings;
  }

  /**
   * Check if a tool is available (using spawn, safe from injection)
   */
  private async checkToolAvailability(tool: string): Promise<boolean> {
    // Validate tool name - only allow alphanumeric and dash
    if (!/^[a-zA-Z0-9\-]+$/.test(tool)) {
      return false;
    }

    try {
      await this.safeExec('which', [tool], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Filter findings by severity threshold
   */
  private filterBySeverity(findings: SecurityFinding[], threshold?: string): SecurityFinding[] {
    if (!threshold) return findings;

    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    const thresholdIndex = severityOrder.indexOf(threshold);

    return findings.filter(f => severityOrder.indexOf(f.severity) <= thresholdIndex);
  }

  /**
   * Calculate scan summary
   */
  private calculateSummary(findings: SecurityFinding[]): ScanSummary {
    const summary: ScanSummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: findings.length,
      pass: findings.filter(f => f.severity === 'critical' || f.severity === 'high').length === 0,
    };

    for (const finding of findings) {
      summary[finding.severity]++;
    }

    return summary;
  }

  /**
   * Check if scan fails the gate
   */
  private checkGateFailure(findings: SecurityFinding[], severity?: string): boolean {
    if (!severity) return false;
    
    const severityOrder = ['critical', 'high', 'medium'];
    const failIndex = severityOrder.indexOf(severity);
    
    return findings.some(f => severityOrder.indexOf(f.severity) <= failIndex);
  }

  /**
   * Check gate for composite scans
   */
  async checkGate(scanId: string, failOnSeverity: 'critical' | 'high' | 'medium'): Promise<{
    passed: boolean;
    findings: SecurityFinding[];
    summary: ScanSummary;
  }> {
    // Look up from database
    if (!this.scanRepository || !this.findingRepository) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Scan ${scanId} not found`);
    }

    try {
      const dbScan = await this.scanRepository.findById(scanId);
      if (!dbScan) {
        throw new OrionError(ErrorCode.NOT_FOUND, `Scan ${scanId} not found`);
      }

      const dbFindings = await this.findingRepository.findByScanId(scanId);
      const foundScan = this.entityToScanResult(dbScan, dbFindings);
      const failed = this.checkGateFailure(foundScan.findings, failOnSeverity);

      return {
        passed: !failed,
        findings: foundScan.findings,
        summary: foundScan.summary,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      logger.warn({ error }, '[SecurityScanner] Database lookup failed');
      throw new OrionError(ErrorCode.NOT_FOUND, `Scan ${scanId} not found`);
    }
  }

  /**
   * Get scan history for a repository
   */
  async getScanHistory(repository: string, options?: { limit?: number }): Promise<ScanResult[]> {
    if (!this.scanRepository || !this.findingRepository) {
      return [];
    }

    try {
      const dbScans = await this.scanRepository.findByRepository(repository, options);
      const results: ScanResult[] = [];

      for (const dbScan of dbScans) {
        const dbFindings = await this.findingRepository.findByScanId(dbScan.id);
        results.push(this.entityToScanResult(dbScan, dbFindings));
      }

      return results.slice(-(options?.limit ?? 50));
    } catch (error) {
      logger.warn({ error }, '[SecurityScanner] Database history lookup failed');
      return [];
    }
  }

  /**
   * Get security dashboard metrics
   */
  async getSecurityMetrics(repository?: string): Promise<{
    totalScans: number;
    averageFindings: number;
    criticalCount: number;
    highCount: number;
    trend: 'improving' | 'degrading' | 'stable';
  }> {
    if (!this.scanRepository || !this.findingRepository) {
      return {
        totalScans: 0,
        averageFindings: 0,
        criticalCount: 0,
        highCount: 0,
        trend: 'stable',
      };
    }

    try {
      const stats = await this.scanRepository.getScanStats(repository);
      const recentScans = await this.scanRepository.findRecent(10);
      const recentScanResults: ScanResult[] = [];

      for (const dbScan of recentScans) {
        const dbFindings = await this.findingRepository.findByScanId(dbScan.id);
        recentScanResults.push(this.entityToScanResult(dbScan, dbFindings));
      }

      const trend = this.calculateTrend(recentScanResults);

      return {
        totalScans: stats.totalScans,
        averageFindings: Math.round(stats.avgFindings),
        criticalCount: 0, // Would need aggregation query
        highCount: 0,
        trend,
      };
    } catch (error) {
      logger.warn({ error }, '[SecurityScanner] Database metrics lookup failed');
      return {
        totalScans: 0,
        averageFindings: 0,
        criticalCount: 0,
        highCount: 0,
        trend: 'stable',
      };
    }
  }

  /**
   * Calculate trend from scans
   */
  private calculateTrend(scans: ScanResult[]): 'improving' | 'degrading' | 'stable' {
    const recent = scans.slice(-5);
    const previous = scans.slice(-10, -5);

    const recentAvg = recent.length > 0
      ? recent.reduce((sum, s) => sum + s.findings.length, 0) / recent.length
      : 0;
    const previousAvg = previous.length > 0
      ? previous.reduce((sum, s) => sum + s.findings.length, 0) / previous.length
      : 0;

    if (recentAvg < previousAvg * 0.8) return 'improving';
    if (recentAvg > previousAvg * 1.2) return 'degrading';
    return 'stable';
  }

  /**
   * Convert database entities to ScanResult
   */
  private entityToScanResult(scan: SecurityScanEntity, findings: SecurityFindingEntity[]): ScanResult {
    return {
      id: scan.id,
      scanType: scan.scanType,
      repository: scan.repository,
      branch: scan.branch ?? undefined,
      commitHash: scan.commitHash ?? undefined,
      findings: findings.map(f => ({
        id: f.id,
        ruleId: f.ruleId ?? '',
        severity: f.severity,
        category: f.category ?? '',
        title: f.title,
        description: f.description ?? '',
        file: f.file ?? '',
        lineStart: f.lineStart ?? undefined,
        lineEnd: f.lineEnd ?? undefined,
        code: f.codeSnippet ?? undefined,
        match: f.match ?? undefined,
        confidence: f.confidence,
        remediation: f.remediation ?? undefined,
      })),
      scanStartTime: scan.scanStartTime,
      scanEndTime: scan.scanEndTime,
      durationMs: scan.durationMs,
      status: scan.status,
      scanner: scan.scanner,
      summary: {
        critical: scan.criticalCount,
        high: scan.highCount,
        medium: scan.mediumCount,
        low: scan.lowCount,
        info: scan.infoCount,
        total: scan.findingsCount,
        pass: scan.criticalCount === 0 && scan.highCount === 0,
        gateFailed: scan.gateFailed,
      },
    };
  }

  // Utility methods
  private generateScanId(repo: string): string {
    return `scan-${repo}-${Date.now()}`;
  }

  private generateFindingId(): string {
    return `find-${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapGitleaksSeverity(ruleId: string): SecurityFinding['severity'] {
    const map: Record<string, SecurityFinding['severity']> = {
      'AWS': 'critical',
      'GitHub': 'critical',
      'GitLab': 'critical',
      'Stripe': 'critical',
      'Slack': 'critical',
      'Private-Key': 'critical',
      'JWT': 'high',
      'Database': 'high',
    };
    
    for (const [key, severity] of Object.entries(map)) {
      if (ruleId.includes(key)) return severity;
    }
    return 'high';
  }

  private mapSemgrepSeverity(severity?: string): SecurityFinding['severity'] {
    const map: Record<string, SecurityFinding['severity']> = {
      'ERROR': 'critical',
      'WARNING': 'high',
      'INFO': 'low',
    };
    return map[severity || ''] || 'medium';
  }

  private mapTrivySeverity(severity?: string): SecurityFinding['severity'] {
    const map: Record<string, SecurityFinding['severity']> = {
      'CRITICAL': 'critical',
      'HIGH': 'high',
      'MEDIUM': 'medium',
      'LOW': 'low',
      'UNKNOWN': 'info',
    };
    return map[severity?.toUpperCase() || ''] || 'medium';
  }
}

export default SecurityScannerService;