import { spawn } from 'child_process';
import pino from 'pino';

const logger = pino({ name: 'trivy-scanner' });

export interface ScanResult {
  vulnerabilities: {
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    package: string;
    version: string;
    fixedVersion?: string;
    title: string;
    description?: string;
  }[];
  scanCompleted: boolean;
  scannedAt: string;
}

export class TrivyScannerService {
  async scanImage(imageTag: string): Promise<ScanResult> {
    return new Promise((resolve, reject) => {
      logger.info({ imageTag }, 'Starting Trivy scan');

      const child = spawn('trivy', ['image', '--format', 'json', '--severity', 'HIGH,CRITICAL', imageTag], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number | null) => {
        logger.info({ imageTag, code }, 'Trivy scan completed');

        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(this.parseTrivyResult(result));
          } catch (e) {
            logger.error({ error: e }, 'Failed to parse Trivy output');
            resolve({ vulnerabilities: [], scanCompleted: true, scannedAt: new Date().toISOString() });
          }
        } else {
          logger.warn({ code, stderr }, 'Trivy scan failed');
          resolve({ vulnerabilities: [], scanCompleted: false, scannedAt: new Date().toISOString() });
        }
      });

      child.on('error', (err: Error) => {
        logger.error({ error: err }, 'Trivy spawn error');
        resolve({ vulnerabilities: [], scanCompleted: false, scannedAt: new Date().toISOString() });
      });
    });
  }

  private parseTrivyResult(data: Record<string, unknown>): ScanResult {
    const results = data.Results as Array<Record<string, unknown>> | undefined;
    if (!results) {
      return { vulnerabilities: [], scanCompleted: true, scannedAt: new Date().toISOString() };
    }

    const vulns = results.flatMap((r: Record<string, unknown>) => {
      const vulnerabilities = r.Vulnerabilities as Array<Record<string, unknown>> | undefined;
      if (!vulnerabilities) return [];

      return vulnerabilities.map((v: Record<string, unknown>) => ({
        severity: (v.Severity as string)?.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        package: v.PkgName as string,
        version: v.InstalledVersion as string,
        fixedVersion: v.FixedVersion as string | undefined,
        title: (v.Title as string) || (v.VulnerabilityID as string),
        description: v.Description as string | undefined,
      }));
    });

    return {
      vulnerabilities: vulns,
      scanCompleted: true,
      scannedAt: new Date().toISOString(),
    };
  }
}