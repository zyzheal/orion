import { useMemo } from 'react';
import { usePermission } from './usePermission';

/**
 * 权限感知的操作配置
 */
export interface PermissionActionConfig {
  /** 资源类型 */
  resource: string;
  /** 操作类型 */
  action: string;
  /** 操作标签 */
  label: string;
  /** 是否危险操作（需要确认） */
  danger?: boolean;
  /** 自定义提示 */
  tooltip?: string;
}

/**
 * 权限操作结果
 */
export interface PermissionActionResult {
  /** 是否有权限 */
  hasPermission: boolean;
  /** 操作配置 */
  config: PermissionActionConfig;
  /** 禁用提示 */
  disabledTooltip?: string;
}

/**
 * 权限操作 Hook - 提供按钮级权限控制
 *
 * @example
 * const { checkAction, getActionProps } = usePermissionActions('pipeline');
 *
 * // 检查单个操作
 * const canDelete = checkAction('delete');
 *
 * // 获取按钮属性（自动处理 disabled + tooltip）
 * const deleteProps = getActionProps('delete', { onClick: handleDelete });
 * <Button {...deleteProps}>删除</Button>
 */
export function usePermissionActions(resource: string) {
  const { hasPermission, canView, canEdit, canDelete, canExecute, canApprove, canManage } = usePermission();

  const checkAction = useMemo(() => {
    return (action: string): boolean => {
      return hasPermission(resource, action);
    };
  }, [resource, hasPermission]);

  const getActionProps = useMemo(() => {
    return (action: string, extraProps: Record<string, any> = {}) => {
      const allowed = hasPermission(resource, action);
      return {
        ...extraProps,
        disabled: !allowed || extraProps.disabled,
        title: allowed ? extraProps.title : '无操作权限',
        style: {
          ...extraProps.style,
          ...(!allowed ? { cursor: 'not-allowed', opacity: 0.5 } : {}),
        },
      };
    };
  }, [resource, hasPermission]);

  const getButtonProps = useMemo(() => {
    return (action: string, extraProps: Record<string, any> = {}) => {
      const allowed = hasPermission(resource, action);
      return {
        ...extraProps,
        disabled: !allowed || extraProps.disabled,
        title: allowed ? extraProps.title : '无操作权限',
      };
    };
  }, [resource, hasPermission]);

  return {
    canView: canView(resource),
    canEdit: canEdit(resource),
    canDelete: canDelete(resource),
    canExecute: canExecute(resource),
    canApprove: canApprove(resource),
    canManage: canManage(resource),
    checkAction,
    getActionProps,
    getButtonProps,
  };
}

/**
 * 多资源权限检查 Hook
 *
 * @example
 * const { hasAnyPermission, hasAllPermissions } = useMultiPermission();
 * const canManage = hasAnyPermission([
 *   { resource: 'pipeline', action: 'write' },
 *   { resource: 'pipeline', action: 'manage' },
 * ]);
 */
export function useMultiPermission() {
  const { hasPermission } = usePermission();

  const hasAnyPermission = useMemo(() => {
    return (checks: Array<{ resource: string; action: string }>): boolean => {
      return checks.some(({ resource, action }) => hasPermission(resource, action));
    };
  }, [hasPermission]);

  const hasAllPermissions = useMemo(() => {
    return (checks: Array<{ resource: string; action: string }>): boolean => {
      return checks.every(({ resource, action }) => hasPermission(resource, action));
    };
  }, [hasPermission]);

  return { hasAnyPermission, hasAllPermissions };
}
