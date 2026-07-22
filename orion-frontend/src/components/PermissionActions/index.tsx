/**
 * PermissionActions - 权限感知操作按钮组
 *
 * 用于表格行操作、页面顶部操作栏等场景，自动根据用户权限显示/隐藏/禁用按钮。
 *
 * @example
 * // 表格行操作
 * <PermissionActions
 *   resource="pipeline"
 *   actions={[
 *     { key: 'view', label: '查看', onClick: handleView },
 *     { key: 'edit', label: '编辑', onClick: handleEdit },
 *     { key: 'delete', label: '删除', onClick: handleDelete, danger: true },
 *   ]}
 * />
 *
 * @example
 * // 页面顶部操作栏
 * <PermissionActions
 *   resource="pipeline"
 *   actions={[
 *     { key: 'write', label: '新建 Pipeline', type: 'primary', onClick: handleCreate },
 *     { key: 'execute', label: '批量执行', onClick: handleBatchExecute },
 *   ]}
 * />
 */
import React from 'react';
import { Button, Space, Tooltip, Popconfirm } from 'antd';
import { usePermission } from '@/hooks/usePermission';

export interface PermissionAction {
  /** 操作标识（对应 RBAC action） */
  key: string;
  /** 按钮文本 */
  label: string;
  /** 按钮类型 */
  type?: 'primary' | 'default' | 'dashed' | 'link' | 'text';
  /** 是否危险操作 */
  danger?: boolean;
  /** 是否需要二次确认 */
  confirm?: boolean;
  /** 确认提示文本 */
  confirmText?: string;
  /** 点击事件 */
  onClick?: () => void;
  /** 是否禁用（额外条件） */
  disabled?: boolean;
  /** 图标 */
  icon?: React.ReactNode;
  /** 无权限时的显示模式：'hide' | 'disabled' | 'tooltip' */
  noPermissionMode?: 'hide' | 'disabled' | 'tooltip';
  /** 自定义无权限提示 */
  noPermissionText?: string;
  /** 按钮大小 */
  size?: 'small' | 'middle' | 'large';
}

interface PermissionActionsProps {
  /** 资源类型 */
  resource: string;
  /** 操作列表 */
  actions: PermissionAction[];
  /** 布局方向 */
  direction?: 'horizontal' | 'vertical';
  /** 间距 */
  size?: 'small' | 'middle' | 'large';
  /** 自定义渲染（完全控制按钮样式） */
  render?: (action: PermissionAction, hasPermission: boolean) => React.ReactNode;
}

export const PermissionActions: React.FC<PermissionActionsProps> = ({
  resource,
  actions,
  direction = 'horizontal',
  size = 'small',
  render,
}) => {
  const { hasPermission } = usePermission();

  const renderAction = (action: PermissionAction) => {
    const allowed = hasPermission(resource, action.key);
    const mode = action.noPermissionMode || 'disabled';
    const noPermText = action.noPermissionText || '无操作权限';

    // 自定义渲染
    if (render) {
      return render(action, allowed);
    }

    // 无权限处理
    if (!allowed) {
      switch (mode) {
        case 'hide':
          return null;
        case 'tooltip':
          return (
            <Tooltip key={action.key} title={noPermText}>
              <Button
                type={action.type || 'link'}
                size={action.size || size}
                disabled
                danger={action.danger}
                icon={action.icon}
              >
                {action.label}
              </Button>
            </Tooltip>
          );
        case 'disabled':
        default:
          return (
            <Button
              key={action.key}
              type={action.type || 'link'}
              size={action.size || size}
              disabled
              danger={action.danger}
              icon={action.icon}
            >
              {action.label}
            </Button>
          );
      }
    }

    // 有权限但额外禁用条件
    const isDisabled = action.disabled;

    // 需要二次确认
    if (action.confirm) {
      return (
        <Popconfirm
          key={action.key}
          title={action.confirmText || `确定要${action.label}吗？`}
          onConfirm={action.onClick}
          okText="确定"
          cancelText="取消"
        >
          <Button
            type={action.type || 'link'}
            size={action.size || size}
            disabled={isDisabled}
            danger={action.danger}
            icon={action.icon}
          >
            {action.label}
          </Button>
        </Popconfirm>
      );
    }

    return (
      <Button
        key={action.key}
        type={action.type || 'link'}
        size={action.size || size}
        disabled={isDisabled}
        danger={action.danger}
        icon={action.icon}
        onClick={action.onClick}
      >
        {action.label}
      </Button>
    );
  };

  return (
    <Space direction={direction} size={size}>
      {actions.map(renderAction)}
    </Space>
  );
};

export default PermissionActions;
