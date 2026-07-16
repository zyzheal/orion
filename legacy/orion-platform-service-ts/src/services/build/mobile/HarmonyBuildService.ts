/**
 * HarmonyOS Build Service
 *
 * Provides build configuration generation for HarmonyOS (OpenHarmony) projects.
 * Supports debug/release builds, module selection, and signing modes.
 */

import { BuildConfig, BuildType, Platform } from '../executors/BaseBuildExecutor';

export interface HarmonyBuildOptions {
  projectPath: string;
  buildType: 'debug' | 'release';
  module?: string;
  signMode?: 'remote' | 'local';
}

export class HarmonyBuildService {
  /**
   * Create build configuration for HarmonyOS project
   */
  createBuildConfig(options: HarmonyBuildOptions): BuildConfig {
    const buildScript = this.generateBuildScript(options);

    return {
      type: BuildType.HARMONY,
      platform: Platform.LINUX,
      sourceUrl: options.projectPath,
      buildScript,
      envVars: {
        HARMONY_SDK: process.env.HARMONY_SDK || '/opt/harmony-sdk',
        JAVA_HOME: process.env.JAVA_HOME || '/opt/java/openjdk',
        NODE_HOME: process.env.NODE_HOME || '/opt/node',
      },
    };
  }

  /**
   * Generate build script based on options
   */
  private generateBuildScript(options: HarmonyBuildOptions): string {
    const task = options.buildType === 'release' ? 'assembleApp' : 'assembleDebug';
    let script = `cd ${options.projectPath} && ./hvigorw ${task}`;
    if (options.module) script += ` -p module=${options.module}`;
    return script;
  }

  /**
   * Get output paths for built artifacts
   */
  getOutputPaths(projectPath: string): string[] {
    return [
      `${projectPath}/build/outputs/hap/debug/`,
      `${projectPath}/build/outputs/hap/release/`,
    ];
  }
}