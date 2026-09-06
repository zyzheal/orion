/**
 * useEnvironmentColumns
 * 环境表格列配置 Hook（抽取自 EnvironmentPage.tsx）
 */
import { useMemo } from 'react';
import { Typography, Space, Tag, Switch, Tooltip, Button, Popconfirm } from 'antd';

const { Text } = Typography;
import {
  EditOutlined,
  CloudServerOutlined,
  DeleteOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import type { Environment } from '@/api/environments';
import EnvironmentLockBadge from '@/components/environment/EnvironmentLockBadge';
import dayjs from 'dayjs';
import { typeColorMap, typeLabelMap, statusColorMap, statusLabelMap } from './constants';

export interface EnvironmentColumnsProps {
  openDetail: (env: Environment) => void;
  openEdit: (env: Environment) => void;
  loadData: () => void;
  handleDelete: (id: string) => Promise<void>;
  handleStatusChange: (id: string, status: Environment['status']) => Promise<void>;
  handleLock: (id: string) => Promise<void>;
  handleUnlock: (id: string) => Promise<void>;
}

export const useEnvironmentColumns = ({
  openDetail,
  openEdit,
  loadData,
  handleDelete,
  handleStatusChange,
  handleLock,
  handleUnlock,
}: EnvironmentColumnsProps): TableColumn<Environment>[] =>
  useMemo<TableColumn<Environment>[]>(
    () => [
      {
        key: 'name',
        title: '环境名称',
        dataIndex: 'name',
        width: 180,
        render: (v: unknown, record: Environment) => (
          <Space direction="vertical" size={0}>
            <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
              <CloudServerOutlined style={{ marginRight: 6, color: typeColorMap[record.type] }} />
              {String(v)}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.project_id}
            </Text>
          </Space>
        ),
      },
      {
        key: 'type',
        title: '类型',
        width: 100,
        render: (_: unknown, record: Environment) => (
          <Tag color={typeColorMap[record.type] || 'default'}>
            {typeLabelMap[record.type] || record.type}
          </Tag>
        ),
      },
      {
        key: 'status',
        title: '状态',
        width: 100,
        render: (_: unknown, record: Environment) => (
          <Tag color={statusColorMap[record.status] || 'default'}>
            {statusLabelMap[record.status] || record.status}
          </Tag>
        ),
      },
      {
        key: 'locked',
        title: '锁定',
        width: 80,
        render: (_: unknown, record: Environment) => (
          <EnvironmentLockBadge
            envId={record.id}
            envName={record.name}
            initialLockInfo={{
              locked: !!(record as { locked?: boolean }).locked,
              lockedBy: (record as { locked_by?: string }).locked_by,
              lockedAt: (record as { locked_at?: string }).locked_at,
              reason: (record as { locked_reason?: string }).locked_reason,
            }}
            showActions
            onLockChange={() => loadData()}
          />
        ),
      },
      {
        key: 'cluster',
        title: '集群',
        width: 140,
        render: (_: unknown, record: Environment) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.cluster || '-'}
          </Text>
        ),
      },
      {
        key: 'namespace',
        title: '命名空间',
        width: 120,
        render: (_: unknown, record: Environment) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.namespace || '-'}
          </Text>
        ),
      },
      {
        key: 'hibernate',
        title: '休眠',
        width: 80,
        render: (_: unknown, record: Environment) => {
          const config = record.config as {
            autoSleep?: boolean;
            ttlHours?: number;
            replicas?: number;
            resources?: Record<string, unknown>;
          };
          const autoSleep = config?.autoSleep;
          return (
            <Switch
              size="small"
              checked={!!autoSleep}
              checkedChildren="自动"
              unCheckedChildren="手动"
            />
          );
        },
      },
      {
        key: 'ttl',
        title: 'TTL',
        width: 100,
        render: (_: unknown, record: Environment) => {
          const config = record.config as {
            ttlHours?: number;
            replicas?: number;
            resources?: Record<string, unknown>;
          };
          const ttl = config?.ttlHours;
          return ttl ? (
            <Tooltip title={`${ttl} 小时后自动销毁`}>
              <Tag icon={<ClockCircleOutlined />}>{ttl}h</Tag>
            </Tooltip>
          ) : (
            <Text type="secondary">-</Text>
          );
        },
      },
      {
        key: 'updatedAt',
        title: '更新时问',
        dataIndex: 'updated_at',
        width: 140,
        render: (v: unknown) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {v ? dayjs(String(v)).format('YYYY-MM-DD HH:mm') : '-'}
          </Text>
        ),
      },
      {
        key: 'actions',
        title: '操作',
        width: 300,
        render: (_: unknown, record: Environment) => {
          const isLocked = (record as { locked?: boolean }).locked;
          return (
            <Space size="small" wrap>
              <Tooltip title="详情">
                <Button
                  type="link"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => openDetail(record)}
                >
                  详情
                </Button>
              </Tooltip>
              <Tooltip title="编辑">
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEdit(record)}
                />
              </Tooltip>
              {record.status === 'active' && (
                <Tooltip title="休眠">
                  <Button
                    type="link"
                    size="small"
                    icon={<PauseCircleOutlined />}
                    onClick={() => handleStatusChange(record.id, 'inactive')}
                  >
                    休眠
                  </Button>
                </Tooltip>
              )}
              {record.status === 'inactive' && (
                <Tooltip title="唤醒">
                  <Button
                    type="link"
                    size="small"
                    icon={<PlayCircleOutlined />}
                    onClick={() => handleStatusChange(record.id, 'active')}
                  >
                    唤醒
                  </Button>
                </Tooltip>
              )}
              {record.status === 'active' && (
                <Tooltip title="设为维护中">
                  <Button
                    type="link"
                    size="small"
                    onClick={() => handleStatusChange(record.id, 'maintenance')}
                  >
                    维护
                  </Button>
                </Tooltip>
              )}
              {!isLocked ? (
                <Popconfirm
                  title="确认锁定环境?"
                  description="锁定后将无法向此环境部署应用"
                  onConfirm={() => handleLock(record.id)}
                >
                  <Tooltip title="锁定环境">
                    <Button type="link" size="small" icon={<LockOutlined />}>
                      锁定
                    </Button>
                  </Tooltip>
                </Popconfirm>
              ) : (
                <Popconfirm
                  title="确认解锁环境?"
                  description="解锁后将允许向此环境部署应用"
                  onConfirm={() => handleUnlock(record.id)}
                >
                  <Tooltip title="解锁环境">
                    <Button type="link" size="small" icon={<UnlockOutlined />}>
                      解锁
                    </Button>
                  </Tooltip>
                </Popconfirm>
              )}
              <Tooltip title="删除">
                <Popconfirm
                  title="确认删除该环境?"
                  description="删除后不可恢复，请确认"
                  onConfirm={() => handleDelete(record.id)}
                >
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Tooltip>
            </Space>
          );
        },
      },
    ],
    [handleDelete, handleLock, handleStatusChange, handleUnlock, openDetail, openEdit, loadData]
  );
