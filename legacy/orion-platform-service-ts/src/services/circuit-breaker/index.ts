/**
 * Circuit Breaker Service Factory
 *
 * Creates and initializes CircuitBreakerService with database connection.
 * Exported as a singleton for the application.
 */

import {
  CircuitBreakerConfigRepository,
  CircuitBreakerStateRepository,
  CircuitBreakerEventRepository,
} from './circuit-breaker-repositories';
import { CircuitBreakerService } from './circuit-breaker-service';
import pino from 'pino';

const logger = pino({ name: 'index' });

let circuitBreakerService: CircuitBreakerService | null = null;

/**
 * Initialize the circuit breaker service.
 * Should be called during application startup.
 */
export async function initCircuitBreakerService(
  db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
): Promise<CircuitBreakerService | null> {
  if (!db) {
    logger.warn('Circuit Breaker Service: Database not available, running in memory-only mode');
    circuitBreakerService = createInMemoryService();
    return circuitBreakerService;
  }

  try {
    const configRepo = new CircuitBreakerConfigRepository(db);
    const stateRepo = new CircuitBreakerStateRepository(db);
    const eventRepo = new CircuitBreakerEventRepository(db);

    circuitBreakerService = new CircuitBreakerService(configRepo, stateRepo, eventRepo);

    // Load existing configs from DB
    await circuitBreakerService.initialize();

    logger.info('Circuit Breaker Service initialized');
    return circuitBreakerService;
  } catch (error) {
    logger.error('Failed to initialize Circuit Breaker Service:', error);
    circuitBreakerService = createInMemoryService();
    return circuitBreakerService;
  }
}

/**
 * Get the initialized circuit breaker service instance.
 */
export function getCircuitBreakerService(): CircuitBreakerService | null {
  return circuitBreakerService;
}

/**
 * Create a simple in-memory service for development/testing.
 */
function createInMemoryService(): CircuitBreakerService {
  // Minimal in-memory store for development
  const memoryStore: any[] = [];
  const fakeDb = {
    query: async (text: string, params?: unknown[]) => {
      logger.warn('[CircuitBreaker] In-memory mode (no database):', text.substring(0, 50));
      return { rows: [], rowCount: 0 };
    },
  };

  const configRepo = new CircuitBreakerConfigRepository(fakeDb);
  const stateRepo = new CircuitBreakerStateRepository(fakeDb);
  const eventRepo = new CircuitBreakerEventRepository(fakeDb);

  return new CircuitBreakerService(configRepo, stateRepo, eventRepo);
}
