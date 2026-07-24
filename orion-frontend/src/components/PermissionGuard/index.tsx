/**
 * PermissionGuard - 权限守卫组件
 *
 * 用于根据 Capability 控制组件的显示/隐藏
 *
 * @example
 * // 基础用法：没有权限时显示 fallback
 * <PermissionGuard capability="chatops:execute">
 *   <ExecuteButton />
 * </PermissionGuard>
 *
 * @example
 * // 自定义 fallback
 * <PermissionGuard
 *   capability="pipeline:delete"
 *   fallback={<Button disabled>仅管理员可删除</Button>}
 * >
 *   <DeleteButton />
 * </PermissionGuard>
 *
 * @example
 * // 使用 action 类型
 * <PermissionGuard resource="pipeline" action="execute">
 *   <RunButton />
 * </PermissionGuard>
 */

import React, { useState, useEffect } from 'react';
import { Spin, Button, Tooltip } from 'antd';
import { usePermission } from '@/hooks/usePermission';

interface PermissionGuardProps {
  /** 能力标识 (如 "chatops:execute")，优先于 resource/action */
  capability?: string;
  /** 资源类型 (如 "pipeline")，与 action 组合使用 */
  resource?: string;
  /** 操作类型 (如 "execute", "write") */
  action?: string;
  /** 环境后缀 (如 "prod")，用于命令级权限 */
  environment?: string;
  /** 无权限时的显示内容 */
  fallback?: React.ReactNode;
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 是否在无权限时禁用子元素而不是隐藏 */
  disabled?: boolean;
  /** 自定义无权限提示 */
  tooltip?: string;
  /** 子元素 */
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  capability,
  resource,
  action,
  fallback = null,
  loading = false,
  disabled = false,
  tooltip,
  children,
}) => {
  const { hasPermission } = usePermission();
  const [hasCapPermission, setHasCapPermission] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  // 确定要检查的能力标识
  const capabilityId = capability || (resource && action ? `${resource}:${action}` : null);

  useEffect(() => {
    const checkPermission = async () => {
      if (!capabilityId) {
        // 如果没有 capability，使用传统 RBAC 检查
        if (resource && action) {
          setHasCapPermission(hasPermission(resource, action));
        } else {
          setHasCapPermission(true); // 没有指定能力，默认允许
        }
        return;
      }

      // 检查用户是否有该能力
      // 优先使用本地缓存的角色权限判断
      const parts = capabilityId.split(':');
      if (parts.length >= 2) {
        const localResource = parts[0];
        const localAction = parts.slice(1).join(':');
        if (hasPermission(localResource, localAction)) {
          setHasCapPermission(true);
          return;
        }
      }

      // 如果本地没有，尝试调用后端检查
      // 注意：这会增加 API 调用，生产环境可以缓存结果
      setChecking(true);
      try {
        // 这里可以扩展为调用后端 API 进行更精细的检查
        // const result = await capabilityApi.checkPermission(...)
        // setHasCapPermission(result.data.allowed);

        // 暂时使用本地检查结果
        setHasCapPermission(hasPermission(resource || parts[0], action || parts[1]));
      } catch (error) {
        console.error('Capability check failed:', error);
        setHasCapPermission(false);
      } finally {
        setChecking(false);
      }
    };

    checkPermission();
  }, [capabilityId, resource, action, hasPermission]);

  // 加载状态
  if (loading || checking) {
    return (
      <span className="permission-guard-loading">
        <Spin size="small" />
      </span>
    );
  }

  // 有权限
  if (hasCapPermission) {
    return <>{children}</>;
  }

  // 无权限 - 显示 disabled 状态
  if (disabled && children) {
    const childElement = React.Children.only(children) as React.ReactElement;
    if (childElement && typeof childElement === 'object') {
      const disabledChild = React.cloneElement(childElement, {
        ...childElement.props,
        disabled: true,
        ...(tooltip ? { title: tooltip } : {}),
      });
      return <Tooltip title={tooltip || '无操作权限'}>{disabledChild}</Tooltip>;
    }
  }

  // 无权限 - 显示 fallback
  return <>{fallback}</>;
};

/**
 * 权限按钮包装器 - 简化常用场景
 *
 * @example
 * <PermissionButton
 *   resource="pipeline"
 *   action="execute"
 *   onClick={handleExecute}
 * >
 *   执行流水线
 * </PermissionButton>
 */
interface PermissionButtonProps {
  resource: string;
  action: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
  style?: React.CSSProperties;
}

export const PermissionButton: React.FC<PermissionButtonProps> = ({
  resource,
  action,
  children,
  onClick,
  disabled = false,
  loading = false,
  danger = false,
  style,
}) => {
  return (
    <PermissionGuard
      resource={resource}
      action={action}
      disabled={true}
      fallback={
        <Button disabled={true} danger={danger} style={style}>
          {children}
        </Button>
      }
    >
      <Button
        onClick={onClick}
        disabled={disabled}
        loading={loading}
        danger={danger}
        style={style}
      >
        {children}
      </Button>
    </PermissionGuard>
  );
};

/**
 * 权限 Tab 包装器 - 用于控制 Tab 的显示和交互
 *
 * @example
 * <PermissionTab
 *   key="settings"
 *   resource="chatops"
 *   action="write"
 * >
 *   设置
 * </PermissionTab>
 */
interface PermissionTabProps {
  key: string;
  resource: string;
  action: string;
  children: React.ReactNode;
}

export const PermissionTab: React.FC<PermissionTabProps> = ({
  key,
  resource,
  action,
  children,
}) => {
  return (
    <PermissionGuard
      resource={resource}
      action={action}
      fallback={null}
    >
      <span data-permission-tab={key}>{children}</span>
    </PermissionGuard>
  );
};

export default PermissionGuard;