import type { ModuleRef, FrontendRef, BootLevel } from './types';

export const FALLBACK_MODULES: ModuleRef[] = [
  { module: 'middleware', references: 243, risk: 'low', files: 0, lines: 0, hasInterface: true },
  { module: 'ai', references: 153, risk: 'high', files: 218, lines: 23346, hasInterface: false },
  { module: 'notification', references: 119, risk: 'high', files: 78, lines: 15103, hasInterface: false },
  { module: 'ci-cd', references: 110, risk: 'high', files: 122, lines: 21797, hasInterface: false },
  { module: 'ticketing', references: 103, risk: 'high', files: 62, lines: 13084, hasInterface: false },
  { module: 'config', references: 90, risk: 'medium', files: 0, lines: 0, hasInterface: false },
  { module: 'infrastructure', references: 85, risk: 'medium', files: 65, lines: 14995, hasInterface: false },
  { module: 'finops', references: 70, risk: 'medium', files: 0, lines: 0, hasInterface: false },
  { module: 'identity', references: 68, risk: 'medium', files: 0, lines: 0, hasInterface: false },
  { module: 'ticket', references: 66, risk: 'medium', files: 0, lines: 0, hasInterface: false },
];

export const FALLBACK_FE: FrontendRef[] = [
  { component: 'Table', references: 95, type: 'component' },
  { component: 'SearchFilterBar', references: 62, type: 'component' },
  { component: 'StatusBadge', references: 38, type: 'component' },
  { component: 'PageSkeleton', references: 28, type: 'component' },
  { component: 'MetricCard', references: 28, type: 'component' },
];

export const BOOT_LEVELS: BootLevel[] = [
  { level: 'L1 编译时开关', status: 'pass', desc: '通过 build tags 控制模块编译' },
  { level: 'L2 启动时配置', status: 'pass', desc: 'router.go if handler != nil 模式' },
  { level: 'L3 运行时开关', status: 'partial', desc: 'feature_flag_handler.go 存在，覆盖度未知' },
  { level: 'L4 动态热加载', status: 'fail', desc: '配置变更需重启服务' },
];
