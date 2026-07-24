/**
 * C++ Build Service
 *
 * Provides build configuration generation for C++ projects.
 * Supports Linux, Windows, and macOS platforms with CMake, Make, and Meson build systems.
 */

import { BuildConfig, BuildType, Platform } from '../executors/BaseBuildExecutor';

export type CppPlatform = 'linux' | 'windows' | 'macos';
export type CppCompiler = 'gcc' | 'clang' | 'msvc';
export type BuildSystem = 'cmake' | 'make' | 'meson';

export interface CppBuildOptions {
  platform: CppPlatform;
  projectPath: string;
  buildSystem: BuildSystem;
  compiler: CppCompiler;
  cmakeOptions?: Record<string, string>;
  outputType?: 'executable' | 'shared' | 'static';
}

export class CppBuildService {
  /**
   * Create build configuration for C++ project
   */
  createBuildConfig(options: CppBuildOptions): BuildConfig {
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
  private getBuildType(platform: CppPlatform): BuildType {
    switch (platform) {
      case 'linux':
        return BuildType.CPP_LINUX;
      case 'windows':
        return BuildType.CPP_WINDOWS;
      case 'macos':
        return BuildType.CPP_MACOS;
    }
  }

  /**
   * Map C++ platform to generic platform
   */
  private getPlatform(platform: CppPlatform): Platform {
    switch (platform) {
      case 'linux':
        return Platform.LINUX;
      case 'windows':
        return Platform.WINDOWS;
      case 'macos':
        return Platform.MACOS;
    }
  }

  /**
   * Generate build script based on build system
   */
  private generateBuildScript(options: CppBuildOptions): string {
    const { platform, projectPath, buildSystem, cmakeOptions } = options;

    switch (buildSystem) {
      case 'cmake':
        const cmakeArgs = cmakeOptions
          ? Object.entries(cmakeOptions).map(([k, v]) => `-D${k}=${v}`).join(' ')
          : '';
        return [
          `mkdir -p ${projectPath}/build`,
          `cd ${projectPath}/build`,
          `cmake .. ${cmakeArgs}`,
          platform === 'windows' ? 'cmake --build . --config Release' : 'make',
        ].join(' && ');
      case 'make':
        return `cd ${projectPath} && make -j$(nproc)`;
      case 'meson':
        return [
          `cd ${projectPath}`,
          'meson setup build',
          'meson compile -C build',
        ].join(' && ');
      default:
        return `cd ${projectPath} && make`;
    }
  }

  /**
   * Get environment variables for build
   */
  private getEnvVars(options: CppBuildOptions): Record<string, string> {
    const env: Record<string, string> = {};

    if (options.compiler === 'gcc') {
      env.CC = 'gcc';
      env.CXX = 'g++';
    } else if (options.compiler === 'clang') {
      env.CC = 'clang';
      env.CXX = 'clang++';
    }
    // MSVC doesn't need CC/CXX env vars as it's selected via CMake generator

    return env;
  }

  /**
   * Get output paths for built artifacts
   */
  getOutputPaths(projectPath: string, outputType?: string): string[] {
    const baseDir = `${projectPath}/build`;

    switch (outputType) {
      case 'shared':
        return [
          `${baseDir}/lib/*.so`,
          `${baseDir}/lib/*.dylib`,
          `${baseDir}/lib/*.dll`,
        ];
      case 'static':
        return [
          `${baseDir}/lib/*.a`,
          `${baseDir}/lib/*.lib`,
        ];
      default:
        return [`${baseDir}/bin/*`];
    }
  }
}