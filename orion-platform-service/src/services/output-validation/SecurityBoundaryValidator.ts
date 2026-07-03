// orion-platform-service/src/services/output-validation/SecurityBoundaryValidator.ts
import { minimatch } from 'minimatch';
import { createLogger } from '../utils/logger';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const DISALLOWED_PATTERNS = [
  '**/.env*',
  '**/credentials*',
  '**/secrets*',
  '**/config*.json',
  '**/*.pem',
  '**/*.key',
  '**/auth*.json',
  '**/private*',
  '**/ssh/*',
  '**/.ssh/*',
  '**/aws/*',
  '**/.aws/*',
  '**/kubeconfig*',
  '**/.kube/*',
];

const ALLOWED_EXTENSIONS = ['.ts', '.js', '.py', '.go', '.java', '.tsx', '.jsx', '.json', '.yaml', '.yml', '.md'];

const SENSITIVE_KEYWORDS = ['secret', 'credential', 'password', 'token', 'api_key', 'private_key', 'apikey'];

export interface SecurityValidationResult {
  valid: boolean;
  violations: string[];
  warnings?: string[];
}

export interface SecurityBoundaryConfig {
  allowedPaths?: string[];
  disallowedPatterns?: string[];
  maxFileSize?: number;
  maxChangesPerPatch?: number;
}

export class SecurityBoundaryValidator {
  private disallowedPatterns: string[];
  private allowedExtensions: string[];
  private sensitiveKeywords: string[];
  private config: SecurityBoundaryConfig;

  constructor(config: SecurityBoundaryConfig = {}) {
    this.disallowedPatterns = config.disallowedPatterns || DISALLOWED_PATTERNS;
    this.allowedExtensions = ALLOWED_EXTENSIONS;
    this.sensitiveKeywords = SENSITIVE_KEYWORDS;
    this.config = config;
  }

  validate(patch: { target_files: Array<{ path: string; operation?: string }> }): SecurityValidationResult {
    const violations: string[] = [];
    const warnings: string[] = [];

    for (const file of patch.target_files) {
      const path = file.path;
      const normalizedPath = this.normalizePath(path);

      // Check disallowed patterns
      for (const pattern of this.disallowedPatterns) {
        if (minimatch(normalizedPath, pattern) || minimatch(path, pattern)) {
          violations.push(`File path matches disallowed pattern: ${pattern} (${path})`);
        }
      }

      // Check allowed extensions
      const ext = this.getExtension(path);
      if (!this.allowedExtensions.includes(ext)) {
        violations.push(`File extension not allowed: ${ext} (${path})`);
      }

      // Check for sensitive file names
      const lowerPath = path.toLowerCase();
      for (const keyword of this.sensitiveKeywords) {
        if (lowerPath.includes(keyword)) {
          warnings.push(`File path contains sensitive keyword: ${keyword} (${path})`);
        }
      }

      // Check for absolute paths (security risk)
      if (path.startsWith('/') || path.match(/^[A-Za-z]:/)) {
        violations.push(`Absolute paths are not allowed: ${path}`);
      }

      // Check for path traversal attempts
      if (path.includes('..') || path.includes('~')) {
        violations.push(`Path traversal attempt detected: ${path}`);
      }

      // Check for hidden files
      const fileName = path.split('/').pop() || '';
      if (fileName.startsWith('.') && !fileName.startsWith('.github')) {
        warnings.push(`Hidden file detected: ${path}`);
      }
    }

    // Check max changes per patch
    const maxChanges = this.config.maxChangesPerPatch || 10;
    if (patch.target_files.length > maxChanges) {
      violations.push(`Too many files in patch: ${patch.target_files.length} > ${maxChanges}`);
    }

    logger.info(`[SecurityBoundary] Validation: ${violations.length === 0 ? 'PASS' : 'FAIL'} (${violations.length} violations, ${warnings.length} warnings)`);

    return {
      valid: violations.length === 0,
      violations,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  validateContent(content: string): SecurityValidationResult {
    const violations: string[] = [];
    const warnings: string[] = [];

    // Check for sensitive content patterns
    const sensitivePatterns = [
      { pattern: /password\s*[=:]\s*['"][^'"]+['"]/gi, message: 'Hardcoded password detected' },
      { pattern: /api[_-]?key\s*[=:]\s*['"][^'"]+['"]/gi, message: 'Hardcoded API key detected' },
      { pattern: /secret[_-]?key\s*[=:]\s*['"][^'"]+['"]/gi, message: 'Hardcoded secret key detected' },
      { pattern: /token\s*[=:]\s*['"][^'"]+['"]/gi, message: 'Hardcoded token detected' },
      { pattern: /private[_-]?key\s*[=:]\s*['"][^'"]+['"]/gi, message: 'Hardcoded private key detected' },
      { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi, message: 'PEM private key detected' },
    ];

    for (const { pattern, message } of sensitivePatterns) {
      if (content.match(pattern)) {
        warnings.push(message);
      }
    }

    // Check content size
    const maxSize = this.config.maxFileSize || 100000;
    if (content.length > maxSize) {
      violations.push(`Content exceeds maximum size: ${content.length} > ${maxSize}`);
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/').toLowerCase();
  }

  private getExtension(path: string): string {
    const parts = path.split('.');
    if (parts.length > 1) {
      return '.' + parts.pop()?.toLowerCase();
    }
    return '';
  }

  addDisallowedPattern(pattern: string): void {
    this.disallowedPatterns.push(pattern);
  }

  addAllowedExtension(ext: string): void {
    this.allowedExtensions.push(ext.toLowerCase());
  }
}