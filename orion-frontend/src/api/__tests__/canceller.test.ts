import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequestCanceller, getAbortConfig } from '../canceller';

describe('createRequestCanceller', () => {
  beforeEach(() => {
    // Reset mock tracking
    vi.clearAllMocks();
  });

  it('should cancel a single request by ID', () => {
    const { cancelRequest } = createRequestCanceller();
    const { _cancelId, signal } = getAbortConfig('/test', 'tag1');

    expect(signal.aborted).toBe(false);
    expect(cancelRequest(_cancelId)).toBe(true);
    expect(signal.aborted).toBe(true);
  });

  it('should return false for unknown cancel ID', () => {
    const { cancelRequest } = createRequestCanceller();
    expect(cancelRequest(Symbol('unknown'))).toBe(false);
  });

  it('should cancel by tag', () => {
    const { cancelByTag } = createRequestCanceller();
    getAbortConfig('/a', 'page-1');
    getAbortConfig('/b', 'page-1');
    getAbortConfig('/c', 'page-2');

    const count = cancelByTag('page-1');
    expect(count).toBe(2);
  });

  it('should cancel all requests', () => {
    const { cancelAll } = createRequestCanceller();
    getAbortConfig('/x', 'tag-x');
    getAbortConfig('/y', 'tag-y');

    const count = cancelAll();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('should track active count', () => {
    const { activeCount } = createRequestCanceller();
    expect(typeof activeCount()).toBe('number');
    expect(activeCount()).toBeGreaterThanOrEqual(0);
  });

  it('should handle onRouteChange', () => {
    const { onRouteChange } = createRequestCanceller();
    // Should not throw
    expect(() => onRouteChange()).not.toThrow();
  });
});
