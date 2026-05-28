/**
 * Build Executor Registry
 *
 * Central registry for managing build executors.
 * Provides registration, retrieval, and listing capabilities.
 */

import { BuildExecutor, BuildType } from './BaseBuildExecutor';
import { OrionError } from '../../../errors';

export class BuildExecutorRegistry {
  private executors = new Map<BuildType, BuildExecutor>();

  /**
   * Register a new build executor
   * @param executor The executor to register
   * @throws Error if executor type is already registered
   */
  register(executor: BuildExecutor): void {
    if (this.executors.has(executor.type)) {
      throw new OrionError('VALIDATION_ERROR', `Executor ${executor.type} already registered`)
    }
    this.executors.set(executor.type, executor);
  }

  /**
   * Get an executor by type
   * @param type The build type to look up
   * @returns The executor if found, undefined otherwise
   */
  get(type: BuildType): BuildExecutor | undefined {
    return this.executors.get(type);
  }

  /**
   * List all registered executors
   * @returns Array of all registered executors
   */
  list(): BuildExecutor[] {
    return Array.from(this.executors.values());
  }
}

/**
 * Global singleton instance of BuildExecutorRegistry
 */
export const buildExecutorRegistry = new BuildExecutorRegistry();