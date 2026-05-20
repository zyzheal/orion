/**
 * OrionMF Core Module
 *
 * Core micro-frontend isolation and lifecycle management
 */

export {
  Sandbox,
  GlobalWrapper,
  createScopedStorage,
  getTargetValue,
  getCurrentRunningApp,
  setCurrentRunningApp,
  nextTask,
  nativeGlobal,
  READONLY_WHITELIST,
  DENYLIST,
} from "./Sandbox";

export {
  SandboxProxy,
} from "./Sandbox";

export {
  SandBoxType,
  SandBox,
  RunningApp,
  SandboxConfig,
  ScopedFunction,
  IStyleIsolator,
} from "./interface";

export { StyleIsolator } from "./StyleIsolator";

export { ErrorIsolator } from "./ErrorIsolator";

export { RouterManager } from "./RouterManager";

export type {
  ErrorBoundary as ErrorBoundaryType,
  ErrorCallback,
} from "./ErrorIsolator";

export type {
  RouteConfig,
  RouteState,
  RouteChangeCallback,
} from "./RouterManager";

// GlobalStore exports
export { GlobalStore, globalStore } from "./GlobalStore";
export {
  setGlobalState,
  getGlobalState,
  subscribeGlobalState,
  getGlobalStates,
  cleanupSubApp,
} from "./GlobalStore";
export type { StoreValue, SubscriberCallback } from "./GlobalStore";

// SubAppDataChannel exports
export { SubAppDataChannel } from "./SubAppDataChannel";
export {
  createDataChannel,
  createFullAccessChannel,
  createReadOnlyChannel,
} from "./SubAppDataChannel";
export type { ChannelConfig, StateChangeCallback } from "./SubAppDataChannel";


export { CrashRecovery } from "./CrashRecovery";

export type {
  RecoveryContext,
  CircuitBreakerConfig as CrashRecoveryConfig,
} from "./CrashRecovery";

// LeakPrevention exports
export { LeakPrevention } from "./LeakPrevention";

export type {
  LeakContext,
  MemoryStats,
} from "./LeakPrevention";

// DegradationStrategy exports
export { DegradationStrategy } from "./DegradationStrategy";

export {
  createDegradationStrategy,
  getDegradationStrategy,
  setDegradationStrategy,
} from "./DegradationStrategy";

export type {
  DegradationLevel,
  DegradationEvent,
  DegradationConfig,
} from "./DegradationStrategy";

// EventBus exports
export { EventBus, eventBus } from "./EventBus";
export type {
  EventBusHandler,
  EventBusPayload,
  ChannelOptions,
} from "./EventBus";

// PreloadStrategy exports
export { PreloadStrategy } from "./PreloadStrategy";

export {
  getPreloadStrategy,
  setPreloadStrategy,
} from "./PreloadStrategy";

export type {
  PrefetchMode,
  PrefetchConfig,
  PreloadStrategyOptions,
} from "./PreloadStrategy";
