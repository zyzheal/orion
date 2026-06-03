/**
 * event-bus/index.ts - Export verification tests
 */

import { EventBusRepository } from '../EventBusRepository';
import { EventBusService, EventBusServiceError } from '../EventBusService';

// Re-import from index to verify exports
import * as indexExports from '../index';

describe('event-bus/index exports', () => {
  it('should export EventBusRepository', () => {
    expect(indexExports.EventBusRepository).toBe(EventBusRepository);
  });

  it('should export EventBusService', () => {
    expect(indexExports.EventBusService).toBe(EventBusService);
  });

  it('should export EventBusServiceError', () => {
    expect(indexExports.EventBusServiceError).toBe(EventBusServiceError);
  });

  it('should export all expected symbols', () => {
    expect(typeof indexExports.EventBusRepository).toBe('function');
    expect(typeof indexExports.EventBusService).toBe('function');
    expect(typeof indexExports.EventBusServiceError).toBe('function');
  });
});
