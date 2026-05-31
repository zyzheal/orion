/**
 * Mac Build Executor
 *
 * Implements BuildExecutor for macOS environments.
 * Supports iOS, macOS desktop applications, and HarmonyOS builds.
 */

import pino from 'pino';

const logger = pino({ name: 'LMac-LBuild-LExecutor' });
import {
  BuildExecutor,
  BuildType,
  Platform,
  BuildConfig,
  BuildContext,
  BuildResult,
} from './BaseBuildExecutor';

/**
 * macOS Build Executor
 * Used for iOS, macOS desktop applications, and HarmonyOS builds
 * Requires running on macOS environment
 */
export class MacBuildExecutor implements BuildExecutor {
  constructor(readonly type: BuildType = BuildType.IOS) {}

  get platforms(): Platform[] {
    switch (this.type) {
      case BuildType.IOS:
      case BuildType.DESKTOP_MACOS:
      case BuildType.HARMONY:
        return [Platform.MACOS];
      default:
        return [Platform.MACOS];
    }
  }

  async checkEnvironment(config: BuildConfig): Promise<boolean> {
    const requiredTools = this.getRequiredTools();
    for (const tool of requiredTools) {
      try {
        const { execSync } = require('child_process');
        // Use array form to prevent command injection
        execSync('which', [tool], { stdio: 'ignore' });
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
        // Validate buildScript to prevent command injection
        if (!this.validateBuildScript(context.config.buildScript)) {
          return {
            status: 'failed',
            artifacts: [],
            log: '',
            error: 'Invalid build script: contains forbidden characters or patterns',
          };
        }

        try {
          buildLog = execSync(context.config.buildScript, {
            cwd: workspace,
            env,
            encoding: 'utf-8',
            timeout: 3600000,
            shell: '/bin/sh',
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

      const artifacts = this.collectMacArtifacts(workspace);

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

  /**
   * Validate build script to prevent command injection
   */
  private validateBuildScript(script: string): boolean {
    // Block dangerous patterns
    const forbiddenPatterns = [
      /;\s*rm\s+-rf/i,
      /;\s*del\s+\/[fqs]/i,
      /\|\s*sh/i,
      /&\s*&\s*rm/i,
      /;\s*wget/i,
      /;\s*curl.*\|/i,
      /eval\s*\(/i,
      /exec\s*\(/i,
      /\|\s*bash/i,
      /\$\(/i,
      /`.*`/,
      /\>\s*\/dev\/null/i,
      /2>&1/,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(script)) {
        return false;
      }
    }

    const validPattern = /^[\w\-\.\/\s\&\|\>\<\=\:\+\-\'\"\(\)\[\]\$]+$/;
    return validPattern.test(script);
  }

  async cancel(runId: string): Promise<void> {
    // Log the cancellation request for now (production would implement actual process termination)
    logger.info(`[MacBuildExecutor] Cancellation requested for build: ${runId}`);
    // TODO: Implement actual process termination using PID tracking
  }

  private getRequiredTools(): string[] {
    switch (this.type) {
      case BuildType.IOS:
        return ['xcodebuild', 'xcrun'];
      case BuildType.HARMONY:
        return ['hvigor', 'java'];
      case BuildType.DESKTOP_MACOS:
        return ['xcodebuild', 'cmake'];
      default:
        return ['xcodebuild'];
    }
  }

  private collectMacArtifacts(workspace: string): string[] {
    const fs = require('fs');
    const path = require('path');
    const artifacts: string[] = [];

    if (fs.existsSync(workspace)) {
      const buildDir = path.join(workspace, 'build');
      if (fs.existsSync(buildDir)) {
        const files = fs.readdirSync(buildDir);
        for (const file of files) {
          const filePath = path.join(buildDir, file);
          const stat = fs.statSync(filePath);
          // Collect .app directories as artifacts for macOS/iOS
          if (stat.isDirectory() && file.endsWith('.app')) {
            artifacts.push(filePath);
          }
        }
      }
    }

    return artifacts;
  }
}