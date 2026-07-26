/**
 * KubernetesDeploymentService - K8s 部署集成 (Task 2.1)
 *
 * 职责：
 * - 部署/更新 Kubernetes Deployment
 * - 回滚 Deployment
 * - 健康检查 (等待 Pod 就绪)
 * - 支持金丝雀、蓝绿、滚动发布
 */

import { spawn } from 'child_process';
import pino from 'pino';

const logger = pino({ name: 'k8s-deployment-service' });

export interface K8sDeploymentConfig {
  namespace: string;
  deploymentName: string;
  imageName: string;
  tag: string;
  replicas?: number;
  resourceLimits?: {
    cpu?: string;
    memory?: string;
  };
  envVars?: Record<string, string>;
}

/** 禁止操作的系统命名空间 */
const BLOCKED_NAMESPACES = ['kube-system', 'kube-public', 'kube-node-lease', 'istio-system'];

export interface K8sCanaryConfig {
  canaryDeployment: string;
  stableDeployment: string;
  canaryWeight: number; // 0-100
  namespace: string;
}

export interface K8sDeployResult {
  success: boolean;
  message: string;
  rolloutStatus?: string;
}

export class KubernetesDeploymentService {
  private kubeconfig: string;
  private defaultNamespace: string;

  constructor(options?: { kubeconfig?: string; defaultNamespace?: string }) {
    this.kubeconfig = options?.kubeconfig || process.env.KUBECONFIG || '';
    this.defaultNamespace = options?.defaultNamespace || 'default';
  }

  /**
   * 部署/更新 Deployment
   */
  async deploy(config: K8sDeploymentConfig): Promise<K8sDeployResult> {
    // 验证命名空间
    const ns = config.namespace || this.defaultNamespace;
    if (BLOCKED_NAMESPACES.includes(ns.toLowerCase())) {
      return {
        success: false,
        message: `Deployment to system namespace '${ns}' is not allowed`,
      };
    }

    // 验证 deploymentName 格式（只能包含字母数字和连字符）
    if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(config.deploymentName)) {
      return {
        success: false,
        message: `Invalid deployment name: ${config.deploymentName}. Must match pattern: [a-z0-9]([-a-z0-9]*[a-z0-9])?`,
      };
    }

    try {
      // 1. 更新镜像
      await this.runKubectl([
        'set', 'image',
        `deployment/${config.deploymentName}`,
        `${config.deploymentName}=${config.imageName}:${config.tag}`,
        '-n', config.namespace || this.defaultNamespace,
      ]);

      // 2. 更新资源限制 (如有)
      if (config.resourceLimits) {
        const limits: string[] = [];
        if (config.resourceLimits.cpu) limits.push(`cpu=${config.resourceLimits.cpu}`);
        if (config.resourceLimits.memory) limits.push(`memory=${config.resourceLimits.memory}`);
        if (limits.length > 0) {
          await this.runKubectl([
            'set', 'resources',
            `deployment/${config.deploymentName}`,
            `--limits=${limits.join(',')}`,
            '-n', config.namespace || this.defaultNamespace,
          ]);
        }
      }

      // 3. 更新环境变量 (如有)
      if (config.envVars) {
        // 验证环境变量名称，防止注入和覆盖敏感变量
        const sensitiveNames = [
          'DATABASE_URL', 'DB_PASSWORD', 'AWS_SECRET_ACCESS_KEY',
          'AWS_ACCESS_KEY_ID', 'AZURE_CLIENT_SECRET', 'GCP_KEY',
          'SERVICE_ACCOUNT', 'KUBECONFIG', 'TOKEN',
        ];
        const envArgs: string[] = [];
        for (const [k, v] of Object.entries(config.envVars)) {
          // 拒绝敏感变量名
          if (sensitiveNames.some(sn => k.toUpperCase().includes(sn))) {
            logger.warn({ key: k }, 'Blocked sensitive environment variable');
            continue;
          }
          // 拒绝以 - 开头的值 (kubectl set env 用 - 表示删除)
          if (String(v).startsWith('-')) {
            logger.warn({ key: k, value: v }, 'Blocked env value starting with -');
            continue;
          }
          envArgs.push(`${k}=${v}`);
        }
        if (envArgs.length > 0) {
          await this.runKubectl([
            'set', 'env',
            `deployment/${config.deploymentName}`,
            ...envArgs,
            '-n', config.namespace || this.defaultNamespace,
          ]);
        }
      }

      // 4. 等待 rollout 完成
      const result = await this.runKubectl([
        'rollout', 'status',
        `deployment/${config.deploymentName}`,
        '-n', config.namespace || this.defaultNamespace,
        '--timeout=300s',
      ]);

      return {
        success: true,
        message: `Deployment ${config.deploymentName} updated to ${config.imageName}:${config.tag}`,
        rolloutStatus: result.stdout,
      };
    } catch (error: any) {
      logger.error({ error, config }, 'K8s deployment failed');
      return {
        success: false,
        message: error.message || 'K8s deployment failed',
      };
    }
  }

  /**
   * 金丝雀发布 - 更新 Pod 权重
   */
  async canaryDeploy(config: K8sCanaryConfig): Promise<K8sDeployResult> {
    try {
      // 通过 Service/Ingress 权重控制实现金丝雀
      // 这里使用 istio 注解方式 (简化实现)
      const annotation = `${config.canaryWeight}`;

      await this.runKubectl([
        'annotate',
        `deployment/${config.canaryDeployment}`,
        `traffic.istio.io/weight=${annotation}`,
        '--overwrite',
        '-n', config.namespace,
      ]);

      return {
        success: true,
        message: `Canary weight set to ${config.canaryWeight}%`,
      };
    } catch (error: any) {
      logger.error({ error, config }, 'Canary deployment failed');
      return {
        success: false,
        message: error.message || 'Canary deployment failed',
      };
    }
  }

  /**
   * 蓝绿发布 - 切换 Service selector
   */
  async blueGreenDeploy(
    serviceName: string,
    newDeploymentName: string,
    labelKey: string,
    labelValue: string,
    namespace: string
  ): Promise<K8sDeployResult> {
    try {
      // 更新 Service selector 指向新的 deployment
      await this.runKubectl([
        'patch', 'service', serviceName,
        '-n', namespace,
        '-p', JSON.stringify({
          spec: {
            selector: {
              [labelKey]: labelValue,
            },
          },
        }),
      ]);

      return {
        success: true,
        message: `Service ${serviceName} switched to ${newDeploymentName}`,
      };
    } catch (error: any) {
      logger.error({ error }, 'Blue-green deployment failed');
      return {
        success: false,
        message: error.message || 'Blue-green deployment failed',
      };
    }
  }

  /**
   * 回滚 Deployment
   */
  async rollback(config: K8sDeploymentConfig): Promise<K8sDeployResult> {
    try {
      await this.runKubectl([
        'rollout', 'undo',
        `deployment/${config.deploymentName}`,
        '-n', config.namespace || this.defaultNamespace,
      ]);

      return {
        success: true,
        message: `Deployment ${config.deploymentName} rolled back`,
      };
    } catch (error: any) {
      logger.error({ error }, 'K8s rollback failed');
      return {
        success: false,
        message: error.message || 'K8s rollback failed',
      };
    }
  }

  /**
   * 健康检查 - 检查 Pod 就绪数量
   */
  async healthCheck(config: K8sDeploymentConfig): Promise<boolean> {
    try {
      const result = await this.runKubectl([
        'get', 'deployment', config.deploymentName,
        '-n', config.namespace || this.defaultNamespace,
        '-o', 'jsonpath={.status.readyReplicas}',
      ]);

      const readyReplicas = parseInt(result.stdout.trim(), 10);
      const replicas = config.replicas || 1;

      return readyReplicas >= replicas;
    } catch {
      return false;
    }
  }

  /**
   * 获取部署状态
   */
  async getStatus(deploymentName: string, namespace?: string): Promise<any> {
    const result = await this.runKubectl([
      'get', 'deployment', deploymentName,
      '-n', namespace || this.defaultNamespace,
      '-o', 'json',
    ]);
    return JSON.parse(result.stdout);
  }

  /**
   * 执行 kubectl 命令
   */
  private runKubectl(
    args: string[],
    timeoutMs: number = 300000 // 5 minutes default
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      if (this.kubeconfig) {
        env.KUBECONFIG = this.kubeconfig;
      }

      const child = spawn('kubectl', args, {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`kubectl timed out after ${timeoutMs}ms: ${args.join(' ')}`));
      }, timeoutMs);

      child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`kubectl failed (exit ${code}): ${stderr}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
