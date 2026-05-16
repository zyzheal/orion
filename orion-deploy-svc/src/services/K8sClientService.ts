import { spawn } from 'child_process';
import pino from 'pino';

const logger = pino({ name: 'k8s-client' });

/**
 * K8sClientService - Wraps kubectl CLI for Kubernetes operations.
 *
 * Provides apply, rollout status/undo, and deployment listing
 * via kubectl subprocess invocations.
 */
export class K8sClientService {
  private kubeconfig: string;
  private defaultNamespace: string;

  constructor(options?: { kubeconfig?: string; defaultNamespace?: string }) {
    this.kubeconfig = options?.kubeconfig || process.env.KUBECONFIG || '';
    this.defaultNamespace = options?.defaultNamespace || 'default';
  }

  /**
   * Apply a Kubernetes manifest (YAML/JSON string) via `kubectl apply -f -`.
   */
  async apply(manifest: string): Promise<{ success: boolean; output: string }> {
    try {
      const result = await this.runKubectl(['apply', '-f', '-'], manifest);
      logger.info({ output: result.stdout }, 'kubectl apply succeeded');
      return { success: true, output: result.stdout };
    } catch (error: any) {
      logger.error({ error: error.message }, 'kubectl apply failed');
      return { success: false, output: error.message };
    }
  }

  /**
   * Wait for a deployment rollout to complete (up to 300s).
   */
  async rolloutStatus(deployment: string, namespace?: string): Promise<boolean> {
    try {
      await this.runKubectl([
        'rollout',
        'status',
        `deployment/${deployment}`,
        '-n',
        namespace || this.defaultNamespace,
        '--timeout=300s',
      ]);
      logger.info({ deployment }, 'rollout status succeeded');
      return true;
    } catch (error: any) {
      logger.error({ deployment, error: error.message }, 'rollout status failed');
      return false;
    }
  }

  /**
   * Undo (rollback) the last deployment rollout.
   */
  async rolloutUndo(deployment: string, namespace?: string): Promise<void> {
    await this.runKubectl([
      'rollout',
      'undo',
      `deployment/${deployment}`,
      '-n',
      namespace || this.defaultNamespace,
    ]);
    logger.info({ deployment }, 'rollout undo succeeded');
  }

  /**
   * List all deployments in a namespace, returning raw item objects.
   */
  async getDeployments(namespace?: string): Promise<any[]> {
    const result = await this.runKubectl([
      'get',
      'deployments',
      '-n',
      namespace || this.defaultNamespace,
      '-o',
      'json',
    ]);
    const parsed = JSON.parse(result.stdout);
    return parsed.items || [];
  }

  /**
   * Get a single deployment by name in a namespace.
   */
  async getDeployment(name: string, namespace?: string): Promise<any | null> {
    try {
      const result = await this.runKubectl([
        'get',
        'deployment',
        name,
        '-n',
        namespace || this.defaultNamespace,
        '-o',
        'json',
      ]);
      return JSON.parse(result.stdout);
    } catch {
      return null;
    }
  }

  /**
   * Execute a kubectl command and return stdout/stderr.
   */
  private runKubectl(
    args: string[],
    stdin?: string,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      if (this.kubeconfig) {
        env.KUBECONFIG = this.kubeconfig;
      }

      logger.debug({ args }, 'running kubectl');

      const child = spawn('kubectl', args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      if (stdin) {
        child.stdin?.write(stdin);
        child.stdin?.end();
      }

      child.stdout?.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`kubectl failed (exit ${code}): ${stderr}`));
        }
      });
      child.on('error', reject);
    });
  }
}
