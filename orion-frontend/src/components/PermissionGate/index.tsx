import React from 'react';
import { usePermission } from '@/hooks/usePermission';

interface PermissionGateProps {
  resource: string;
  action: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * 权限门控组件 - 基于 RBAC 控制子元素显示
 *
 * @example
 * // 基础用法：检查删除权限
 * <PermissionGate resource="project" action="delete" fallback={<Button disabled>删除</Button>}>
 *   <Button danger onClick={handleDelete}>删除</Button>
 * </PermissionGate>
 *
 * @example
 * // 无 fallback 时，不渲染任何内容
 * <PermissionGate resource="pipeline" action="execute">
 *   <Button type="primary" onClick={handleExecute}>执行</Button>
 * </PermissionGate>
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  resource,
  action,
  fallback = null,
  children,
}) => {
  const { hasPermission } = usePermission();

  if (!hasPermission(resource, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default PermissionGate;