/**
 * HelmDeploymentService - Helm Chart 部署 (Task 2.2)
 *
 * 职责：
 * - Helm upgrade --install 部署 Chart
 * - Helm rollback 回滚版本
 * - 获取部署状态
 * - 支持自定义 values 覆盖
 */

import { spawn } from 'child_process';
import * as path from 'path';
import pino from 'pino';

const logger = pino({ name: 'helm-deployment-service' });

export interface HelmDeployConfig {
  releaseName: string;
  namespace: string;
  chartPath: string;
  values?: Record<string, unknown>;
  valuesFiles?: string[];
  version?: string;
  wait?: boolean;
  timeout?: string;
}

export interface HelmDeployResult {
  success: boolean;
  message: string;
  revision?: number;
}

export class HelmDeploymentService {
  private defaultNamespace: string;

  constructor(options?: { defaultNamespace?: string }) {
    this.defaultNamespace = options?.defaultNamespace || 'default';
  }

  /**
   * 部署/升级 Helm Release
   */
  async deploy(config: HelmDeployConfig): Promise<HelmDeployResult> {
    // 验证 releaseName 格式（K8s/ Helm 命名规范）
    if (!/^[a-zA-Z0-9]([-a-zA-Z0-9_.]*[a-zA-Z0-9])?$/.test(config.releaseName)) {
      return {
        success: false,
        message: `Invalid release name: ${config.releaseName}`,
      };
    }

    // 验证 chartPath 安全性
    const validatedPath = this.validateChartPath(config.chartPath);
    if (!validatedPath) {
      return {
        success: false,
        message: `Invalid chart path: ${config.chartPath}`,
      };
    }

    const args = [
      'upgrade', '--install',
      config.releaseName,
      validatedPath,
      '-n', config.namespace || this.defaultNamespace,
    ];

    if (config.wait) args.push('--wait');
    if (config.timeout) args.push('--timeout', config.timeout);
    if (config.version) args.push('--version', config.version);

    // 添加 values 文件
    if (config.valuesFiles) {
      for (const file of config.valuesFiles) {
        args.push('-f', file);
      }
    }

    // 添加内联 values
    if (config.values && Object.keys(config.values).length > 0) {
      args.push('--set', this.flattenValues(config.values));
    }

    try {
      const result = await this.runHelm(args);
      const revision = this.parseRevision(result.stdout);
      return {
        success: true,
        message: `Helm release ${config.releaseName} deployed`,
        revision,
      };
    } catch (error: any) {
      logger.error({ error, config }, 'Helm deploy failed');
      return {
        success: false,
        message: error.message || 'Helm deploy failed',
      };
    }
  }

  /**
   * 回滚 Helm Release
   */
  async rollback(
    releaseName: string,
    namespace: string,
    revision?: number
  ): Promise<HelmDeployResult> {
    const args = ['rollback', releaseName, '-n', namespace];
    if (revision) args.push('--to-revision', String(revision));

    try {
      const result = await this.runHelm(args);
      // 解析实际回滚到的版本号
      const actualRevision = this.parseRevision(result.stdout) || revision;
      return {
        success: true,
        message: `Helm release ${releaseName} rolled back`,
        revision: actualRevision,
      };
    } catch (error: any) {
      logger.error({ error }, 'Helm rollback failed');
      return {
        success: false,
        message: error.message || 'Helm rollback failed',
      };
    }
  }

  /**
   * 获取 Release 状态
   */
  async status(releaseName: string, namespace: string): Promise<any> {
    const result = await this.runHelm([
      'status', releaseName,
      '-n', namespace,
      '-o', 'json',
    ]);
    return JSON.parse(result.stdout);
  }

  /**
   * 列出所有 Releases
   */
  async listReleases(namespace?: string): Promise<Array<{
    name: string;
    namespace: string;
    revision: number;
    status: string;
    chart: string;
    appVersion: string;
  }>> {
    const args = ['list', '-o', 'json'];
    if (namespace) args.push('-n', namespace);

    const result = await this.runHelm(args);
    return JSON.parse(result.stdout);
  }

  /**
   * 查看 Release 历史
   */
  async history(releaseName: string, namespace: string): Promise<any[]> {
    const result = await this.runHelm([
      'history', releaseName,
      '-n', namespace,
      '-o', 'json',
    ]);
    return JSON.parse(result.stdout);
  }

  /**
   * 展平 values 对象为 helm --set 格式
   * 对特殊字符进行转义，防止逗号注入
   * 支持数组和嵌套对象
   */
  private flattenValues(obj: Record<string, unknown>): string {
    const parts: string[] = [];
    const escapeHelmSet = (v: string): string => {
      // Helm --set 中逗号、等号、反斜杠需要转义
      return v.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/=/g, '\\=');
    };
    const walk = (o: any, prefix: string = '') => {
      for (const [k, v] of Object.entries(o)) {
        const key = prefix ? `${prefix}.${k}` : k;

        // 处理数组
        if (Array.isArray(v)) {
          v.forEach((item, idx) => {
            const arrKey = `${key}[${idx}]`;
            if (typeof item === 'object' && item !== null) {
              walk(item, arrKey);
            } else {
              const escapedValue = typeof item === 'string' ? escapeHelmSet(String(item)) : JSON.stringify(item);
              parts.push(`${arrKey}=${escapedValue}`);
            }
          });
        }
        // 处理嵌套对象
        else if (typeof v === 'object' && v !== null) {
          walk(v, key);
        }
        // 处理基本类型
        else {
          const escapedValue = typeof v === 'string' ? escapeHelmSet(v) : JSON.stringify(v);
          parts.push(`${key}=${escapedValue}`);
        }
      }
    };
    walk(obj);
    return parts.join(',');
  }

  /**
   * 解析版本号
   */
  private parseRevision(output: string): number | undefined {
    const match = output.match(/Revision:\s*(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
  }

  /**
   * 验证 chartPath 安全性，防止路径遍历
   */
  private validateChartPath(chartPath: string): string | null {
    // 允许 OCI registry 引用 (e.g., oci://registry.example.com/chart)
    if (chartPath.startsWith('oci://') || chartPath.startsWith('http://') || chartPath.startsWith('https://')) {
      return chartPath;
    }

    // 允许 Helm repo 引用 (e.g., stable/nginx)
    if (!chartPath.includes('/') && !chartPath.startsWith('.')) {
      return chartPath;
    }

    // 本地路径：禁止绝对路径和路径遍历
    if (chartPath.startsWith('/') || chartPath.startsWith('..')) {
      return null;
    }

    const resolved = path.resolve(chartPath);
    const cwd = process.cwd();
    if (!resolved.startsWith(cwd)) {
      return null;
    }

    return chartPath;
  }

  /**
   * 执行 helm 命令
   */
  private runHelm(
    args: string[],
    timeoutMs: number = 600000 // 10 minutes default
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn('helm', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`helm timed out after ${timeoutMs}ms: ${args.join(' ')}`));
      }, timeoutMs);

      child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`helm failed (exit ${code}): ${stderr}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
