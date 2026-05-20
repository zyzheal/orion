/**
 * OrionMF GlobalStore Module - Global State Management
 *
 * Reference: docs/superpowers/specs/2026-05-20-orionmf-v2-design.md §4.0
 * Design: Shared state between micro-apps with version control and ownership
 */

// ============================================================================
// Type Definitions
// ============================================================================

/** Store value with metadata */
export interface StoreValue {
  data: unknown;
  version: number;
  timestamp: number;
  owner: string;
}

/** Subscriber callback type */
export type SubscriberCallback = (key: string, value: unknown) => void;

// ============================================================================
// GlobalStore Class
// ============================================================================

/**
 * GlobalStore - Global state management with version control and ownership
 *
 * Features:
 * - State sharing between micro-apps
 * - Version control to avoid stale data
 * - Subscription mechanism for state changes
 * - Ownership tracking for cleanup
 */
export class GlobalStore {
  private store = new Map<string, StoreValue>();
  private subscribers = new Map<string, Set<SubscriberCallback>>();
  private version = 1;

  /**
   * Set global state
   * @param key - State key
   * @param value - State value
   * @param owner - Owner app key (sub-app identifier)
   */
  set(key: string, value: unknown, owner: string): void {
    this.store.set(key, {
      data: value,
      version: this.version++,
      timestamp: Date.now(),
      owner,
    });

    // Notify subscribers
    const keySubscribers = this.subscribers.get(key);
    if (keySubscribers) {
      for (const cb of keySubscribers) {
        cb(key, value);
      }
    }
  }

  /**
   * Get global state
   * @param key - State key
   * @returns State value or undefined
   */
  get(key: string): unknown {
    return this.store.get(key)?.data;
  }

  /**
   * Subscribe to state changes
   * @param key - State key to subscribe
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  subscribe(key: string, callback: SubscriberCallback): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  /**
   * Get multiple states at once
   * @param keys - Array of state keys
   * @returns Record of key-value pairs
   */
  getMany(keys: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      result[key] = this.get(key);
    }
    return result;
  }

  /**
   * Batch set multiple states
   * @param states - Record of key-value pairs
   * @param owner - Owner app key
   */
  setMany(states: Record<string, unknown>, owner: string): void {
    for (const [key, value] of Object.entries(states)) {
      this.set(key, value, owner);
    }
  }

  /**
   * Cleanup states owned by a specific sub-app
   * @param owner - Owner app key to cleanup
   */
  cleanup(owner: string): void {
    for (const [key, value] of this.store) {
      if (value.owner === owner) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get all states (for debugging)
   * @returns Object containing all store values
   */
  debug(): Record<string, StoreValue> {
    return Object.fromEntries(this.store);
  }

  /**
   * Check if a key exists in the store
   * @param key - State key
   * @returns true if key exists
   */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * Get state metadata
   * @param key - State key
   * @returns StoreValue or undefined
   */
  getMeta(key: string): StoreValue | undefined {
    return this.store.get(key);
  }

  /**
   * Delete a specific state
   * @param key - State key to delete
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all states
   */
  clear(): void {
    this.store.clear();
    this.subscribers.clear();
    this.version = 1;
  }

  /**
   * Get store size
   * @returns Number of states in store
   */
  size(): number {
    return this.store.size;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global singleton instance
 */
export const globalStore = new GlobalStore();

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Set global state (convenience function)
 */
export const setGlobalState = (key: string, value: unknown, owner: string): void => {
  globalStore.set(key, value, owner);
};

/**
 * Get global state (convenience function)
 */
export const getGlobalState = (key: string): unknown => {
  return globalStore.get(key);
};

/**
 * Subscribe to global state (convenience function)
 */
export const subscribeGlobalState = (
  key: string,
  callback: SubscriberCallback
): (() => void) => {
  return globalStore.subscribe(key, callback);
};

/**
 * Get multiple global states (convenience function)
 */
export const getGlobalStates = (keys: string[]): Record<string, unknown> => {
  return globalStore.getMany(keys);
};

/**
 * Cleanup sub-app states (convenience function)
 */
export const cleanupSubApp = (owner: string): void => {
  globalStore.cleanup(owner);
};