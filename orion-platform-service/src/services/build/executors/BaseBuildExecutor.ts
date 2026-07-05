/**
 * Base Build Executor Interface
 *
 * Defines the contract for build executors across different platforms and build types.
 * Supports mobile (Android, iOS, Harmony), desktop (Windows, macOS, Linux), and
 * traditional languages (Node, Python, Go, Java, .NET, Rust, C++).
 */

export enum Platform {
  LINUX = 'linux',
  WINDOWS = 'windows',
  MACOS = 'macos',
}

export enum BuildType {
  // Existing
  NODE = 'node',
  PYTHON = 'python',
  GO = 'go',
  JAVA = 'java',
  DOTNET = 'dotnet',
  RUST = 'rust',
  // Mobile
  ANDROID = 'android',
  IOS = 'ios',
  HARMONY = 'harmony',
  // Desktop
  DESKTOP_WINDOWS = 'desktop-windows',
  DESKTOP_MACOS = 'desktop-macos',
  DESKTOP_LINUX = 'desktop-linux',
  // C++
  CPP_LINUX = 'cpp-linux',
  CPP_WINDOWS = 'cpp-windows',
  CPP_MACOS = 'cpp-macos',
}

export interface BuildConfig {
  type: BuildType;
  platform: Platform;
  sourceUrl: string;
  buildScript?: string;
  envVars?: Record<string, string>;
}

export interface BuildContext {
  runId: string;
  config: BuildConfig;
  workspace: string;
  artifacts: string[];
}

export interface BuildResult {
  status: 'success' | 'failed' | 'cancelled';
  artifacts: string[];
  log?: string;
  error?: string;
}

/**
 * Build Executor Interface
 *
 * Implement this interface to create a custom build executor for a specific build type.
 */
export interface BuildExecutor {
  /** Unique build type identifier */
  readonly type: BuildType;
  /** List of supported platforms */
  readonly platforms: Platform[];

  /**
   * Check if the build environment is properly configured
   * @param config Build configuration
   * @returns true if environment is ready, false otherwise
   */
  checkEnvironment(config: BuildConfig): Promise<boolean>;

  /**
   * Execute the build process
   * @param context Build context including run ID, config, workspace, and artifacts
   * @returns Build result with status, artifacts, logs, and optional error
   */
  execute(context: BuildContext): Promise<BuildResult>;

  /**
   * Cancel a running build
   * @param runId The run ID to cancel
   */
  cancel(runId: string): Promise<void>;
}