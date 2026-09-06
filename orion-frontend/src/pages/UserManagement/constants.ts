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
