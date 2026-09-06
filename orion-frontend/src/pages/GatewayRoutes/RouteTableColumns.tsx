/**
 * useRouteTableColumns
 * 路由表列配置 Hook（抽取自 index.tsx）
 */
import { useMemo } from 'react';
import { Typography, Tag, Space, Switch, Tooltip, Button, Popconfirm } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { componentRadius } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';
import type { GatewayRoute } from '@/api/gateway-routes';
import { HTTP_METHOD_COLORS, METHOD_LABELS } from './constants';
import dayjs from 'dayjs';

const { Text } = Typography;

export interface RouteTableColumnsProps {
  actionLoading: string | null;
  handleToggle: (id: string, enabled: boolean) => Promise<void>;
  handleView: (record: GatewayRoute) => Promise<void>;
  handleEdit: (record: GatewayRoute) => void;
  handleDelete: (id: string) => Promise<void>;
}

export const useRouteTableColumns = ({
  actionLoading,
  handleToggle,
  handleView,
  handleEdit,
  handleDelete,
}: RouteTableColumnsProps): ColumnsType<GatewayRoute> =>
  useMemo<ColumnsType<GatewayRoute>>(
    () => [
      {
        key: 'path',
        title: '路径',
        dataIndex: 'path',
        width: 220,
        ellipsis: true,
        render: (v: unknown, record: GatewayRoute) => (
          <Space>
            <Text code style={{ fontSize: 12 }}>
              {String(v)}
            </Text>
            <Tag
              color={HTTP_METHOD_COLORS[record.method] || 'default'}
              style={{ margin: 0, borderRadius: componentRadius.tag }}
            >
              {METHOD_LABELS[record.method] || record.method}
            </Tag>
          </Space>
        ),
      },
      {
        key: 'targetService',
        title: '目标服务',
        dataIndex: 'targetService',
        width: 140,
        render: (v: unknown) => <Text strong>{String(v)}</Text>,
      },
      {
        key: 'authRequired',
        title: '认证要求',
        dataIndex: 'authRequired',
        width: 100,
        render: (v: unknown) =>
          v ? (
            <Tag
              icon={<CheckCircleOutlined />}
              color="success"
              style={{ borderRadius: componentRadius.tag }}
            >
              需要
            </Tag>
          ) : (
            <Tag
              icon={<CloseCircleOutlined />}
              color="default"
              style={{ borderRadius: componentRadius.tag }}
            >
              无需
            </Tag>
          ),
      },
      {
        key: 'enabled',
        title: '状态',
        dataIndex: 'enabled',
        width: 100,
        render: (v: unknown, record: GatewayRoute) => (
          <Switch
            checked={Boolean(v)}
            onChange={(checked) => handleToggle(record.id, checked)}
            loading={actionLoading === `toggle-${record.id}`}
            size="small"
          />
        ),
      },
      {
        key: 'description',
        title: '描述',
        dataIndex: 'description',
        width: 180,
        ellipsis: true,
      },
      {
        key: 'requestCount',
        title: '请求量',
        dataIndex: 'requestCount',
        width: 100,
        render: (v: unknown) =>
          v ? (
            <Text type="secondary">{Number(v).toLocaleString()}</Text>
          ) : (
            <Text type="secondary">-</Text>
          ),
      },
      {
        key: 'errorRate',
        title: '错误率',
        dataIndex: 'errorRate',
        width: 100,
        render: (v: unknown) => {
          if (v == null) return <Text type="secondary">-</Text>;
          const rate = Number(v);
          const color = rate > 0.1 ? 'error' : rate > 0.05 ? 'warning' : 'success';
          return <Text type={color as any}>{`${(rate * 100).toFixed(1)}%`}</Text>;
        },
      },
      {
        key: 'createdAt',
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 140,
        render: (v: unknown) => dayjs(String(v)).format('YYYY-MM-DD HH:mm'),
      },
      {
        key: 'actions',
        title: '操作',
        width: 120,
        fixed: 'right' as const,
        render: (_: unknown, record: GatewayRoute) => (
          <Space size={4}>
            <Tooltip title="查看详情">
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleView(record)}
              />
            </Tooltip>
            <Tooltip title="编辑">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
            <Popconfirm
              title="确定要删除此路由吗？"
              description="删除后不可恢复"
              onConfirm={() => handleDelete(record.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="删除">
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  loading={actionLoading === `delete-${record.id}`}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [actionLoading, handleToggle, handleView, handleEdit, handleDelete]
  );
