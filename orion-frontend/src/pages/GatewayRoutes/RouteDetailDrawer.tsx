/**
 * RouteDetailDrawer
 * 路由详情 Drawer（抽取自 index.tsx）
 */
import React from 'react';
import {
  Drawer,
  Button,
  Space,
  Tag,
  Popconfirm,
  Divider,
  Descriptions,
  Badge,
  Typography,
} from 'antd';
import {
  GatewayOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';
import type { GatewayRoute } from '@/api/gateway-routes';
import { HTTP_METHOD_COLORS, METHOD_LABELS } from './constants';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export interface RouteDetailDrawerProps {
  visible: boolean;
  loading: boolean;
  route: GatewayRoute | null;
  actionLoading: string | null;
  onClose: () => void;
  onEdit: (route: GatewayRoute) => void;
  onDelete: (id: string) => Promise<void> | void;
}

export const RouteDetailDrawer: React.FC<RouteDetailDrawerProps> = ({
  visible,
  loading,
  route,
  actionLoading,
  onClose,
  onEdit,
  onDelete,
}) => {
  if (!route) return null;

  const methodColor = HTTP_METHOD_COLORS[route.method] || 'default';
  const statusColor = route.enabled ? 'success' : 'default';
  const statusText = route.enabled ? '已启用' : '已禁用';

  return (
    <Drawer
      title={
        <Space>
          <GatewayOutlined style={{ color: colors.primary[500] }} />
          <span>路由详情</span>
        </Space>
      }
      placement="right"
      width={480}
      open={visible}
      onClose={onClose}
      extra={
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              onClose();
              onEdit(route);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除此路由吗？"
            onConfirm={() => {
              onClose();
              onDelete(route.id);
            }}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={actionLoading === `delete-${route.id}`}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: spacing.xl }}>
          <Text type="secondary">加载中...</Text>
        </div>
      ) : (
        <div>
          {/* Header info */}
          <div style={{ marginBottom: spacing.lg }}>
            <Space size={spacing.sm} style={{ marginBottom: spacing.sm }}>
              <Tag
                color={methodColor}
                style={{ borderRadius: componentRadius.tag, fontSize: 13, padding: '2px 8px' }}
              >
                {METHOD_LABELS[route.method] || route.method}
              </Tag>
              <Tag color={statusColor} style={{ borderRadius: componentRadius.tag }}>
                {statusText}
              </Tag>
              {route.authRequired && (
                <Tag color="purple" style={{ borderRadius: componentRadius.tag }}>
                  需要认证
                </Tag>
              )}
            </Space>
            <Title level={4} style={{ marginBottom: spacing.xs, fontFamily: 'monospace' }}>
              {route.path}
            </Title>
            {route.description && <Text type="secondary">{route.description}</Text>}
          </div>

          <Divider />

          {/* Descriptions */}
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="目标服务">
              <Badge status="processing" text={<Text strong>{route.targetService}</Text>} />
            </Descriptions.Item>
            {route.targetUrl && (
              <Descriptions.Item label="目标 URL">
                <Text code>{route.targetUrl}</Text>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="认证要求">
              {route.authRequired ? '需要认证' : '无需认证'}
            </Descriptions.Item>
            {route.allowedRoles && route.allowedRoles.length > 0 && (
              <Descriptions.Item label="允许的角色">
                <Space size={[4, 8]} wrap>
                  {route.allowedRoles.map((role) => (
                    <Tag key={role} style={{ borderRadius: componentRadius.tag }}>
                      {role}
                    </Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
            {route.rateLimit && (
              <Descriptions.Item label="限流配置">
                {route.rateLimit.maxRequests} 次 / {route.rateLimit.windowMs}ms
              </Descriptions.Item>
            )}
            {route.timeoutMs && (
              <Descriptions.Item label="超时时间">{route.timeoutMs}ms</Descriptions.Item>
            )}
            <Descriptions.Item label="总请求数">
              {route.requestCount?.toLocaleString() || '-'}
            </Descriptions.Item>
            {route.errorRate != null && (
              <Descriptions.Item label="错误率">
                <Text type={route.errorRate > 0.1 ? 'danger' : 'secondary'}>
                  {(route.errorRate * 100).toFixed(1)}%
                </Text>
              </Descriptions.Item>
            )}
            {route.lastRequestAt && (
              <Descriptions.Item label="最后请求时间">
                {dayjs(route.lastRequestAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间">
              {dayjs(route.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(route.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            {route.createdBy && (
              <Descriptions.Item label="创建人">{route.createdBy}</Descriptions.Item>
            )}
          </Descriptions>
        </div>
      )}
    </Drawer>
  );
};
