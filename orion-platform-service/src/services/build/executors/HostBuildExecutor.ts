/**
 * Host Build Executor
 *
 * Implements BuildExecutor for non-Kubernetes environments.
 * Supports C++, Android, and Linux/macOS/Windows desktop applications.
 */

import {
  BuildExecutor,
  BuildType,
  Platform,
  BuildConfig,
  BuildContext,
  BuildResult,
} from './BaseBuildExecutor';

/**
 * Host Build Executor
 * Used for builds outside of Kubernetes, such as C++, Android, Linux desktop applications
 */
export class HostBuildExecutor implements BuildExecutor {
  constructor(readonly type: BuildType = BuildType.CPP_LINUX) {}

  get platforms(): Platform[] {
    switch (this.type) {
      case BuildType.CPP_LINUX:
      case BuildType.ANDROID:
      case BuildType.DESKTOP_LINUX:
        return [Platform.LINUX];
      case BuildType.CPP_WINDOWS:
      case BuildType.DESKTOP_WINDOWS:
        return [Platform.WINDOWS];
      case BuildType.CPP_MACOS:
      case BuildType.DESKTOP_MACOS:
        return [Platform.MACOS];
      default:
        return [Platform.LINUX];
    }
  }

  async checkEnvironment(config: BuildConfig): Promise<boolean> {
    const tools = this.getRequiredTools();
    for (const tool of tools) {
      try {
        const { execSync } = require('child_process');
        execSync(`which ${tool}`, { stdio: 'ignore' });
      } catch {
        return false;
      }
    }
    return true;
  }

  async execute(context: BuildContext): Promise<BuildResult> {
    const { execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');

    try {
      const workspace = context.workspace;
      if (!fs.existsSync(workspace)) {
        fs.mkdirSync(workspace, { recursive: true });
      }

      const env = {
        ...process.env,
        ...context.config.envVars,
        BUILD_WORKSPACE: workspace,
      };

      let buildLog = '';
      if (context.config.buildScript) {
        try {
          buildLog = execSync(context.config.buildScript, {
            cwd: workspace,
            env,
            encoding: 'utf-8',
          });
        } catch (error: any) {
          buildLog = (error.stdout || '') + '\n' + (error.stderr || '');
          return {
            status: 'failed',
            artifacts: [],
            log: buildLog,
            error: error.message,
          };
        }
      }

      const artifacts = this.collectArtifacts(workspace);

      return {
        status: 'success',
        artifacts,
        log: buildLog,
      };
    } catch (error: any) {
      return {
        status: 'failed',
        artifacts: [],
        error: error.message,
      };
    }
  }

  async cancel(runId: string): Promise<void> {
    // In production environment, implement process termination logic
    // For now, this is a placeholder
  }

  private getRequiredTools(): string[] {
    switch (this.type) {
      case BuildType.CPP_LINUX:
      case BuildType.CPP_MACOS:
        return ['g++', 'make', 'cmake'];
      case BuildType.CPP_WINDOWS:
        return ['cmake'];
      case BuildType.ANDROID:
        return ['gradle', 'java'];
      case BuildType.DESKTOP_LINUX:
        return ['gcc', 'make'];
      default:
        return [];
    }
  }

  private collectArtifacts(workspace: string): string[] {
    const fs = require('fs');
    const path = require('path');
    const artifacts: string[] = [];

    if (fs.existsSync(workspace)) {
      const files = fs.readdirSync(workspace);
      for (const file of files) {
        const filePath = path.join(workspace, file);
        const stat = fs.statSync(filePath);
        // Collect executable files as artifacts
        if (stat.isFile() && (stat.mode & 0o111) !== 0) {
          artifacts.push(filePath);
        }
      }
    }

    return artifacts;
  }
}