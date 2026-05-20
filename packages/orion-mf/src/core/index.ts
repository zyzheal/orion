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
} from './interface';