/**
 * ABACPolicy constants
 * 抽取自 index.tsx (P2-9 Phase 202)
 */

export const RESOURCE_OPTIONS = [
  { value: '*', label: '所有资源' },
  { value: 'pipeline', label: '流水线' },
  { value: 'deployment', label: '部署' },
  { value: 'cmdb', label: 'CMDB' },
  { value: 'user', label: '用户' },
  { value: 'tenant', label: '租户' },
];

export const ACTION_OPTIONS = [
  { value: '*', label: '所有操作' },
  { value: 'read', label: '读取' },
  { value: 'create', label: '创建' },
  { value: 'update', label: '更新' },
  { value: 'delete', label: '删除' },
  { value: 'execute', label: '执行' },
];

export const EFFECT_OPTIONS = [
  { value: 'allow', label: '允许' },
  { value: 'deny', label: '拒绝' },
];
