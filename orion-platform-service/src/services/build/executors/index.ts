/**
 * Build Executors Module
 *
 * Provides build executor interface and registry for CI platform.
 * Supports mobile, desktop, and traditional language builds.
 */

export {
  Platform,
  BuildType,
  BuildConfig,
  BuildContext,
  BuildResult,
  BuildExecutor,
} from './BaseBuildExecutor';

export { BuildExecutorRegistry, buildExecutorRegistry } from './BuildExecutorRegistry';