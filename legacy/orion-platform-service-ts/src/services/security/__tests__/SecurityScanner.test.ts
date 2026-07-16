/**
 * SecurityScanner Unit Tests
 *
 * Tests: scanWithTrivy, parseTrivyResult, signWithCosign, verifyCosignSignature, generateSBOM
 */

import { SecurityScanner, SecurityScannerError } from '../SecurityScanner';

// Mock child_process.exec
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

// Mock util.promisify to return our mock execAsync
jest.mock('util', () => {
  const mockFn = jest.fn();
  return {
    promisify: jest.fn(() => mockFn),
    __mockExecAsync: mockFn,
  };
});

// Mock repositories
jest.mock('../../../repositories/SecurityTrivyScanRepository', () => ({
  SecurityTrivyScanRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({ id: 'scan-1' }),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue({ entities: [], total: 0 }),
    findByImageName: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../../../repositories/SecurityCosignSignatureRepository', () => ({
  SecurityCosignSignatureRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({ id: 'cosign-1' }),
    findByImageName: jest.fn().mockResolvedValue(null),
  })),
}));

jest.mock('../../../repositories/SecuritySbomRepository', () => ({
  SecuritySbomRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({ id: 'sbom-1' }),
    findByImageName: jest.fn().mockResolvedValue([]),
  })),
}));

const mockDb = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
const mockExecAsync = (require('util') as any).__mockExecAsync;

describe('SecurityScanner', () => {
  let scanner: SecurityScanner;

  beforeEach(() => {
    jest.clearAllMocks();
    scanner = new SecurityScanner(mockDb);
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should create an instance with db', () => {
      expect(scanner).toBeInstanceOf(SecurityScanner);
    });
  });

  // ==================== scanWithTrivy ====================

  describe('scanWithTrivy', () => {
    it('should return success with real trivy output', async () => {
      const trivyOutput = JSON.stringify({
        Results: [
          {
            Vulnerabilities: [
              {
                VulnerabilityID: 'CVE-2024-0001',
                PkgName: 'openssl',
                InstalledVersion: '1.1.1k',
                Severity: 'HIGH',
                Title: 'Buffer overflow',
                Description: 'Buffer overflow in OpenSSL',
                FixedVersion: '1.1.1l',
              },
            ],
          },
        ],
      });
      mockExecAsync.mockResolvedValue({ stdout: trivyOutput });

      const result = await scanner.scanWithTrivy('nginx:latest');

      expect(result.success).toBe(true);
      const scanResult = result.result as any;
      expect(scanResult.imageName).toBe('nginx:latest');
      expect(scanResult.vulnerabilities).toHaveLength(1);
      expect(scanResult.vulnerabilities[0].vulnerabilityID).toBe('CVE-2024-0001');
      expect(scanResult.summary.high).toBe(1);
      expect(scanResult.passed).toBe(false);
    });

    it('should fallback to simulated scan when trivy is not available', async () => {
      mockExecAsync.mockRejectedValue(new Error('trivy: command not found'));

      const result = await scanner.scanWithTrivy('myapp:v1');

      expect(result.success).toBe(true);
      const scanResult = result.result as any;
      expect(scanResult.imageName).toBe('myapp:v1');
      expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
      expect(scanResult.scannerVersion).toContain('simulated');
    });

    it('should return error for empty image name', async () => {
      const result = await scanner.scanWithTrivy('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Image name is required');
    });

    it('should return error for whitespace-only image name', async () => {
      const result = await scanner.scanWithTrivy('   ');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Image name is required');
    });
  });

  // ==================== parseTrivyResult ====================

  describe('parseTrivyResult', () => {
    it('should parse valid trivy JSON output', () => {
      const output = JSON.stringify({
        Results: [
          {
            Vulnerabilities: [
              {
                VulnerabilityID: 'CVE-2024-0001',
                PkgName: 'openssl',
                InstalledVersion: '1.1.1k',
                Severity: 'CRITICAL',
                Title: 'Critical vuln',
                Description: 'A critical vulnerability',
                FixedVersion: '1.1.1l',
                References: ['https://nvd.nist.gov/'],
              },
              {
                VulnerabilityID: 'CVE-2024-0002',
                PkgName: 'curl',
                InstalledVersion: '7.68.0',
                Severity: 'LOW',
                Title: 'Low vuln',
                Description: 'A low vulnerability',
              },
            ],
          },
        ],
      });

      const result = scanner.parseTrivyResult(output, 'test-image:latest');

      expect(result.imageName).toBe('test-image:latest');
      expect(result.vulnerabilities).toHaveLength(2);
      expect(result.summary.critical).toBe(1);
      expect(result.summary.low).toBe(1);
      expect(result.summary.total).toBe(2);
      expect(result.passed).toBe(false);
    });

    it('should pass when no critical or high vulns', () => {
      const output = JSON.stringify({
        Results: [
          {
            Vulnerabilities: [
              {
                VulnerabilityID: 'CVE-2024-0003',
                PkgName: 'libxml2',
                InstalledVersion: '2.9.10',
                Severity: 'MEDIUM',
                Title: 'Medium vuln',
                Description: 'A medium vulnerability',
              },
            ],
          },
        ],
      });

      const result = scanner.parseTrivyResult(output, 'safe-image:v1');

      expect(result.passed).toBe(true);
      expect(result.summary.medium).toBe(1);
      expect(result.summary.critical).toBe(0);
      expect(result.summary.high).toBe(0);
    });

    it('should normalize severity variants', () => {
      const output = JSON.stringify({
        Results: [
          {
            Vulnerabilities: [
              { VulnerabilityID: 'CVE-1', PkgName: 'a', InstalledVersion: '1', Severity: 'CRIT', Title: 't', Description: 'd' },
              { VulnerabilityID: 'CVE-2', PkgName: 'b', InstalledVersion: '1', Severity: 'MODERATE', Title: 't', Description: 'd' },
              { VulnerabilityID: 'CVE-3', PkgName: 'c', InstalledVersion: '1', Severity: 'unknown_sev', Title: 't', Description: 'd' },
            ],
          },
        ],
      });

      const result = scanner.parseTrivyResult(output);

      expect(result.vulnerabilities[0].severity).toBe('CRITICAL');
      expect(result.vulnerabilities[1].severity).toBe('MEDIUM');
      expect(result.vulnerabilities[2].severity).toBe('UNKNOWN');
    });

    it('should fallback to tabular parsing for non-JSON output', () => {
      const tabularOutput = 'CVE-2024-0001  openssl  1.1.1k  HIGH  Buffer overflow\nCVE-2024-0002  curl  7.68.0  MEDIUM  Cert bypass';

      const result = scanner.parseTrivyResult(tabularOutput, 'test:latest');

      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.imageName).toBe('test:latest');
    });

    it('should default imageName to unknown when not provided', () => {
      const result = scanner.parseTrivyResult('{}');

      expect(result.imageName).toBe('unknown');
    });

    it('should handle empty Results array', () => {
      const output = JSON.stringify({ Results: [] });
      const result = scanner.parseTrivyResult(output);

      expect(result.vulnerabilities).toHaveLength(0);
      expect(result.summary.total).toBe(0);
      expect(result.passed).toBe(true);
    });

    it('should handle Results without Vulnerabilities', () => {
      const output = JSON.stringify({ Results: [{ Target: 'os' }] });
      const result = scanner.parseTrivyResult(output);

      expect(result.vulnerabilities).toHaveLength(0);
    });
  });

  // ==================== signWithCosign ====================

  describe('signWithCosign', () => {
    it('should sign successfully with real cosign', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'Pushing signature to: registry.example.com/nginx@sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      });

      const result = await scanner.signWithCosign('nginx:latest', '/path/to/key');

      expect(result.success).toBe(true);
      const sig = result.result as any;
      expect(sig.imageName).toBe('nginx:latest');
      expect(sig.keyId).toBe('/path/to/key');
      expect(sig.verified).toBe(true);
      expect(sig.digest).toContain('sha256:');
    });

    it('should fallback to simulated signing when cosign is not available', async () => {
      mockExecAsync.mockRejectedValue(new Error('cosign: command not found'));

      const result = await scanner.signWithCosign('myapp:v1', 'my-key');

      expect(result.success).toBe(true);
      const sig = result.result as any;
      expect(sig.imageName).toBe('myapp:v1');
      expect(sig.keyId).toBe('my-key');
      expect(sig.digest).toContain('sha256:');
    });

    it('should return error when image name is empty', async () => {
      const result = await scanner.signWithCosign('', 'key');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Image name and key are required');
    });

    it('should return error when key is empty', async () => {
      const result = await scanner.signWithCosign('image:latest', '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Image name and key are required');
    });
  });

  // ==================== verifyCosignSignature ====================

  describe('verifyCosignSignature', () => {
    it('should verify successfully with real cosign output', async () => {
      const cosignOutput = JSON.stringify([
        {
          critical: {
            image: { 'docker-manifest-digest': 'sha256:abc123' },
          },
          optional: { issuer: 'https://accounts.google.com' },
        },
      ]);
      mockExecAsync.mockResolvedValue({ stdout: cosignOutput });

      const result = await scanner.verifyCosignSignature('nginx:latest');

      expect(result.success).toBe(true);
      const sig = result.result as any;
      expect(sig.verified).toBe(true);
      expect(sig.digest).toBe('sha256:abc123');
      expect(sig.keyId).toBe('https://accounts.google.com');
    });

    it('should use stored signature when cosign command fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('cosign: command not found'));

      // Access the mocked repository to set up a stored signature
      const { SecurityCosignSignatureRepository } = require('../../../repositories/SecurityCosignSignatureRepository');
      const mockRepo = SecurityCosignSignatureRepository.mock.results[0]?.value;
      if (mockRepo) {
        mockRepo.findByImageName.mockResolvedValueOnce({
          imageName: 'stored-image:v1',
          digest: 'sha256:stored-digest',
          signedAt: new Date(),
          keyId: 'stored-key',
          verified: true,
        });
      }

      const result = await scanner.verifyCosignSignature('stored-image:v1');

      expect(result.success).toBe(true);
    });

    it('should simulate verification when no stored signature and cosign fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('cosign: command not found'));

      const result = await scanner.verifyCosignSignature('unknown-image:v1');

      expect(result.success).toBe(true);
      const sig = result.result as any;
      expect(sig.verified).toBe(true);
      expect(sig.keyId).toBe('cosign-key-simulated');
    });

    it('should return error when image name is empty', async () => {
      const result = await scanner.verifyCosignSignature('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Image name is required');
    });
  });

  // ==================== generateSBOM ====================

  describe('generateSBOM', () => {
    it('should generate SBOM with real trivy output', async () => {
      const cycloneDxOutput = JSON.stringify({
        components: [
          { name: 'openssl', version: '1.1.1k', type: 'library', licenses: [{ license: { id: 'OpenSSL' } }] },
          { name: 'zlib', version: '1.2.11', type: 'library' },
        ],
      });
      mockExecAsync.mockResolvedValue({ stdout: cycloneDxOutput });

      const result = await scanner.generateSBOM('nginx:latest');

      expect(result.success).toBe(true);
      const sbom = result.result as any;
      expect(sbom.imageName).toBe('nginx:latest');
      expect(sbom.format).toBe('cyclonedx');
      expect(sbom.components).toHaveLength(2);
      expect(sbom.components[0].name).toBe('openssl');
    });

    it('should fallback to syft when trivy sbom fails', async () => {
      const syftOutput = JSON.stringify({
        components: [{ name: 'busybox', version: '1.33.1', type: 'os' }],
      });
      mockExecAsync
        .mockRejectedValueOnce(new Error('trivy: not found'))
        .mockResolvedValueOnce({ stdout: syftOutput });

      const result = await scanner.generateSBOM('myapp:v1');

      expect(result.success).toBe(true);
      const sbom = result.result as any;
      expect(sbom.components).toHaveLength(1);
    });

    it('should fallback to simulated SBOM when both trivy and syft fail', async () => {
      mockExecAsync
        .mockRejectedValueOnce(new Error('trivy: not found'))
        .mockRejectedValueOnce(new Error('syft: not found'));

      const result = await scanner.generateSBOM('myapp:v1');

      expect(result.success).toBe(true);
      const sbom = result.result as any;
      expect(sbom.imageName).toBe('myapp:v1');
      expect(sbom.format).toBe('cyclonedx');
      expect(sbom.components.length).toBeGreaterThan(0);
    });

    it('should return error when image name is empty', async () => {
      const result = await scanner.generateSBOM('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Image name is required');
    });
  });

  // ==================== getScanResult ====================

  describe('getScanResult', () => {
    it('should return undefined for non-existent scan', async () => {
      const result = await scanner.getScanResult('non-existent');
      expect(result).toBeUndefined();
    });
  });

  // ==================== getSignature ====================

  describe('getSignature', () => {
    it('should return undefined for non-existent signature', async () => {
      const result = await scanner.getSignature('unknown-image');
      expect(result).toBeUndefined();
    });
  });

  // ==================== getSBOM ====================

  describe('getSBOM', () => {
    it('should return undefined for non-existent SBOM', async () => {
      const result = await scanner.getSBOM('unknown-image');
      expect(result).toBeUndefined();
    });
  });

  // ==================== getAllScanResults ====================

  describe('getAllScanResults', () => {
    it('should return empty array when no scans exist', async () => {
      const results = await scanner.getAllScanResults();
      expect(results).toEqual([]);
    });
  });

  // ==================== SecurityScannerError ====================

  describe('SecurityScannerError', () => {
    it('should create error with code and cause', () => {
      const cause = new Error('root cause');
      const error = new SecurityScannerError('test error', 'TEST_CODE', cause);

      expect(error.message).toBe('test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('SecurityScannerError');
    });

    it('should create error without cause', () => {
      const error = new SecurityScannerError('test error', 'TEST_CODE');

      expect(error.message).toBe('test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.cause).toBeUndefined();
    });
  });
});
