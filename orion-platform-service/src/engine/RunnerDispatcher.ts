import { OrionError, ErrorCode } from '../errors';
import { RunnerProfile, RunnerProtocol, RunnerSshConfig, RunnerWinrmConfig } from '../models/RunnerProfile';
import { Task } from '../models/Task';

/**
 * RunnerDispatcher — Protocol-based task execution router
 *
 * Routes tasks to the appropriate execution protocol based on RunnerProfile.
 * Currently implements k8s (Tekton). SSH and WinRM are reserved for future phases.
 *
 * This provides the architecture foundation for NeatLogic-style
 * remote execution (Runner pushes scripts to remote servers).
 */
export class RunnerDispatcher {
  // Protocols that have a working implementation
  private implementedProtocols = new Set<RunnerProtocol>(['k8s']);

  /**
   * Get the effective protocol for a runner profile.
   */
  getProtocol(profile: RunnerProfile): RunnerProtocol {
    return profile.protocol;
  }

  /**
   * Check if a task can be executed on a given runner.
   */
  canExecute(task: Task, profile: RunnerProfile): boolean {
    if (!profile.available) return false;
    if (!this.implementedProtocols.has(profile.protocol)) return false;

    // k8s: can execute shell/script tasks
    if (profile.protocol === 'k8s') {
      return ['shell', 'script', 'container'].includes(task.type);
    }

    return false;
  }

  /**
   * Get list of protocols that have working implementations.
   */
  getSupportedProtocols(): RunnerProtocol[] {
    return Array.from(this.implementedProtocols);
  }

  /**
   * Validate SSH runner configuration (for future use).
   */
  validateSshConfig(config: RunnerSshConfig): void {
    if (!config.host) throw new OrionError('SSH host is required', ErrorCode.VALIDATION_ERROR);
    if (!config.username) throw new OrionError('SSH username is required', ErrorCode.VALIDATION_ERROR);
    if (!config.port) throw new OrionError('SSH port is required', ErrorCode.VALIDATION_ERROR);
    if (config.authType === 'key' && !config.credentialRef) {
      throw new OrionError('SSH key auth requires credentialRef', ErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Validate WinRM runner configuration (for future use).
   */
  validateWinrmConfig(config: RunnerWinrmConfig): void {
    if (!config.host) throw new OrionError('WinRM host is required', ErrorCode.VALIDATION_ERROR);
    if (!config.username) throw new OrionError('WinRM username is required', ErrorCode.VALIDATION_ERROR);
  }

  /**
   * Reserve a concurrency slot on the runner.
   * Returns true if a slot is available, false otherwise.
   */
  reserveSlot(profile: RunnerProfile, currentLoad: number): boolean {
    return currentLoad < profile.maxConcurrency;
  }
}
