/**
 * OrionMF MFSandboxBridge Module - MF and Sandbox Bridge
 *
 * Bridges Module Federation loading with JavaScript sandbox isolation
 * Reference: docs/superpowers/specs/2026-05-20-orionmf-v2-design.md §3.1
 */

import { Sandbox, GlobalWrapper, SandboxProxy } from './Sandbox';
import { StyleIsolator } from './StyleIsolator';
import { ErrorIsolator } from './ErrorIsolator';
import type { IStyleIsolator } from './interface';

// ============================================================================
// Type Definitions
// ============================================================================

/** SubApp configuration */
export interface SubAppConfig {
  /** Unique key for the sub-app */
  key: string;
  /** Sub-app name */
  name: string;
  /** Module Federation remote entry URL */
  remoteEntry: string;
  /** Remote module name (default: './index') */
  remoteName?: string;
  /** Development entry URL */
  entry_dev?: string;
  /** Production entry URL */
  entry_prod?: string;
  /** Whether to skip Shadow DOM (for compatibility mode) */
  noShadowDOM?: boolean;
  /** CSS isolation strategy */
  cssIsolation?: 'shadow' | 'scoped' | 'none';
  /** Enable error boundary */
  errorBoundary?: boolean;
}

/** SubApp lifecycle hooks */
export interface SubAppLifecycle {
  /** Bootstrap hook - called once before mount */
  bootstrap?: () => Promise<void> | void;
  /** Mount hook - called when component should be mounted */
  mount: (container: HTMLElement) => Promise<void> | void;
  /** Unmount hook - called when component should be unmounted */
  unmount?: () => Promise<void> | void;
}

/** Loaded sub-app instance */
export interface SubAppInstance {
  /** Sub-app key */
  key: string;
  /** Container element or Shadow Root */
  root: HTMLElement | ShadowRoot;
  /** Sandbox proxy for this sub-app */
  sandbox: SandboxProxy;
  /** Lifecycle hooks */
  lifecycle: SubAppLifecycle;
  /** Cleanup function */
  destroy: () => Promise<void>;
}

/** Remote module loaded from Module Federation */
export interface RemoteModule {
  /** Module factory function */
  factory: () => Promise<any>;
  /** Module chunk */
  chunk: any;
  /** Error if loading failed */
  error?: Error;
}

/** Module Federation loader interface */
export interface MFLoader {
  /** Load remote modules */
  load(remoteEntry: string, remoteName?: string): Promise<RemoteModule[]>;
}

/** Lifecycle modules from MF */
export interface LifecycleModules {
  /** Bootstrap function */
  bootstrap?: () => Promise<void> | void;
  /** Mount function */
  mount: (container: HTMLElement) => Promise<void> | void;
  /** Unmount function */
  unmount?: () => Promise<void> | void;
}

// ============================================================================
// Default MF Loader (Browser Module Federation)
// ============================================================================

/**
 * Default Module Federation loader using native import()
 *
 * In a real implementation, this would use @module-federation/runtime
 * or webpack's Module Federation runtime
 */
class DefaultMFLoader implements MFLoader {
  private moduleCache = new Map<string, RemoteModule[]>();

  async load(remoteEntry: string, remoteName: string = './index'): Promise<RemoteModule[]> {
    // Check cache first
    const cacheKey = `${remoteEntry}:${remoteName}`;
    if (this.moduleCache.has(cacheKey)) {
      return this.moduleCache.get(cacheKey)!;
    }

    try {
      // Dynamic import - in real implementation this would use MF runtime
      // For now, we simulate the loading
      const modules = await this.simulateMFLoad(remoteEntry, remoteName);
      this.moduleCache.set(cacheKey, modules);
      return modules;
    } catch (error) {
      console.error(`[orion-mf] Failed to load remote module: ${remoteEntry}`, error);
      throw error;
    }
  }

  /**
   * Simulate Module Federation loading
   * In production, this would use actual MF runtime
   */
  private async simulateMFLoad(remoteEntry: string, _remoteName: string): Promise<RemoteModule[]> {
    // For demonstration - load as ES module
    // Real implementation would use MF runtime
    try {
      const module = await import(/* @vite-ignore */ remoteEntry);
      return [
        {
          factory: () => Promise.resolve(module),
          chunk: module,
        },
      ];
    } catch {
      // If dynamic import fails, return empty modules
      // This allows the bridge to handle the error gracefully
      return [];
    }
  }
}

// ============================================================================
// MFSandboxBridge Class
// ============================================================================

/**
 * MFSandboxBridge - Bridge between Module Federation and Sandbox
 *
 * Coordinates:
 * - MF Loader: loads shared modules from remote entries
 * - Sandbox: creates isolated execution context
 * - Renderer: mounts to Shadow DOM
 *
 * Lifecycle: MF load → Sandbox create → Lifecycle init → Mount
 */
export class MFSandboxBridge {
  /** Module Federation loader */
  private mfLoader: MFLoader;

  /** CSS style isolator */
  private styleIsolator: IStyleIsolator;

  /** Error isolator */
  private errorIsolator: ErrorIsolator;

  /** Loaded sub-app instances */
  private instances = new Map<string, SubAppInstance>();

  /** Sandboxes */
  private sandboxes = new Map<string, Sandbox>();

  /**
   * Create a new MFSandboxBridge
   *
   * @param options - Configuration options
   */
  constructor(options?: {
    mfLoader?: MFLoader;
    styleIsolator?: IStyleIsolator;
    errorIsolator?: ErrorIsolator;
  }) {
    this.mfLoader = options?.mfLoader ?? new DefaultMFLoader();
    this.styleIsolator = options?.styleIsolator ?? new StyleIsolator();
    this.errorIsolator = options?.errorIsolator ?? new ErrorIsolator();
  }

  /**
   * Load a sub-app
   *
   * @param config - Sub-app configuration
   * @returns Loaded sub-app instance
   */
  async loadSubApp(config: SubAppConfig): Promise<SubAppInstance> {
    const { key, name, remoteEntry, remoteName, noShadowDOM, cssIsolation, errorBoundary } = config;

    // Check if already loaded
    if (this.instances.has(key)) {
      console.warn(`[orion-mf] Sub-app "${key}" already loaded, returning existing instance`);
      return this.instances.get(key)!;
    }

    console.info(`[orion-mf] Loading sub-app: ${name} (${key})`);

    // Step 1: Load remote modules via Module Federation
    let remoteModules: RemoteModule[];
    try {
      remoteModules = await this.mfLoader.load(remoteEntry, remoteName);
    } catch (error) {
      console.error(`[orion-mf] Failed to load remote modules for "${key}":`, error);
      throw error;
    }

    // Step 2: Create sandbox for isolation
    const sandbox = GlobalWrapper.createSandbox(key);
    this.sandboxes.set(key, sandbox);
    const sandboxCtx = sandbox.proxy;

    // Step 3: Extract lifecycle from remote modules
    const lifecycle = this.initLifecycle(remoteModules, sandboxCtx, key);

    // Step 4: Setup error boundary if enabled
    let errorCallback: ((error: Error) => void) | undefined;
    if (errorBoundary) {
      errorCallback = (error: Error) => {
        console.error(`[orion-mf] Error in sub-app "${key}":`, error);
        // Trigger crash recovery if available
      };
      this.errorIsolator.setup(key, errorCallback);
    }

    // Step 5: Mount to Shadow DOM or regular DOM
    let root: HTMLElement | ShadowRoot;
    try {
      if (noShadowDOM) {
        // Compatible mode: mount to regular DOM
        root = this.mountToDOM(key, lifecycle);
      } else {
        // Full mode: mount to Shadow DOM
        root = this.mountToShadowDOM(key, lifecycle, cssIsolation);
      }
    } catch (error) {
      console.error(`[orion-mf] Failed to mount sub-app "${key}":`, error);
      // Cleanup sandbox on mount failure
      this.cleanupSubApp(key);
      throw error;
    }

    // Create instance
    const instance: SubAppInstance = {
      key,
      root,
      sandbox: sandboxCtx,
      lifecycle,
      destroy: () => this.destroy(key),
    };

    this.instances.set(key, instance);

    console.info(`[orion-mf] Sub-app loaded: ${name} (${key})`);

    return instance;
  }

  /**
   * Initialize lifecycle hooks from remote modules
   *
   * @param remoteModules - Modules loaded from MF
   * @param ctx - Sandbox proxy context
   * @param key - Sub-app key for error tracking
   * @returns Initialized lifecycle hooks
   */
  private initLifecycle(
    remoteModules: RemoteModule[],
    ctx: SandboxProxy,
    key: string
  ): SubAppLifecycle {
    // Extract lifecycle from the first module (main entry)
    // In real implementation, this would look for exports like:
    // - bootstrap, mount, unmount
    // - __esModule with default export

    const module = remoteModules[0]?.chunk;
    let lifecycle: SubAppLifecycle = {
      mount: () => {
        console.warn(`[orion-mf] Default mount called for "${key}" - no lifecycle found`);
      },
    };

    if (module) {
      // Try to get lifecycle from module exports
      const exports = module.__esModule ? module.default : module;

      if (typeof exports === 'object' && exports !== null) {
        // Extract lifecycle methods
        const { bootstrap, mount, unmount } = exports as any;

        lifecycle = {
          bootstrap: bootstrap ? this.bindLifecycle(bootstrap, ctx, key) : undefined,
          mount: mount ? this.bindLifecycle(mount, ctx, key) : this.defaultMount,
          unmount: unmount ? this.bindLifecycle(unmount, ctx, key) : undefined,
        };
      } else if (typeof exports === 'function') {
        // If module is a function, treat it as mount
        lifecycle = {
          mount: this.bindLifecycle(exports, ctx, key),
        };
      }
    }

    return lifecycle;
  }

  /**
   * Bind a lifecycle function to sandbox context
   *
   * This ensures the function runs with `this` pointing to the sandbox proxy
   */
  private bindLifecycle(
    fn: Function,
    ctx: SandboxProxy,
    key: string
  ): (...args: any[]) => any {
    return (...args: any[]) => {
      try {
        // Activate sandbox before executing lifecycle
        GlobalWrapper.activateSandbox(key);

        // Bind function to sandbox context
        return fn.apply(ctx, args);
      } catch (error) {
        console.error(`[orion-mf] Error in lifecycle for "${key}":`, error);
        throw error;
      } finally {
        // Deactivate sandbox after execution
        GlobalWrapper.deactivateSandbox(key);
      }
    };
  }

  /**
   * Default mount function (fallback)
   */
  private defaultMount(container: HTMLElement): void {
    container.innerHTML = '<p>Sub-app mounted (default)</p>';
  }

  /**
   * Mount to Shadow DOM with style isolation
   */
  private mountToShadowDOM(
    key: string,
    lifecycle: SubAppLifecycle,
    cssIsolation?: 'shadow' | 'scoped' | 'none'
  ): ShadowRoot {
    // Create container in main DOM
    const container = document.createElement('div');
    container.id = `orion-mf-container-${key}`;
    document.body.appendChild(container);

    // Use StyleIsolator for CSS isolation (or use direct Shadow DOM)
    let shadowRoot: ShadowRoot;
    if (cssIsolation !== 'none') {
      // StyleIsolator will attach Shadow DOM and setup CSS isolation
      shadowRoot = this.styleIsolator.mount(key, container);
    } else {
      // Direct Shadow DOM without CSS isolation
      shadowRoot = container.attachShadow({ mode: 'open' });
    }

    // Run bootstrap if exists
    if (lifecycle.bootstrap) {
      lifecycle.bootstrap();
    }

    // Run mount
    lifecycle.mount(shadowRoot as unknown as HTMLElement);

    return shadowRoot;
  }

  /**
   * Mount to regular DOM (compatible mode)
   */
  private mountToDOM(key: string, lifecycle: SubAppLifecycle): HTMLElement {
    // Create container in main DOM
    const container = document.createElement('div');
    container.id = `orion-mf-container-${key}`;
    document.body.appendChild(container);

    // Run bootstrap if exists
    if (lifecycle.bootstrap) {
      lifecycle.bootstrap();
    }

    // Run mount
    lifecycle.mount(container);

    return container;
  }

  /**
   * Get a loaded sub-app instance
   */
  getSubApp(key: string): SubAppInstance | undefined {
    return this.instances.get(key);
  }

  /**
   * Check if a sub-app is loaded
   */
  hasSubApp(key: string): boolean {
    return this.instances.has(key);
  }

  /**
   * Get all loaded sub-app keys
   */
  getLoadedKeys(): string[] {
    return Array.from(this.instances.keys());
  }

  /**
   * Cleanup a sub-app resources
   */
  private cleanupSubApp(key: string): void {
    // Remove sandbox
    const sandbox = this.sandboxes.get(key);
    if (sandbox) {
      GlobalWrapper.removeSandbox(key);
      this.sandboxes.delete(key);
    }

    // Remove error boundary
    if (this.errorIsolator.hasBoundary(key)) {
      this.errorIsolator.remove(key);
    }

    // Remove style isolation
    try {
      this.styleIsolator.unmount(key);
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Destroy a sub-app
   *
   * @param key - Sub-app key
   */
  async destroy(key: string): Promise<void> {
    const instance = this.instances.get(key);
    if (!instance) {
      console.warn(`[orion-mf] Sub-app "${key}" not found, nothing to destroy`);
      return;
    }

    console.info(`[orion-mf] Destroying sub-app: ${key}`);

    // Run unmount lifecycle
    try {
      if (instance.lifecycle.unmount) {
        // Activate sandbox for unmount
        GlobalWrapper.activateSandbox(key);
        await instance.lifecycle.unmount();
        GlobalWrapper.deactivateSandbox(key);
      }
    } catch (error) {
      console.error(`[orion-mf] Error during unmount for "${key}":`, error);
    }

    // Unmount from DOM/Shadow DOM
    try {
      if (instance.root instanceof ShadowRoot) {
        // Clean up React root from Shadow DOM
        const container = instance.root.host;
        container.remove();
      } else {
        // Regular DOM
        instance.root.remove();
      }
    } catch (error) {
      console.error(`[orion-mf] Error during DOM cleanup for "${key}":`, error);
    }

    // Cleanup resources
    this.cleanupSubApp(key);

    // Remove instance
    this.instances.delete(key);

    console.info(`[orion-mf] Sub-app destroyed: ${key}`);
  }

  /**
   * Destroy all loaded sub-apps
   */
  async destroyAll(): Promise<void> {
    const keys = Array.from(this.instances.keys());
    await Promise.all(keys.map((key) => this.destroy(key)));
    console.info('[orion-mf] All sub-apps destroyed');
  }
}

// ============================================================================
// Default Instance
// ============================================================================

/** Default MFSandboxBridge instance */
let defaultBridge: MFSandboxBridge | null = null;

/**
 * Get the default MFSandboxBridge instance
 */
export function getBridge(): MFSandboxBridge {
  if (!defaultBridge) {
    defaultBridge = new MFSandboxBridge();
  }
  return defaultBridge;
}

/**
 * Set the default MFSandboxBridge instance
 */
export function setBridge(bridge: MFSandboxBridge): void {
  defaultBridge = bridge;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Load a sub-app using the default bridge
 */
export async function loadSubApp(config: SubAppConfig): Promise<SubAppInstance> {
  return getBridge().loadSubApp(config);
}

/**
 * Destroy a sub-app using the default bridge
 */
export async function destroySubApp(key: string): Promise<void> {
  return getBridge().destroy(key);
}

/**
 * Get a sub-app instance from the default bridge
 */
export function getSubApp(key: string): SubAppInstance | undefined {
  return getBridge().getSubApp(key);
}

// ============================================================================
// Export
// ============================================================================

export default MFSandboxBridge;