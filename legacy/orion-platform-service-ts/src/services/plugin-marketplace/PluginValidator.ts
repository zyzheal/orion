/**
 * Plugin Validator - Phase 3
 *
 * Validates plugin packages for:
 * - Structural integrity and required fields
 * - Malicious code scanning
 * - API compatibility with the platform
 */

export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  securityRisk: 'none' | 'low' | 'medium' | 'high';
}

export interface PluginPackage {
  name: string;
  version: string;
  description?: string;
  author?: string;
  category?: string;
  main: string;
  code: string;
  dependencies?: Record<string, string>;
  platform_api_version?: string;
  permissions?: string[];
  config_schema?: Record<string, any>;
}

/**
 * Suspicious patterns to scan for in plugin code
 */
const MALICIOUS_PATTERNS = [
  { pattern: /process\.env/gi, description: 'Environment variable access', severity: 'low' },
  { pattern: /fs\.(read|write|append)File/gi, description: 'File system access', severity: 'high' },
  { pattern: /child_process\.(exec|spawn|fork)/gi, description: 'Child process execution', severity: 'high' },
  { pattern: /eval\s*\(/gi, description: 'Dynamic code evaluation', severity: 'high' },
  { pattern: /new\s+Function\s*\(/gi, description: 'Dynamic function creation', severity: 'high' },
  { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/gi, description: 'Child process import', severity: 'high' },
  { pattern: /require\s*\(\s*['"]fs['"]\s*\)/gi, description: 'File system import', severity: 'medium' },
  { pattern: /net\.(connect|createConnection)/gi, description: 'Network connection creation', severity: 'medium' },
  { pattern: /http[s]?\.(get|post|request)/gi, description: 'HTTP request', severity: 'medium' },
  { pattern: /crypto\.(createCipher|createDecipher)/gi, description: 'Cryptographic operations', severity: 'low' },
  { pattern: /Buffer\.from\s*\(/gi, description: 'Buffer operations', severity: 'low' },
  { pattern: /\bfetch\s*\(/gi, description: 'Fetch API usage', severity: 'low' },
  { pattern: /XMLHttpRequest/gi, description: 'XMLHttpRequest usage', severity: 'low' },
  { pattern: /\bsetTimeout\b/gi, description: 'Timer usage', severity: 'low' },
  { pattern: /\bsetInterval\b/gi, description: 'Interval usage', severity: 'low' },
];

/**
 * Required fields for a valid plugin package
 */
const REQUIRED_FIELDS = ['name', 'version', 'main', 'code'] as const;

/**
 * Maximum plugin code size (512KB)
 */
const MAX_CODE_SIZE = 512 * 1024;

/**
 * Maximum number of dependencies
 */
const MAX_DEPENDENCIES = 50;

/**
 * Supported platform API versions
 */
const SUPPORTED_API_VERSIONS = ['1.0', '1.1', '2.0', '2.1', '3.0'];

export class PluginValidator {
  /**
   * Validate a plugin package
   */
  validatePlugin(packageData: PluginPackage): PluginValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let securityRisk: 'none' | 'low' | 'medium' | 'high' = 'none';

    // Check required fields
    for (const field of REQUIRED_FIELDS) {
      if (!packageData[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // If missing required fields, return early
    if (errors.length > 0) {
      return { valid: false, errors, warnings, securityRisk: 'none' };
    }

    // Validate name format (alphanumeric, hyphens, underscores only)
    if (!/^[a-z][a-z0-9_-]*$/.test(packageData.name)) {
      errors.push('Plugin name must start with a lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores');
    }

    // Validate version format (semver)
    if (!/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(packageData.version)) {
      errors.push('Plugin version must follow semantic versioning (e.g., 1.0.0)');
    }

    // Validate code size
    if (packageData.code.length > MAX_CODE_SIZE) {
      errors.push(`Plugin code exceeds maximum size of ${MAX_CODE_SIZE} bytes`);
    }

    // Validate dependencies count
    if (packageData.dependencies && Object.keys(packageData.dependencies).length > MAX_DEPENDENCIES) {
      errors.push(`Too many dependencies (max ${MAX_DEPENDENCIES})`);
    }

    // Validate config schema if provided
    if (packageData.config_schema) {
      if (typeof packageData.config_schema !== 'object') {
        errors.push('config_schema must be an object');
      } else if (Object.keys(packageData.config_schema).length > 100) {
        warnings.push('Large config schema (over 100 fields)');
      }
    }

    // Validate permissions
    if (packageData.permissions) {
      const validPermissions = ['network', 'filesystem', 'process', 'crypto', 'timer', 'storage'];
      for (const perm of packageData.permissions) {
        if (!validPermissions.includes(perm)) {
          warnings.push(`Unknown permission: ${perm}`);
        }
      }
    }

    // Run security scan
    const scanResult = this.scanForMaliciousCode(packageData.code);
    if (scanResult.findings.length > 0) {
      for (const finding of scanResult.findings) {
        if (finding.severity === 'high') {
          errors.push(`Security issue: ${finding.description}`);
          securityRisk = 'high';
        } else if (finding.severity === 'medium') {
          warnings.push(`Security concern: ${finding.description}`);
          if (securityRisk === 'none') {
            securityRisk = 'medium';
          }
        } else {
          warnings.push(`Security note: ${finding.description}`);
          if (securityRisk === 'none') {
            securityRisk = 'low';
          }
        }
      }
    }

    // Check API compatibility
    if (packageData.platform_api_version) {
      const compatResult = this.checkApiCompatibility(
        { ...packageData },
        { apiVersion: '3.0' }
      );
      if (!compatResult.compatible) {
        warnings.push(`API compatibility: ${compatResult.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      securityRisk,
    };
  }

  /**
   * Scan plugin code for potentially malicious patterns
   */
  scanForMaliciousCode(code: string): { findings: Array<{ pattern: string; description: string; severity: string }> } {
    const findings: Array<{ pattern: string; description: string; severity: string }> = [];

    for (const { pattern, description, severity } of MALICIOUS_PATTERNS) {
      if (pattern.test(code)) {
        findings.push({ pattern: pattern.source, description, severity });
      }
    }

    return { findings };
  }

  /**
   * Check if a plugin is compatible with the platform API
   */
  checkApiCompatibility(
    plugin: PluginPackage,
    platform: { apiVersion: string }
  ): { compatible: boolean; message: string } {
    if (!plugin.platform_api_version) {
      return {
        compatible: true,
        message: 'No API version specified, assuming compatible',
      };
    }

    const pluginVersion = plugin.platform_api_version;

    if (!SUPPORTED_API_VERSIONS.includes(pluginVersion)) {
      return {
        compatible: false,
        message: `Plugin API version ${pluginVersion} is not supported. Supported versions: ${SUPPORTED_API_VERSIONS.join(', ')}`,
      };
    }

    // Check major version compatibility
    const pluginMajor = parseInt(pluginVersion.split('.')[0], 10);
    const platformMajor = parseInt(platform.apiVersion.split('.')[0], 10);

    if (pluginMajor > platformMajor) {
      return {
        compatible: false,
        message: `Plugin requires API version ${pluginVersion} which is newer than platform API version ${platform.apiVersion}`,
      };
    }

    return {
      compatible: true,
      message: `Plugin API version ${pluginVersion} is compatible with platform API version ${platform.apiVersion}`,
    };
  }
}
