/**
 * 微前端模块导出
 */
export { eventBus } from './eventBus';
export { initMicroFrontend, unloadSubApp, injectGlobalState } from './config';
export { subAppConfigs, getSubAppConfig, getEnabledApps } from './apps';
export * from './types';
