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
} from './Sandbox';

export {
  SandboxProxy,
} from './Sandbox';

export {
  SandBoxType,
  SandBox,
  RunningApp,
  SandboxConfig,
  ScopedFunction,
  IStyleIsolator,
} from './interface';

export { StyleIsolator } from './StyleIsolator';

export { ErrorIsolator } from './ErrorIsolator';

export { RouterManager } from './RouterManager';

export type {
  ErrorBoundary as ErrorBoundaryType,
  ErrorCallback,
} from './ErrorIsolator';

export type {
  RouteConfig,
  RouteState,
  RouteChangeCallback,
} from './RouterManager';
