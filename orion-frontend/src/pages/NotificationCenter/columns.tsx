/**
 * NotificationCenter - List item column renderer
 *
 * `NotificationListRenderer` renders a single notification row. Because the row
 * needs live handler callbacks and the set of expanded ids, it is constructed
 * through the `createNotificationListRenderer` factory so the parent stays thin.
 */
import * as React from 'react';
import { Typography, Button, List, Tag, Space, Empty, Popconfirm } from 'antd';
import dayjs from 'dayjs';
import { colors, spacing, themeVars } from '@/tokens';
import {
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { priorityConfig, typeIconMap, typeLabelMap } from './config';
import type { NotificationItem, NotificationButtonKind } from './types';

const { Text, Paragraph } = Typography;

// ============================================================================
// Renderer factory (handler-dependent)
// ============================================================================

export interface NotificationRendererDeps {
  /** True when the given notification id is currently expanded */
  isExpanded: (id: string) => boolean;
  handleMarkAsRead: (id: string) => void;
  handleDelete: (id: string) => void;
  toggleExpand: (id: string) => void;
}

/**
 * Factory: returns the list item renderer bound to the current handlers.
 * Re-created by `useMemo` whenever the handler/expanded state changes.
 */
export const createNotificationListRenderer = (
  deps: NotificationRendererDeps
): React.FC<{ item: NotificationItem }> => {
  const { isExpanded, handleMarkAsRead, handleDelete, toggleExpand } = deps;

  return function NotificationListRenderer({ item }: { item: NotificationItem }) {
    const expanded = isExpanded(item.id);
    const priorityConf = priorityConfig[item.priority];
    const typeIcon = typeIconMap[item.type] || <BellOutlined style={{ fontSize: spacing[5] } } />;
    const typeLabel = typeLabelMap[item.type] || item.type;

    // Background color for priority (only critical and high)
    const hasPriorityBg = item.priority === 'critical' || item.priority === 'high';
    const bgColor = hasPriorityBg
      ? priorityConf.bg
      : item.read
        ? 'transparent'
        : 'rgba(24, 144, 255, 0.02)';
    const borderLeft = item.read ? '3px solid transparent' : `3px solid ${priorityConf.color}`;

    return (
      <List.Item
        style={{
          padding: spacing.md,
          background: bgColor,
          borderLeft,
          borderRadius: 8,
          marginBottom: spacing.sm,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={() => {
          if (!item.read) {
            handleMarkAsRead(item.id);
          }
          toggleExpand(item.id);
        }}
      >
        <Space align="start" style={{ width: '100%' }} size={12}>
          {/* Icon */}
          <div style={{ marginTop: 2, flexShrink: 0 }}>{typeIcon}</div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Title row */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 4 }}
            >
              <Text
                strong={!item.read}
                style={{
                  fontSize: spacing[4],
                  color: item.read ? undefined : colors.neutral[900],
                  flex: 1,
                }}
                ellipsis={{ tooltip: item.title }}
              >
                {item.title}
              </Text>
              {/* Priority badge */}
              <Tag color={priorityConf.color} style={{ fontSize: spacing[2], margin: 0 }}>
                {priorityConf.label}
              </Tag>
              {/* Type tag */}
              <Tag style={{ fontSize: spacing[2], margin: 0 }}>{typeLabel}</Tag>
              {/* Unread dot */}
              {!item.read && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: colors.primary[500],
                    flexShrink: 0,
                  }}
                />
              )}
            </div>

            {/* Content (truncated) */}
            <Paragraph
              ellipsis={{ rows: expanded ? 10 : 2, tooltip: !expanded }}
              style={{ margin: '4px 0 8px', fontSize: spacing[3], color: colors.neutral[500] }}
            >
              {item.content}
            </Paragraph>

            {/* Meta row */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}
            >
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                {item.sender}
              </Text>
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                {dayjs(item.createdAt).fromNow()}
              </Text>
              {item.relatedId && (
                <Text type="secondary" style={{ fontSize: spacing[3], color: colors.primary[500] }}>
                  关联: {item.relatedId}
                </Text>
              )}
            </div>

            {/* Expanded actions */}
            {expanded && (
              <div
                style={{
                  marginTop: spacing[3],
                  borderTop: `1px solid ${themeVars.borderLight}`,
                  paddingTop: spacing[3],
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {item.actions && item.actions.length > 0 && (
                  <Space style={{ marginBottom: spacing.sm }}>
                    {item.actions.map((action, idx) => (
                      <Button
                        key={String(idx)}
                        type={action.type as NotificationButtonKind}
                        size="small"
                      >
                        {action.label}
                      </Button>
                    ))}
                  </Space>
                )}
                <Space>
                  {!item.read && (
                    <Button
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => handleMarkAsRead(item.id)}
                    >
                      标记已读
                    </Button>
                  )}
                  <Popconfirm
                    title="确定删除此通知？"
                    onConfirm={() => handleDelete(item.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              </div>
            )}
          </div>
        </Space>
      </List.Item>
    );
  };
};

// ============================================================================
// Empty state
// ============================================================================

export const renderEmptyState = (): JSX.Element => (
  <Empty
    image={Empty.PRESENTED_IMAGE_SIMPLE}
    description="暂无通知"
    style={{ padding: '48px 0' }}
  />
);
