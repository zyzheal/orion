/**
 * Desktop Build Service
 *
 * Provides build configuration generation for desktop applications.
 * Supports Windows, macOS, and Linux platforms with Electron, CMake, Qt, and GTK build tools.
 */

import { BuildConfig, BuildType, Platform } from '../executors/BaseBuildExecutor';

export type DesktopPlatform = 'windows' | 'macos' | 'linux';
export type BuildTool = 'electron' | 'cmake' | 'qt' | 'gtk';

export interface DesktopBuildOptions {
  platform: DesktopPlatform;
  projectPath: string;
  buildTool: BuildTool;
  electronVersion?: string;
  appId?: string;
  outputFormat?: string;
}

export class DesktopBuildService {
  /**
   * Create build configuration for desktop application
   */
  createBuildConfig(options: DesktopBuildOptions): BuildConfig {
    const buildType = this.getBuildType(options.platform);
    const buildScript = this.generateBuildScript(options);

    return {
      type: buildType,
      platform: this.getPlatform(options.platform),
      sourceUrl: options.projectPath,
      buildScript,
      envVars: this.getEnvVars(options),
    };
  }

  /**
   * Get build type for platform
   */
  private getBuildType(platform: DesktopPlatform): BuildType {
    switch (platform) {
      case 'windows':
        return BuildType.DESKTOP_WINDOWS;
      case 'macos':
        return BuildType.DESKTOP_MACOS;
      case 'linux':
        return BuildType.DESKTOP_LINUX;
    }
  }

  /**
   * Map desktop platform to generic platform
   */
  private getPlatform(platform: DesktopPlatform): Platform {
    switch (platform) {
      case 'windows':
        return Platform.WINDOWS;
      case 'macos':
        return Platform.MACOS;
      case 'linux':
        return Platform.LINUX;
    }
  }

  /**
   * Generate build script based on build tool
   */
  private generateBuildScript(options: DesktopBuildOptions): string {
    const { platform, projectPath, buildTool } = options;

    switch (buildTool) {
      case 'electron':
        const target = platform === 'macos' ? 'mac' : platform === 'windows' ? 'win' : 'linux';
        return `cd ${projectPath} && npm run build:${target}`;
      case 'cmake':
        return [
          `cd ${projectPath}`,
          'mkdir -p build',
          'cd build',
          'cmake ..',
          'make',
        ].join(' && ');
      case 'qt':
        return [
          `cd ${projectPath}`,
          'mkdir -p build',
          'cd build',
          'cmake -G "Unix Makefiles" ..',
          'make',
        ].join(' && ');
      case 'gtk':
        return [
          `cd ${projectPath}`,
          './autogen.sh',
          './configure',
          'make',
        ].join(' && ');
      default:
        return `cd ${projectPath} && make`;
    }
  }

  /**
   * Get environment variables for build
   */
  private getEnvVars(options: DesktopBuildOptions): Record<string, string> {
    const base: Record<string, string> = {};

    if (options.electronVersion) {
      base.ELECTRON_VERSION = options.electronVersion;
    }

    if (options.appId) {
      base.APP_ID = options.appId;
    }

    return base;
  }

  /**
   * Get output paths for built artifacts
   */
  getOutputPaths(platform: DesktopPlatform, buildTool: BuildTool): string[] {
    const base = 'dist';

    switch (buildTool) {
      case 'electron':
        return [`${base}/${platform}/*`];
      case 'cmake':
        return [`${base}/bin/*`];
      case 'qt':
        return [`${base}/*.exe`, `${base}/*.app`];
      case 'gtk':
        return [`${base}/*`];
      default:
        return [`${base}/*`];
    }
  }
}