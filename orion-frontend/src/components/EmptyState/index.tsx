/**
 * EmptyState — 统一空状态组件
 *
 * 参考 Linear/Notion 最佳实践：
 * - 含 Illustration（简单图标/图形）+ 标题 + 描述
 * - 主操作按钮 + 次操作链接
 * - 统一视觉风格，解决 8+ 页空状态无引导问题
 *
 * @example
 *   <EmptyState
 *     title="暂无流水线"
 *     description="创建你的第一个流水线开始自动化部署"
 *     primaryAction={{ label: '新建流水线', onClick: handleCreate }}
 *     secondaryAction={{ label: '查看模板库', onClick: handleTemplate }}
 *   />
 */
import React from 'react';
import { Button, Typography, Space } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

export interface EmptyAction {
  label: string;
  onClick?: () => void;
  href?: string;
  type?: 'primary' | 'default';
}

export interface EmptyStateProps {
  /** 主标题 */
  title?: string;
  /** 描述文案 */
  description?: string;
  /** 主操作按钮 */
  primaryAction?: EmptyAction;
  /** 次操作链接 */
  secondaryAction?: EmptyAction;
  /** 自定义图标（默认 InboxOutlined） */
  icon?: React.ReactNode;
  /** 图标颜色 */
  iconColor?: string;
}

const { Text } = Typography;

const EmptyState: React.FC<EmptyStateProps> = ({
  title = '暂无数据',
  description,
  primaryAction,
  secondaryAction,
  icon = <InboxOutlined style={{ fontSize: 48 }} />,
  iconColor = colors.neutral[300],
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: `${spacing[6]} ${spacing[4]}`,
      textAlign: 'center',
      minHeight: 200,
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 96,
        height: 96,
        borderRadius: '50%',
        background: colors.light.bg.secondary,
        marginBottom: spacing.md,
      }}
    >
      {React.cloneElement(icon as React.ReactElement, {
        style: { fontSize: 48, color: iconColor },
      })}
    </div>

    <Text strong style={{ fontSize: 15, marginBottom: 4 }}>
      {title}
    </Text>
    {description && (
      <Text type="secondary" style={{ fontSize: 13, marginBottom: spacing.md }}>
        {description}
      </Text>
    )}

    <Space size="middle">
      {primaryAction && (
        <Button
          type={primaryAction.type || 'primary'}
          onClick={primaryAction.onClick}
          href={primaryAction.href}
        >
          {primaryAction.label}
        </Button>
      )}
      {secondaryAction && (
        <Button
          type="default"
          onClick={secondaryAction.onClick}
          href={secondaryAction.href}
        >
          {secondaryAction.label}
        </Button>
      )}
    </Space>
  </div>
);

export default EmptyState;
