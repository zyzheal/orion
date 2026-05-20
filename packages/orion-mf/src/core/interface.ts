/**
 * OrionMF Core Interface Definitions
 */

import type { SandboxProxy } from './Sandbox';

/** Sandbox type enumeration */
export enum SandBoxType {
  /** Snapshot sandbox - uses property copy snapshot */
  Snapshot = 'Snapshot',
  /** Proxy sandbox - uses ES6 Proxy */
  Proxy = 'Proxy',
}

/** Sandbox interface */
export interface SandBox {
  /** Unique name of the sandbox */
  name: string;
  /** Sandbox type */
  type: SandBoxType;
  /** The proxy object exposed to micro apps */
  proxy: SandboxProxy;
  /** Whether the sandbox is currently running */
  sandboxRunning: boolean;
  /** Latest property that was set */
  latestSetProp?: PropertyKey | null;
  /** Activate the sandbox */
  active: () => void;
  /** Deactivate the sandbox */
  inactive: () => void;
}

/** Running app context */
export interface RunningApp {
  /** App key/identifier */
  key: string;
  /** App's sandbox proxy */
  proxy: SandboxProxy;
}

/** Sandbox configuration */
export interface SandboxConfig {
  /** Unique key for the sandbox */
  key: string;
  /** Optional global context override */
  globalContext?: typeof window;
  /** Enable/disable sandbox */
  enabled?: boolean;
}

/** Sandboxed function wrapper */
export interface ScopedFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): ReturnType<T>;
}

// ============================================================================
// StyleIsolator Types
// ============================================================================

/** StyleIsolator interface */
export interface IStyleIsolator {
  /** Mount a micro app container with Shadow DOM */
  mount(key: string, container: HTMLElement): ShadowRoot;
  /** Unmount a micro app and cleanup resources */
  unmount(key: string): void;
}