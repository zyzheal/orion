/**
 * FaultInjector - Fault injection engine for Chaos Engineering
 *
 * Implements fault injection capabilities including:
 * - Network latency injection
 * - Service down simulation
 * - CPU stress generation
 * - Memory stress generation
 * - Disk full simulation
 *
 * Phase 3 P1 Service
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'LFault-LInjector' });

// ==================== Types ====================

export interface FaultInjectionConfig {
  type: 'network_latency' | 'service_down' | 'cpu_stress' | 'memory_stress' | 'disk_full';
  target: string;
  config: Record<string, unknown>;
  duration_ms: number;
}

export interface InjectionResult {
  success: boolean;
  fault_id: string;
  started_at: Date;
  estimated_end_at: Date;
  message: string;
  error?: string;
}

export interface InjectionStatus {
  fault_id: string;
  type: string;
  target: string;
  status: 'injecting' | 'active' | 'recovering' | 'completed' | 'failed';
  started_at: Date;
  ended_at?: Date;
  metrics: Record<string, number>;
}

export interface NetworkLatencyConfig {
  latency_ms: number;
  jitter_ms?: number;
  target_port?: number;
}

export interface ServiceDownConfig {
  graceful_shutdown?: boolean;
  shutdown_timeout_ms?: number;
}

export interface CPUStressConfig {
  stress_percent: number;
  workers?: number;
}

export interface MemoryStressConfig {
  stress_mb: number;
  stress_percent?: number;
}

export interface DiskFullConfig {
  fill_percent: number;
  temp_file_path?: string;
}

export class FaultInjectorError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'FaultInjectorError';
  }
}

// ==================== FaultInjector ====================

export class FaultInjector extends EventEmitter {
  private activeFaults: Map<string, InjectionStatus> = new Map();
  private injectionIdCounter: number = 0;

  constructor() {
    super();
  }

  /**
   * Inject a fault
   */
  async inject(config: FaultInjectionConfig): Promise<InjectionResult> {
    // Generate fault ID
    const faultId = `fault-${++this.injectionIdCounter}-${Date.now()}`;
    const startedAt = new Date();
    const estimatedEndAt = new Date(startedAt.getTime() + config.duration_ms);

    // Validate configuration
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new FaultInjectorError(
        `Invalid fault configuration: ${validation.error}`,
        'INVALID_CONFIG'
      );
    }

    // Check if target is already under fault
    const existingFaults = this.getActiveFaultsForTarget(config.target);
    if (existingFaults.length > 0) {
      throw new FaultInjectorError(
        `Target ${config.target} already has active fault injection`,
        'TARGET_BUSY'
      );
    }

    try {
      // Emit injection start event
      this.emit('injection:start', {
        fault_id: faultId,
        type: config.type,
        target: config.target,
      });

      // Create injection status
      const status: InjectionStatus = {
        fault_id: faultId,
        type: config.type,
        target: config.target,
        status: 'injecting',
        started_at: startedAt,
        metrics: {},
      };

      this.activeFaults.set(faultId, status);

      // Inject based on type
      switch (config.type) {
        case 'network_latency':
          await this.injectNetworkLatency(faultId, config.target, config.config as unknown as NetworkLatencyConfig);
          break;
        case 'service_down':
          await this.injectServiceDown(faultId, config.target, config.config as unknown as ServiceDownConfig);
          break;
        case 'cpu_stress':
          await this.injectCPUStress(faultId, config.target, config.config as unknown as CPUStressConfig);
          break;
        case 'memory_stress':
          await this.injectMemoryStress(faultId, config.target, config.config as unknown as MemoryStressConfig);
          break;
        case 'disk_full':
          await this.injectDiskFull(faultId, config.target, config.config as unknown as DiskFullConfig);
          break;
        default:
          throw new FaultInjectorError(`Unknown fault type: ${config.type}`, 'UNKNOWN_TYPE');
      }

      // Update status to active
      status.status = 'active';
      this.activeFaults.set(faultId, status);

      // Schedule automatic recovery
      this.scheduleRecovery(faultId, config.duration_ms);

      return {
        success: true,
        fault_id: faultId,
        started_at: startedAt,
        estimated_end_at: estimatedEndAt,
        message: `Fault ${config.type} injected on ${config.target}`,
      };
    } catch (err) {
      // Mark as failed
      const status = this.activeFaults.get(faultId);
      if (status) {
        status.status = 'failed';
        status.ended_at = new Date();
        this.activeFaults.set(faultId, status);
      }

      this.emit('injection:failed', {
        fault_id: faultId,
        error: (err as Error).message,
      });

      return {
        success: false,
        fault_id: faultId,
        started_at: startedAt,
        estimated_end_at: estimatedEndAt,
        message: 'Injection failed',
        error: (err as Error).message,
      };
    }
  }

  /**
   * Recover (stop) a fault injection
   */
  async recover(faultId: string): Promise<{ success: boolean; message: string }> {
    const status = this.activeFaults.get(faultId);

    if (!status) {
      throw new FaultInjectorError(
        `Fault not found: ${faultId}`,
        'FAULT_NOT_FOUND'
      );
    }

    if (status.status === 'completed' || status.status === 'recovering') {
      return { success: false, message: 'Fault already recovered or recovering' };
    }

    // Emit recovery start event
    this.emit('recovery:start', {
      fault_id: faultId,
      type: status.type,
      target: status.target,
    });

    // Update status
    status.status = 'recovering';
    this.activeFaults.set(faultId, status);

    try {
      // Recover based on type
      switch (status.type) {
        case 'network_latency':
          await this.recoverNetworkLatency(faultId, status.target);
          break;
        case 'service_down':
          await this.recoverServiceDown(faultId, status.target);
          break;
        case 'cpu_stress':
          await this.recoverCPUStress(faultId, status.target);
          break;
        case 'memory_stress':
          await this.recoverMemoryStress(faultId, status.target);
          break;
        case 'disk_full':
          await this.recoverDiskFull(faultId, status.target);
          break;
      }

      // Update status
      status.status = 'completed';
      status.ended_at = new Date();
      this.activeFaults.set(faultId, status);

      this.emit('recovery:complete', {
        fault_id: faultId,
        duration_ms: status.ended_at.getTime() - status.started_at.getTime(),
      });

      return {
        success: true,
        message: `Fault ${faultId} recovered successfully`,
      };
    } catch (err) {
      status.status = 'failed';
      status.ended_at = new Date();
      this.activeFaults.set(faultId, status);

      this.emit('recovery:failed', {
        fault_id: faultId,
        error: (err as Error).message,
      });

      throw new FaultInjectorError(
        `Recovery failed: ${(err as Error).message}`,
        'RECOVERY_FAILED'
      );
    }
  }

  /**
   * Get injection status
   */
  getStatus(faultId: string): InjectionStatus | null {
    return this.activeFaults.get(faultId) || null;
  }

  /**
   * Get all active faults
   */
  getActiveFaults(): InjectionStatus[] {
    return Array.from(this.activeFaults.values())
      .filter(s => s.status === 'active' || s.status === 'injecting');
  }

  /**
   * Get active faults for a target
   */
  getActiveFaultsForTarget(target: string): InjectionStatus[] {
    return this.getActiveFaults().filter(s => s.target === target);
  }

  /**
   * Validate fault configuration
   */
  private validateConfig(config: FaultInjectionConfig): { valid: boolean; error?: string } {
    if (!config.target) {
      return { valid: false, error: 'Target is required' };
    }

    if (config.duration_ms <= 0 || config.duration_ms > 3600000) {
      return { valid: false, error: 'Duration must be between 1ms and 1 hour' };
    }

    // Type-specific validation
    switch (config.type) {
      case 'network_latency':
        const latencyConfig = config.config as unknown as NetworkLatencyConfig;
        if (!latencyConfig.latency_ms || latencyConfig.latency_ms < 0 || latencyConfig.latency_ms > 30000) {
          return { valid: false, error: 'latency_ms must be between 0 and 30000' };
        }
        break;
      case 'cpu_stress':
        const cpuConfig = config.config as unknown as CPUStressConfig;
        if (!cpuConfig.stress_percent || cpuConfig.stress_percent < 0 || cpuConfig.stress_percent > 100) {
          return { valid: false, error: 'stress_percent must be between 0 and 100' };
        }
        break;
      case 'memory_stress':
        const memConfig = config.config as unknown as MemoryStressConfig;
        if (!memConfig.stress_mb && !memConfig.stress_percent) {
          return { valid: false, error: 'stress_mb or stress_percent required' };
        }
        break;
      case 'disk_full':
        const diskConfig = config.config as unknown as DiskFullConfig;
        if (!diskConfig.fill_percent || diskConfig.fill_percent < 0 || diskConfig.fill_percent > 95) {
          return { valid: false, error: 'fill_percent must be between 0 and 95' };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Schedule automatic recovery
   */
  private scheduleRecovery(faultId: string, durationMs: number): void {
    setTimeout(async () => {
      const status = this.activeFaults.get(faultId);
      if (status && status.status === 'active') {
        try {
          await this.recover(faultId);
        } catch (err) {
          logger.error(`[FaultInjector] Auto-recovery failed for ${faultId}:`, err);
        }
      }
    }, durationMs);
  }

  // ==================== Fault Type Implementations ====================

  /**
   * Network latency injection (simulated)
   */
  private async injectNetworkLatency(
    faultId: string,
    target: string,
    config: NetworkLatencyConfig
  ): Promise<void> {
    logger.info(`[FaultInjector] Injecting network latency ${config.latency_ms}ms on ${target}`);

    // In real implementation, would use tc (traffic control) or similar
    // Simulated: just log and emit event
    this.emit('fault:network_latency', {
      fault_id: faultId,
      target,
      latency_ms: config.latency_ms,
      jitter_ms: config.jitter_ms || 0,
    });

    // Simulate injection delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async recoverNetworkLatency(faultId: string, target: string): Promise<void> {
    logger.info(`[FaultInjector] Recovering network latency on ${target}`);
    this.emit('fault:network_latency:recovered', { fault_id: faultId, target });
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  /**
   * Service down injection (simulated)
   */
  private async injectServiceDown(
    faultId: string,
    target: string,
    config: ServiceDownConfig
  ): Promise<void> {
    logger.info(`[FaultInjector] Injecting service down on ${target}`);

    this.emit('fault:service_down', {
      fault_id: faultId,
      target,
      graceful: config.graceful_shutdown ?? true,
    });

    await new Promise(resolve => setTimeout(resolve, config.shutdown_timeout_ms || 5000));
  }

  private async recoverServiceDown(faultId: string, target: string): Promise<void> {
    logger.info(`[FaultInjector] Recovering service down on ${target}`);
    this.emit('fault:service_down:recovered', { fault_id: faultId, target });
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * CPU stress injection (simulated)
   */
  private async injectCPUStress(
    faultId: string,
    target: string,
    config: CPUStressConfig
  ): Promise<void> {
    logger.info(`[FaultInjector] Injecting CPU stress ${config.stress_percent}% on ${target}`);

    this.emit('fault:cpu_stress', {
      fault_id: faultId,
      target,
      stress_percent: config.stress_percent,
      workers: config.workers || 1,
    });

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async recoverCPUStress(faultId: string, target: string): Promise<void> {
    logger.info(`[FaultInjector] Recovering CPU stress on ${target}`);
    this.emit('fault:cpu_stress:recovered', { fault_id: faultId, target });
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  /**
   * Memory stress injection (simulated)
   */
  private async injectMemoryStress(
    faultId: string,
    target: string,
    config: MemoryStressConfig
  ): Promise<void> {
    logger.info(`[FaultInjector] Injecting memory stress on ${target}`);

    this.emit('fault:memory_stress', {
      fault_id: faultId,
      target,
      stress_mb: config.stress_mb,
      stress_percent: config.stress_percent,
    });

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async recoverMemoryStress(faultId: string, target: string): Promise<void> {
    logger.info(`[FaultInjector] Recovering memory stress on ${target}`);
    this.emit('fault:memory_stress:recovered', { fault_id: faultId, target });
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  /**
   * Disk full injection (simulated)
   */
  private async injectDiskFull(
    faultId: string,
    target: string,
    config: DiskFullConfig
  ): Promise<void> {
    logger.info(`[FaultInjector] Injecting disk full ${config.fill_percent}% on ${target}`);

    this.emit('fault:disk_full', {
      fault_id: faultId,
      target,
      fill_percent: config.fill_percent,
    });

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async recoverDiskFull(faultId: string, target: string): Promise<void> {
    logger.info(`[FaultInjector] Recovering disk full on ${target}`);
    this.emit('fault:disk_full:recovered', { fault_id: faultId, target });
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  /**
   * Cleanup all active faults
   */
  async cleanupAll(): Promise<{ recovered: number; failed: number }> {
    let recovered = 0;
    let failed = 0;

    for (const [faultId, status] of Array.from(this.activeFaults.entries())) {
      if (status.status === 'active' || status.status === 'injecting') {
        try {
          await this.recover(faultId);
          recovered++;
        } catch {
          failed++;
        }
      }
    }

    return { recovered, failed };
  }
}