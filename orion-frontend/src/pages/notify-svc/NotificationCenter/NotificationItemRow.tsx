/**
 * NotificationCenter - NotificationItemRow
 * 单条通知项渲染
 *
 * 从 index.tsx 的 renderNotificationItem() 抽出。
 * 通过 props 接收展开状态、标记已读/删除/切换展开的回调。
 */
import React from 'react';
import { Button, Space, Tag, Typography, Popconfirm } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { colors, spacing, themeVars } from '@/tokens';
import dayjs from 'dayjs';
import { typeIconMap, typeLabelMap, priorityConfig } from './constants';
import type { NotificationItem } from './constants';

const { Text, Paragraph } = Typography;

export interface NotificationItemRowProps {
  item: NotificationItem;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export const NotificationItemRow: React.FC<NotificationItemRowProps> = ({
  item,
  isExpanded,
  onToggleExpand,
  onMarkAsRead,
  onDelete,
}) => {
  const priorityConf = priorityConfig[item.priority];
  const typeIcon = typeIconMap[item.type] || <BellOutlined style={{ fontSize: spacing[5] }} />;
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
    <div
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
          onMarkAsRead(item.id);
        }
        onToggleExpand(item.id);
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
            ellipsis={{ rows: isExpanded ? 10 : 2, tooltip: !isExpanded }}
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
          {isExpanded && (
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
                      type={
                        action.type as
                          | 'primary'
                          | 'default'
                          | 'link'
                          | 'text'
                          | 'dashed'
                          | undefined
                      }
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
                    onClick={() => onMarkAsRead(item.id)}
                  >
                    标记已读
                  </Button>
                )}
                <Popconfirm
                  title="确定删除此通知？"
                  onConfirm={() => onDelete(item.id)}
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
    </div>
  );
};
