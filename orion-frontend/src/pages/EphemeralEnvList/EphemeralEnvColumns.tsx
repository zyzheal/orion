/**
 * EphemeralEnvColumns.tsx - 表格列定义
 * 抽取自 EphemeralEnvList/index.tsx (P2-9 Phase 69)
 */
import { useMemo } from 'react';
import { Button, Space, Tag, Badge, Typography, Popconfirm } from 'antd';
import {
  LinkOutlined,
  PoweroffOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  CloudServerOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import { colors, spacing } from '@/tokens';
import { STATUS_TO_COLOR, STATUS_LABEL } from './constants';
import type { EphemeralEnvironment } from './types';
import dayjs from 'dayjs';

const { Text: TText } = Typography;

interface UseEphemeralEnvColumnsParams {
  handleViewDetail: (env: EphemeralEnvironment) => void;
  handleOpenPreview: (env: EphemeralEnvironment) => void;
  handleWake: (env: EphemeralEnvironment) => void;
  handleTeardown: (env: EphemeralEnvironment) => void;
  handleViewCost: (env: EphemeralEnvironment) => void;
}

export const useEphemeralEnvColumns = ({
  handleViewDetail,
  handleOpenPreview,
  handleWake,
  handleTeardown,
  handleViewCost,
}: UseEphemeralEnvColumnsParams) => {
  return useMemo<TableColumn<EphemeralEnvironment>[]>(
    () => [
      {
        key: 'namespace',
        title: '环境',
        dataIndex: 'namespace',
        width: 180,
        render: (value: unknown, record: EphemeralEnvironment) => (
          <Space direction="vertical" size={0}>
            <Button
              type="link"
              size="small"
              onClick={() => handleViewDetail(record)}
              style={{ padding: 0, height: 'auto' }}
            >
              <TText strong>{String(value)}</TText>
            </Button>
            <TText type="secondary" style={{ fontSize: spacing[2] }}>
              PR #{record.prId}
            </TText>
          </Space>
        ),
      },
      {
        key: 'repo',
        title: '仓库',
        dataIndex: 'repoId',
        width: 160,
        render: (value: unknown) => (
          <Space>
            <CloudServerOutlined style={{ color: colors.primary[500] }} />
            <TText style={{ fontSize: spacing[3] }}>{String(value)}</TText>
          </Space>
        ),
      },
      {
        key: 'branch',
        title: '分支',
        dataIndex: 'branchName',
        width: 160,
        render: (value: unknown) => <Tag color="cyan">{String(value)}</Tag>,
      },
      {
        key: 'status',
        title: '状态',
        dataIndex: 'status',
        width: 130,
        render: (value: unknown) => {
          const status = String(value);
          return (
            <Badge
              status={
                STATUS_TO_COLOR[status] as 'success' | 'processing' | 'default' | 'error' | 'warning'
              }
              text={STATUS_LABEL[status] || status}
            />
          );
        },
      },
      {
        key: 'previewUrl',
        title: 'Preview',
        dataIndex: 'previewUrl',
        width: 100,
        render: (value: unknown, record: EphemeralEnvironment) =>
          value ? (
            <Button
              type="link"
              size="small"
              icon={<LinkOutlined />}
              onClick={() => handleOpenPreview(record)}
            >
              打开
            </Button>
          ) : (
            <TText type="secondary">-</TText>
          ),
      },
      {
        key: 'resources',
        title: '资源',
        dataIndex: 'resources',
        width: 140,
        render: (value: unknown) => {
          if (!value) return <TText type="secondary">-</TText>;
          const res = value as { cpu?: string; memory?: string };
          return (
            <TText style={{ fontSize: spacing[2] }}>
              CPU: {res.cpu || '-'} / MEM: {res.memory || '-'}
            </TText>
          );
        },
      },
      {
        key: 'createdAt',
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 160,
        render: (value: unknown, record: EphemeralEnvironment) => (
          <Space direction="vertical" size={0}>
            <TText style={{ fontSize: spacing[3] }}>
              {value ? dayjs(String(value)).format('YYYY-MM-DD HH:mm') : '-'}
            </TText>
            {record.idleSince && (
              <TText type="secondary" style={{ fontSize: spacing[2] }}>
                空闲自 {dayjs(record.idleSince).format('HH:mm')}
              </TText>
            )}
          </Space>
        ),
      },
      {
        key: 'actions',
        title: '操作',
        width: 240,
        render: (_: unknown, record: EphemeralEnvironment) => {
          const isTeardownable = ['running', 'idle'].includes(record.status);
          const isWakable = record.status === 'idle';

          return (
            <Space size="small" wrap>
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleViewDetail(record)}
              >
                详情
              </Button>
              {record.previewUrl && (
                <Button
                  type="link"
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={() => handleOpenPreview(record)}
                >
                  Preview
                </Button>
              )}
              {isWakable && (
                <Button
                  type="link"
                  size="small"
                  icon={<ThunderboltOutlined />}
                  onClick={() => handleWake(record)}
                >
                  唤醒
                </Button>
              )}
              <Button
                type="link"
                size="small"
                icon={<DollarOutlined />}
                onClick={() => handleViewCost(record)}
              >
                成本
              </Button>
              {isTeardownable && (
                <Popconfirm
                  title="确认销毁"
                  description="确定要销毁该环境吗？此操作不可撤销。"
                  onConfirm={() => handleTeardown(record)}
                  okText="销毁"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button type="link" size="small" danger icon={<PoweroffOutlined />}>
                    销毁
                  </Button>
                </Popconfirm>
              )}
            </Space>
          );
        },
      },
    ],
    [handleOpenPreview, handleTeardown, handleViewCost, handleViewDetail, handleWake],
  );
};
