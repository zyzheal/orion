/**
 * DockerBuildService — Docker 构建/推送/扫描编排服务
 *
 * 基于 child_process.spawn 实现流式日志输出，
 * 支持 docker build/buildx build/push/scan 等操作。
 */

import { spawn, ChildProcess } from 'child_process';
import { createLogger } from '../../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('docker-build-service');

export interface DockerBuildOptions {
  context?: string;
  dockerfile?: string;
  imageName: string;
  tag?: string;
  platforms?: string[];
  buildArgs?: Record<string, string>;
  labels?: Record<string, string>;
  cacheFrom?: string;
  cacheTo?: string;
  noCache?: boolean;
  pull?: boolean;
  push?: boolean;
  load?: boolean;
  progress?: 'auto' | 'plain' | 'tty';
  target?: string;
  additionalTags?: string[];
}

export interface DockerBuildResult {
  success: boolean;
  imageId?: string;
  imageTag: string;
  durationMs: number;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface DockerPushOptions {
  imageName: string;
  tag: string;
  additionalTags?: string[];
}

export interface DockerPushResult {
  success: boolean;
  imageTag: string;
  pushedTags: string[];
  durationMs: number;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface DockerScanOptions {
  imageName: string;
  tag: string;
  scanner?: 'trivy' | 'docker-scout' | 'grype';
  severityThreshold?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  ignoreUnfixed?: boolean;
}

export interface DockerScanResult {
  success: boolean;
  scanner: string;
  vulnerabilities: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  blocked: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/**
 * Spawn-based command execution with streaming log collection.
 */
async function spawnWithLog(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeoutMs?: number;
    env?: Record<string, string>;
  } = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const timeout = options.timeoutMs || 30 * 60 * 1000;
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...(options.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn ${command}: ${err.message}`));
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

export class DockerBuildService {
  /**
   * 执行 Docker 构建
   */
  async build(options: DockerBuildOptions): Promise<DockerBuildResult> {
    const startTime = Date.now();
    const tag = options.tag || 'latest';
    const fullImage = `${options.imageName}:${tag}`;

    try {
      // 检查 docker 是否可用
      const dockerAvailable = await this.isDockerAvailable();
      if (!dockerAvailable) {
        return {
          success: false,
          imageTag: fullImage,
          durationMs: Date.now() - startTime,
          stdout: '',
          stderr: '',
          error: 'Docker is not available on this system',
        };
      }

      const command = this.buildCommand(options);
      const cwd = options.context || process.cwd();

      logger.info({ command, cwd }, 'Starting Docker build');

      const result = await spawnWithLog('docker', command, { cwd });

      if (result.exitCode !== 0) {
        return {
          success: false,
          imageTag: fullImage,
          durationMs: Date.now() - startTime,
          stdout: result.stdout,
          stderr: result.stderr,
          error: `Docker build failed with exit code ${result.exitCode}`,
        };
      }

      const imageId = this.parseImageId(result.stdout);

      logger.info({ imageId, tag: fullImage }, 'Docker build completed');

      return {
        success: true,
        imageId,
        imageTag: fullImage,
        durationMs: Date.now() - startTime,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ traceId: getCurrentTraceId(), error: errorMessage }, 'Docker build error');

      return {
        success: false,
        imageTag: fullImage,
        durationMs: Date.now() - startTime,
        stdout: '',
        stderr: '',
        error: errorMessage,
      };
    }
  }

  /**
   * 推送 Docker 镜像
   */
  async push(options: DockerPushOptions): Promise<DockerPushResult> {
    const startTime = Date.now();
    const pushedTags: string[] = [];

    try {
      const allTags = [options.tag, ...(options.additionalTags || [])];

      for (const tag of allTags) {
        const fullImage = `${options.imageName}:${tag}`;
        const result = await spawnWithLog('docker', ['push', fullImage], {
          timeoutMs: 20 * 60 * 1000,
        });

        if (result.exitCode !== 0) {
          return {
            success: false,
            imageTag: `${options.imageName}:${options.tag}`,
            pushedTags,
            durationMs: Date.now() - startTime,
            stdout: result.stdout,
            stderr: result.stderr,
            error: `Push failed for tag ${tag}: exit code ${result.exitCode}`,
          };
        }

        pushedTags.push(tag);
      }

      logger.info({ image: options.imageName, tags: pushedTags }, 'Docker push completed');

      return {
        success: true,
        imageTag: `${options.imageName}:${options.tag}`,
        pushedTags,
        durationMs: Date.now() - startTime,
        stdout: `Pushed tags: ${pushedTags.join(', ')}`,
        stderr: '',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ traceId: getCurrentTraceId(), error: errorMessage }, 'Docker push error');

      return {
        success: false,
        imageTag: `${options.imageName}:${options.tag}`,
        pushedTags,
        durationMs: Date.now() - startTime,
        stdout: '',
        stderr: '',
        error: errorMessage,
      };
    }
  }

  /**
   * 扫描 Docker 镜像漏洞
   */
  async scan(options: DockerScanOptions): Promise<DockerScanResult> {
    const startTime = Date.now();
    const scanner = options.scanner || 'trivy';
    const fullImage = `${options.imageName}:${options.tag}`;

    try {
      // 检查扫描器是否可用
      const scannerAvailable = await this.isCommandAvailable(scanner);
      if (!scannerAvailable) {
        return {
          success: false,
          scanner,
          vulnerabilities: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
          blocked: false,
          stdout: '',
          stderr: `Scanner '${scanner}' is not available`,
          durationMs: Date.now() - startTime,
        };
      }

      let command: string[];
      switch (scanner) {
        case 'trivy':
          command = ['image', '--no-progress', '--exit-code', '0'];
          if (options.severityThreshold) {
            command.push('--severity', options.severityThreshold);
          }
          if (options.ignoreUnfixed) {
            command.push('--ignore-unfixed');
          }
          command.push('--format', 'json');
          command.push(fullImage);
          break;
        case 'docker-scout':
          command = ['scout', 'cves', fullImage];
          break;
        case 'grype':
          command = [fullImage, '-o', 'json'];
          break;
        default:
          command = [fullImage];
      }

      const result = await spawnWithLog(scanner, command, {
        timeoutMs: 15 * 60 * 1000,
      });

      const vulns = this.parseVulnerabilities(result.stdout, scanner);

      const blocked = this.isScanBlocked(vulns, options.severityThreshold || 'HIGH');

      return {
        success: !blocked,
        scanner,
        vulnerabilities: vulns,
        blocked,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ traceId: getCurrentTraceId(), error: errorMessage }, 'Docker scan error');

      return {
        success: false,
        scanner,
        vulnerabilities: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
        blocked: false,
        stdout: '',
        stderr: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 检查 Docker 是否可用
   */
  async isDockerAvailable(): Promise<boolean> {
    try {
      const result = await spawnWithLog('docker', ['info'], { timeoutMs: 5000 });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * 构建 docker 命令参数
   */
  private buildCommand(options: DockerBuildOptions): string[] {
    const args: string[] = ['build'];
    const tag = options.tag || 'latest';

    // 平台
    if (options.platforms && options.platforms.length > 0) {
      args.push('--platform', options.platforms.join(','));
    }

    // 标签
    args.push('-t', `${options.imageName}:${tag}`);
    for (const addTag of options.additionalTags || []) {
      args.push('-t', `${options.imageName}:${addTag}`);
    }

    // Dockerfile
    if (options.dockerfile) {
      args.push('-f', options.dockerfile);
    }

    // 构建参数
    if (options.buildArgs) {
      for (const [key, value] of Object.entries(options.buildArgs)) {
        args.push('--build-arg', `${key}=${value}`);
      }
    }

    // 标签
    if (options.labels) {
      for (const [key, value] of Object.entries(options.labels)) {
        args.push('--label', `${key}=${value}`);
      }
    }

    // 缓存
    if (options.cacheFrom) {
      args.push('--cache-from', options.cacheFrom);
    }
    if (options.cacheTo) {
      args.push('--cache-to', options.cacheTo);
    }

    // 其他选项
    if (options.noCache) args.push('--no-cache');
    if (options.pull) args.push('--pull');
    if (options.push) args.push('--push');
    if (options.load) args.push('--load');
    if (options.progress) args.push('--progress', options.progress);
    if (options.target) args.push('--target', options.target);

    // 上下文
    args.push(options.context || '.');

    return args;
  }

  /**
   * 从输出中解析镜像 ID
   */
  private parseImageId(stdout: string): string | undefined {
    const match = stdout.match(/sha256:([a-f0-9]{64})/);
    return match ? `sha256:${match[1]}` : undefined;
  }

  /**
   * 检查命令是否可用
   */
  private async isCommandAvailable(cmd: string): Promise<boolean> {
    try {
      const result = await spawnWithLog('which', [cmd], { timeoutMs: 5000 });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * 解析漏洞统计
   */
  private parseVulnerabilities(stdout: string, scanner: string): DockerScanResult['vulnerabilities'] {
    try {
      if (scanner === 'trivy' && stdout) {
        const json = JSON.parse(stdout);
        let critical = 0;
        let high = 0;
        let medium = 0;
        let low = 0;

        const results = json.Results || [];
        for (const result of results) {
          const vulns = result.Vulnerabilities || [];
          for (const v of vulns) {
            switch (v.Severity) {
              case 'CRITICAL': critical++; break;
              case 'HIGH': high++; break;
              case 'MEDIUM': medium++; break;
              case 'LOW': low++; break;
            }
          }
        }

        return {
          total: critical + high + medium + low,
          critical,
          high,
          medium,
          low,
        };
      }
    } catch {
      // 无法解析 JSON，返回默认值
    }

    return { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
  }

  /**
   * 判断是否应该阻断构建
   */
  private isScanBlocked(
    vulns: DockerScanResult['vulnerabilities'],
    threshold: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  ): boolean {
    switch (threshold) {
      case 'CRITICAL': return vulns.critical > 0;
      case 'HIGH': return vulns.critical > 0 || vulns.high > 0;
      case 'MEDIUM': return vulns.critical > 0 || vulns.high > 0 || vulns.medium > 0;
      case 'LOW': return vulns.total > 0;
      default: return false;
    }
  }
}
