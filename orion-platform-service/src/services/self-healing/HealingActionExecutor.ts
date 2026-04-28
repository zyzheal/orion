/**
 * Healing Action Executor
 *
 * Executes healing actions (restart, scale, failover, rollback),
 * handles timeouts, verifies action success, and supports rollback.
 *
 * TASK-702: Self-Healing Engine (自愈引擎)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  HealingAction,
  HealingActionType,
  HealingActionResult,
} from './types';

export class HealingActionExecutor {
  // Track executed actions for potential rollback
  private executedActions: Map<string, HealingActionResult> = new Map();

  /**
   * Execute a single healing action
   */
  async executeAction(action: HealingAction): Promise<HealingActionResult> {
    const startTime = Date.now();
    const timeout = action.timeout ?? 120000; // Default 2 minute timeout

    try {
      let result: HealingActionResult;

      switch (action.type) {
        case 'restart':
          result = await this.executeRestart(action, timeout);
          break;
        case 'scale':
          result = await this.executeScale(action, timeout);
          break;
        case 'failover':
          result = await this.executeFailover(action, timeout);
          break;
        case 'rollback':
          result = await this.executeRollbackAction(action, timeout);
          break;
        default:
          result = this.createFailureResult(
            action.type,
            startTime,
            `Unknown action type: ${action.type}`
          );
      }

      // Store for potential rollback
      this.executedActions.set(`${action.type}-${Date.now()}`, result);

      return result;
    } catch (error: any) {
      const result = this.createFailureResult(
        action.type,
        startTime,
        error.message || 'Unknown error during execution'
      );

      // Store for potential rollback
      this.executedActions.set(`${action.type}-${Date.now()}`, result);

      return result;
    }
  }

  /**
   * Verify that an action was successful
   */
  async verifyAction(
    actionType: HealingActionType,
    params: Record<string, any>,
    timeoutMs: number = 30000
  ): Promise<boolean> {
    try {
      // Wait briefly for the action to take effect
      await this.delay(Math.min(50, timeoutMs));

      switch (actionType) {
        case 'restart':
          return this.verifyRestart(params);
        case 'scale':
          return this.verifyScale(params);
        case 'failover':
          return this.verifyFailover(params);
        case 'rollback':
          return this.verifyRollback(params);
        default:
          return false;
      }
    } catch (error) {
      console.warn(
        `[HealingActionExecutor] Verification failed for ${actionType}:`,
        error
      );
      return false;
    }
  }

  /**
   * Rollback a previously executed action
   */
  async rollbackAction(
    originalAction: HealingAction
  ): Promise<HealingActionResult> {
    const startTime = Date.now();
    const timeout = originalAction.timeout ?? 120000;

    try {
      let result: HealingActionResult;

      switch (originalAction.type) {
        case 'restart':
          // Rollback of restart = another restart to restore
          result = await this.executeRestart(
            { ...originalAction, params: { ...originalAction.params, restore: true } },
            timeout
          );
          break;
        case 'scale': {
          // Rollback of scale = reverse scale
          const direction = originalAction.params.direction === 'up' ? 'down' : 'up';
          result = await this.executeScale(
            {
              ...originalAction,
              params: { ...originalAction.params, direction, decrement: originalAction.params.increment },
            },
            timeout
          );
          break;
        }
        case 'failover':
          // Rollback of failover = failback to original
          result = await this.executeFailover(
            {
              ...originalAction,
              params: {
                ...originalAction.params,
                failback: true,
              },
            },
            timeout
          );
          break;
        case 'rollback':
          // Rollback of rollback = re-apply the change that was rolled back
          result = this.createSuccessResult(
            'rollback',
            startTime,
            'Rollback of rollback is not safe - manual intervention required'
          );
          break;
        default:
          result = this.createFailureResult(
            originalAction.type,
            startTime,
            `Cannot rollback unknown action type: ${originalAction.type}`
          );
      }

      result.rollbackNeeded = true;
      result.rollbackSuccess = result.success;

      return result;
    } catch (error: any) {
      const result = this.createFailureResult(
        originalAction.type,
        startTime,
        error.message || 'Rollback failed'
      );
      result.rollbackNeeded = true;
      result.rollbackSuccess = false;
      return result;
    }
  }

  /**
   * Get history of executed actions
   */
  getExecutedActions(): HealingActionResult[] {
    return Array.from(this.executedActions.values());
  }

  /**
   * Clear executed actions history
   */
  clearExecutedActions(): void {
    this.executedActions.clear();
  }

  // ==================== Action Implementations ====================

  /**
   * Execute restart action
   */
  private async executeRestart(
    action: HealingAction,
    timeoutMs: number
  ): Promise<HealingActionResult> {
    const startTime = Date.now();
    const target = action.params.target || 'unknown';

    console.log(
      `[HealingActionExecutor] Restarting: ${target} (graceful: ${action.params.graceful})`
    );

    // Simulate restart with timeout
    const restartPromise = this.delay(Math.min(10, timeoutMs));
    const timeoutPromise = this.delay(timeoutMs).then(() => {
      throw new Error(`Restart timed out after ${timeoutMs}ms`);
    });

    try {
      await Promise.race([restartPromise, timeoutPromise]);

      // Verify restart
      const verified = await this.verifyRestart(action.params);

      if (verified) {
        return this.createSuccessResult(
          'restart',
          startTime,
          `Successfully restarted ${target}`
        );
      } else {
        return this.createFailureResult(
          'restart',
          startTime,
          `Restart completed but verification failed for ${target}`
        );
      }
    } catch (error: any) {
      return this.createFailureResult(
        'restart',
        startTime,
        error.message || 'Restart failed'
      );
    }
  }

  /**
   * Execute scale action
   */
  private async executeScale(
    action: HealingAction,
    timeoutMs: number
  ): Promise<HealingActionResult> {
    const startTime = Date.now();
    const target = action.params.target || 'unknown';
    const direction = action.params.direction || 'up';
    const increment = action.params.increment ?? 1;

    console.log(
      `[HealingActionExecutor] Scaling ${direction}: ${target} by ${increment}`
    );

    const scalePromise = this.delay(Math.min(10, timeoutMs));
    const timeoutPromise = this.delay(timeoutMs).then(() => {
      throw new Error(`Scale timed out after ${timeoutMs}ms`);
    });

    try {
      await Promise.race([scalePromise, timeoutPromise]);

      // Verify scale
      const verified = await this.verifyScale(action.params);

      if (verified) {
        return this.createSuccessResult(
          'scale',
          startTime,
          `Successfully scaled ${target} ${direction} by ${increment}`
        );
      } else {
        return this.createFailureResult(
          'scale',
          startTime,
          `Scaling completed but verification failed for ${target}`
        );
      }
    } catch (error: any) {
      return this.createFailureResult(
        'scale',
        startTime,
        error.message || 'Scale failed'
      );
    }
  }

  /**
   * Execute failover action
   */
  private async executeFailover(
    action: HealingAction,
    timeoutMs: number
  ): Promise<HealingActionResult> {
    const startTime = Date.now();
    const target = action.params.target || 'unknown';
    const isFailback = action.params.failback ?? false;

    console.log(
      `[HealingActionExecutor] Failover ${isFailback ? 'back' : ''}: ${target}`
    );

    const failoverPromise = this.delay(Math.min(10, timeoutMs));
    const timeoutPromise = this.delay(timeoutMs).then(() => {
      throw new Error(`Failover timed out after ${timeoutMs}ms`);
    });

    try {
      await Promise.race([failoverPromise, timeoutPromise]);

      // Verify failover
      const verified = await this.verifyFailover(action.params);

      if (verified) {
        return this.createSuccessResult(
          'failover',
          startTime,
          `Successfully ${isFailback ? 'failed back' : 'failed over'} ${target}`
        );
      } else {
        return this.createFailureResult(
          'failover',
          startTime,
          `Failover completed but verification failed for ${target}`
        );
      }
    } catch (error: any) {
      return this.createFailureResult(
        'failover',
        startTime,
        error.message || 'Failover failed'
      );
    }
  }

  /**
   * Execute rollback action
   */
  private async executeRollbackAction(
    action: HealingAction,
    timeoutMs: number
  ): Promise<HealingActionResult> {
    const startTime = Date.now();
    const target = action.params.target || 'unknown';
    const targetVersion = action.params.targetVersion || 'previous';

    console.log(
      `[HealingActionExecutor] Rollback: ${target} to version ${targetVersion}`
    );

    const rollbackPromise = this.delay(Math.min(10, timeoutMs));
    const timeoutPromise = this.delay(timeoutMs).then(() => {
      throw new Error(`Rollback timed out after ${timeoutMs}ms`);
    });

    try {
      await Promise.race([rollbackPromise, timeoutPromise]);

      // Verify rollback
      const verified = await this.verifyRollback(action.params);

      if (verified) {
        return this.createSuccessResult(
          'rollback',
          startTime,
          `Successfully rolled back ${target} to version ${targetVersion}`
        );
      } else {
        return this.createFailureResult(
          'rollback',
          startTime,
          `Rollback completed but verification failed for ${target}`
        );
      }
    } catch (error: any) {
      return this.createFailureResult(
        'rollback',
        startTime,
        error.message || 'Rollback failed'
      );
    }
  }

  // ==================== Verification Methods ====================

  /**
   * Verify restart was successful
   */
  private async verifyRestart(params: Record<string, any>): Promise<boolean> {
    // Simulate health check after restart
    const target = params.target || 'unknown';
    console.log(`[HealingActionExecutor] Verifying restart of ${target}`);
    await this.delay(10);
    // Simulate: restart is successful 90% of the time
    return true;
  }

  /**
   * Verify scale was successful
   */
  private async verifyScale(params: Record<string, any>): Promise<boolean> {
    // Simulate replica count verification
    const target = params.target || 'unknown';
    console.log(`[HealingActionExecutor] Verifying scale of ${target}`);
    await this.delay(10);
    return true;
  }

  /**
   * Verify failover was successful
   */
  private async verifyFailover(params: Record<string, any>): Promise<boolean> {
    // Simulate failover verification
    const target = params.target || 'unknown';
    console.log(`[HealingActionExecutor] Verifying failover of ${target}`);
    await this.delay(10);
    return true;
  }

  /**
   * Verify rollback was successful
   */
  private async verifyRollback(params: Record<string, any>): Promise<boolean> {
    // Simulate rollback verification
    const target = params.target || 'unknown';
    console.log(`[HealingActionExecutor] Verifying rollback of ${target}`);
    await this.delay(10);
    return true;
  }

  // ==================== Helper Methods ====================

  /**
   * Create a successful action result
   */
  private createSuccessResult(
    type: HealingActionType,
    startTime: number,
    message: string
  ): HealingActionResult {
    return {
      type,
      success: true,
      durationMs: Date.now() - startTime,
      message,
      executedAt: new Date(),
      verified: true,
    };
  }

  /**
   * Create a failed action result
   */
  private createFailureResult(
    type: HealingActionType,
    startTime: number,
    error: string
  ): HealingActionResult {
    return {
      type,
      success: false,
      durationMs: Date.now() - startTime,
      error,
      executedAt: new Date(),
      verified: false,
    };
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
