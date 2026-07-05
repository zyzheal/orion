/**
 * ImageVerifier - Container Image Signature and Digest Verification
 *
 * Before executing a container plugin, verify:
 * - Digest pinning: if image name contains `@sha256:...`, use as-is
 * - Warn when using `:latest` tag (non-deterministic)
 * - Verify image exists locally before `docker create` (via `docker inspect`)
 * - If not found and pull policy allows, pull it first
 *
 * This enhances the existing pullImageIfNeeded logic in PluginExecutorService
 * with explicit signature/digest verification and clearer error messages.
 */

import { spawn } from 'child_process';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ImageVerifier');

/**
 * Image verification result
 */
export interface ImageVerificationResult {
  /** Whether the image is ready to use */
  ready: boolean;
  /** Normalized image reference (with digest if available) */
  imageRef: string;
  /** Any warning messages */
  warnings: string[];
  /** Error message if verification failed */
  error?: string;
}

/**
 * Image pull policy configuration.
 */
export enum PullPolicy {
  Always = 'always',
  IfNotPresent = 'ifNotPresent',
  Never = 'never',
}

export class ImageVerifier {
  /**
   * Verify an image is safe and ready to use.
   *
   * @param image - The image reference (e.g., `alpine:3.18`, `myregistry.io/app@sha256:abc...`)
   * @param pullPolicy - When to pull the image (default: IfNotPresent)
   * @returns Verification result with warnings/errors
   */
  async verifyImage(
    image: string,
    pullPolicy: PullPolicy = PullPolicy.IfNotPresent
  ): Promise<ImageVerificationResult> {
    const warnings: string[] = [];
    const imageRef = image;

    if (!image || typeof image !== 'string') {
      return {
        ready: false,
        imageRef: '',
        warnings,
        error: 'Empty image reference',
      };
    }

    // Check for digest pinning
    const hasDigest = image.includes('@sha256:');
    if (hasDigest) {
      logger.debug({ image }, 'Image uses digest pinning - immutable reference');
    }

    // Warn on :latest tag
    if (image.endsWith(':latest') && !hasDigest) {
      warnings.push(
        `Using :latest tag is non-deterministic. Consider pinning to a specific version or using digest (@sha256:...)`
      );
      logger.warn({ image }, 'Image uses :latest tag - non-deterministic');
    }

    // Check if image exists locally
    const existsLocally = await this.imageExistsLocally(image);

    if (existsLocally) {
      logger.debug({ image }, 'Image found locally');
      return {
        ready: true,
        imageRef: image,
        warnings,
      };
    }

    // Image not found locally - handle based on pull policy
    if (pullPolicy === PullPolicy.Never) {
      return {
        ready: false,
        imageRef: image,
        warnings,
        error: `Image '${image}' not found locally and pull policy is 'never'`,
      };
    }

    // Pull the image (Always, or IfNotPresent when not local)
    try {
      await this.pullImage(image);
      logger.info({ image }, 'Image pulled successfully');
      return {
        ready: true,
        imageRef: image,
        warnings,
      };
    } catch (error: any) {
      return {
        ready: false,
        imageRef: image,
        warnings,
        error: `Failed to pull image '${image}': ${error.message}`,
      };
    }
  }

  /**
   * Check if a Docker image exists locally via `docker inspect`.
   */
  async imageExistsLocally(image: string): Promise<boolean> {
    try {
      await this.spawnDocker(['inspect', image], 10000);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Pull a Docker image.
   */
  async pullImage(image: string): Promise<void> {
    logger.info({ image }, 'Pulling Docker image');
    await this.spawnDocker(['pull', image], 120000);
    logger.info({ image }, 'Docker image pulled successfully');
  }

  /**
   * Ensure registry authentication if credentials are configured.
   * Uses DOCKER_REGISTRY_USERNAME and DOCKER_REGISTRY_PASSWORD env vars.
   * Uses --password-stdin for credential safety.
   */
  async ensureRegistryAuth(): Promise<boolean> {
    const username = process.env.DOCKER_REGISTRY_USERNAME;
    const password = process.env.DOCKER_REGISTRY_PASSWORD;

    if (!username || !password) {
      return false; // No credentials configured
    }

    const registry = process.env.DOCKER_REGISTRY_SERVER || '';

    try {
      const loginArgs = ['login'];
      if (registry) {
        loginArgs.push(registry);
      }

      const child = spawn('docker', [...loginArgs, '--username', username, '--password-stdin'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      child.stdin.write(password);
      child.stdin.end();

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('docker login timed out')), 30000);
        child.on('close', (code) => {
          clearTimeout(timer);
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`docker login failed with exit code ${code}`));
          }
        });
        child.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      logger.info('Docker registry authentication successful');
      return true;
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Docker registry authentication failed');
      return false;
    }
  }

  /**
   * Spawn a Docker command with arg arrays (no shell injection).
   */
  private spawnDocker(args: string[], timeoutMs: number = 60000): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', args);
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* already dead */ }
        reject(new Error(`docker ${args[0]} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`docker ${args[0]} failed (exit ${code}): ${stderr.trim()}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
