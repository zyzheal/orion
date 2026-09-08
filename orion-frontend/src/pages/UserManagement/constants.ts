import type { FilterDefinition } from '@/components/SearchFilterBar';

/**
 * constants.ts - 用户管理常量
 * 抽取自 UserManagement/index.tsx (P2-9 Phase 97)
 */

export const roleColorMap: Record<string, string> = {
  admin: 'red',
  developer: 'blue',
  viewer: 'default',
  manager: 'gold',
  user: 'default',
};

export const roleLabelMap: Record<string, string> = {
  admin: '管理员',
  developer: '开发者',
  viewer: '观察者',
  manager: '经理',
  user: '普通用户',
};

export const statusColorMap: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  deleted: 'error',
  locked: 'orange',
};

export const statusLabelMap: Record<string, string> = {
  active: '已启用',
  inactive: '已禁用',
  deleted: '已删除',
  locked: '已锁定',
};

export const roleOptions = Object.entries(roleLabelMap).map(([value, label]) => ({
  label,
  value,
}));

export const filterDefs: FilterDefinition[] = [
  {
    key: 'role',
    label: '角色',
    options: [
      { label: '全部', value: 'all' },
      { label: '管理员', value: 'admin' },
      { label: '开发者', value: 'developer' },
      { label: '经理', value: 'manager' },
      { label: '观察者', value: 'viewer' },
      { label: '普通用户', value: 'user' },
    ],
  },
  {
    key: 'status',
    label: '状态',
    options: [
      { label: '全部', value: 'all' },
      { label: '已启用', value: 'active' },
      { label: '已禁用', value: 'inactive' },
      { label: '已锁定', value: 'locked' },
    ],
  },
];
