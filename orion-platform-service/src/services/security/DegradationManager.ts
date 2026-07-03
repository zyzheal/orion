/**
 * DegradationManager - Multi-level degradation system for service resilience
 *
 * Tracks service health across 4 levels and emits events on state changes.
 * Provides a formal fallback mechanism for the SecurityScannerService.
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Degradation level constants
 *
 * LEVEL_0 (0): Normal — PG database operational, all services working
 * LEVEL_1 (1): PG database degraded — using in-memory fallback store
 * LEVEL_2 (2): PG and in-memory degraded — cache-only mode, limited results
 * LEVEL_3 (3): All layers down — return degraded results, minimal functionality
 */
export const DEGRADATION_LEVELS = {
  LEVEL_0: 0,
  LEVEL_1: 1,
  LEVEL_2: 2,
  LEVEL_3: 3,
} as const;

export type DegradationLevel = (typeof DEGRADATION_LEVELS)[keyof typeof DEGRADATION_LEVELS];

/**
 * Describes a single degradation event for history tracking
 */
export interface DegradationEvent {
  level: DegradationLevel;
  reason: string;
  timestamp: Date;
  service: string;
  direction: 'degradation' | 'recovery';
}

/**
 * State-change payload emitted on every level transition
 */
export interface DegradationStateChange {
  currentLevel: DegradationLevel;
  previousLevel: DegradationLevel;
  lastEvent: DegradationEvent;
}

/**
 * DegradationManager
 *
 * Emits the following events:
 * - 'degradation': Emitted when the degradation level increases (worsens)
 * - 'recovery': Emitted when the degradation level decreases (improves)
 * - 'state-change': Emitted on every level transition with full context
 */
export class DegradationManager extends EventEmitter {
  private currentLevel: DegradationLevel = DEGRADATION_LEVELS.LEVEL_0;
  private history: DegradationEvent[] = [];

  /**
   * @param serviceLogger - Optional pino logger instance; defaults to module-level logger
   */
  constructor(private serviceLogger?: pino.Logger) {
    super();
  }

  /**
   * Increase degradation level (service is becoming less healthy).
   * Caps at LEVEL_3.
   */
  degrade(reason: string, service: string = 'SecurityScannerService'): DegradationLevel {
    const previousLevel = this.currentLevel;
    const newLevel = Math.min(this.currentLevel + 1, DEGRADATION_LEVELS.LEVEL_3) as DegradationLevel;

    if (newLevel > previousLevel) {
      this.currentLevel = newLevel;
      this.recordEvent(newLevel, reason, service, 'degradation', previousLevel);
    }

    return this.currentLevel;
  }

  /**
   * Decrease degradation level (service is recovering health).
   * Floors at LEVEL_0.
   */
  recover(reason: string, service: string = 'SecurityScannerService'): DegradationLevel {
    const previousLevel = this.currentLevel;
    const newLevel = Math.max(this.currentLevel - 1, DEGRADATION_LEVELS.LEVEL_0) as DegradationLevel;

    if (newLevel < previousLevel) {
      this.currentLevel = newLevel;
      this.recordEvent(newLevel, reason, service, 'recovery', previousLevel);
    }

    return this.currentLevel;
  }

  /**
   * Return the current degradation level
   */
  getCurrentLevel(): DegradationLevel {
    return this.currentLevel;
  }

  /**
   * Returns true if the service is still operational (level < 3)
   */
  isOperational(): boolean {
    return this.currentLevel < DEGRADATION_LEVELS.LEVEL_3;
  }

  /**
   * Return a copy of the full degradation event history
   */
  getDegradationHistory(): DegradationEvent[] {
    return [...this.history];
  }

  /**
   * Return a summary of the current degradation status
   */
  getStatus(): {
    currentLevel: number;
    label: string;
    isOperational: boolean;
    totalDegradationEvents: number;
    totalRecoveryEvents: number;
    lastEvent: DegradationEvent | null;
  } {
    const degradationEvents = this.history.filter(e => e.direction === 'degradation').length;
    const recoveryEvents = this.history.filter(e => e.direction === 'recovery').length;

    const levelLabels: Record<DegradationLevel, string> = {
      [DEGRADATION_LEVELS.LEVEL_0]: 'Normal',
      [DEGRADATION_LEVELS.LEVEL_1]: 'PG degraded — using in-memory fallback',
      [DEGRADATION_LEVELS.LEVEL_2]: 'In-memory degraded — cache-only mode',
      [DEGRADATION_LEVELS.LEVEL_3]: 'All layers down — degraded results',
    };

    return {
      currentLevel: this.currentLevel,
      label: levelLabels[this.currentLevel] ?? 'Unknown',
      isOperational: this.isOperational(),
      totalDegradationEvents: degradationEvents,
      totalRecoveryEvents: recoveryEvents,
      lastEvent: this.history.length > 0 ? this.history[this.history.length - 1] : null,
    };
  }

  /**
   * Record a degradation/recovery event, log it, and emit the appropriate events
   */
  private recordEvent(
    level: DegradationLevel,
    reason: string,
    service: string,
    direction: 'degradation' | 'recovery',
    previousLevel: DegradationLevel,
  ): void {
    const event: DegradationEvent = {
      level,
      reason,
      timestamp: new Date(),
      service,
      direction,
    };

    this.history.push(event);

    // Log with appropriate severity
    const log = this.serviceLogger ?? logger;
    if (direction === 'degradation') {
      log.warn(
        { degradationEvent: event, previousLevel },
        `[DegradationManager] ${service} degraded to level ${level}: ${reason}`,
      );
    } else {
      log.info(
        { degradationEvent: event, previousLevel },
        `[DegradationManager] ${service} recovered to level ${level}: ${reason}`,
      );
    }

    // Emit events
    this.emit(direction, event);
    this.emit('state-change', {
      currentLevel: level,
      previousLevel,
      lastEvent: event,
    } satisfies DegradationStateChange);
  }
}

export default DegradationManager;
