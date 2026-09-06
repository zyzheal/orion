/**
 * BackupColumns.tsx - Backup 表格列配置 Hook
 * 抽取自 Backup/index.tsx (P2-9 Phase 68)
 */
import { useMemo } from 'react';
import { Space, Tag, Button, Popconfirm, Typography } from 'antd';
import {
  CloudDownloadOutlined,
  ReloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { type TableColumn } from '@/components/Table';
import dayjs from 'dayjs';
import { typeIconMap, typeLabelMap } from './constants';
import type { BackupPlanItem } from './types';

const { Text } = Typography;

interface UseBackupColumnsParams {
  handleExecute: (planId: string) => void;
  handleDeletePlan: (id: string) => void;
  toggleRecords: (planId: string) => void;
  expandedRecords: Record<string, unknown[]>;
  submitting: boolean;
}

export const useBackupColumns = ({
  handleExecute,
  handleDeletePlan,
  toggleRecords,
  expandedRecords,
  submitting,
}: UseBackupColumnsParams): TableColumn<BackupPlanItem>[] => {
  return useMemo<TableColumn<BackupPlanItem>[]>(
    () => [
      {
        key: 'name',
        title: '计划名称',
        dataIndex: 'name',
        width: 240,
        sortable: true,
        render: (value: unknown, record: BackupPlanItem) => (
          <Space direction="vertical" size={0}>
            <Text strong>{String(value)}</Text>
            {record.schedule && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                调度: {record.schedule}
              </Text>
            )}
          </Space>
        ),
      },
      {
        key: 'type',
        title: '类型',
        width: 100,
        render: (_: unknown, record: BackupPlanItem) => (
          <Tag icon={typeIconMap[record.type]} color="blue">
            {typeLabelMap[record.type]}
          </Tag>
        ),
      },
      {
        key: 'enabled',
        title: '状态',
        width: 100,
        render: (_: unknown, record: BackupPlanItem) => (
          <Tag color={record.enabled ? 'success' : 'default'}>
            {record.enabled ? '启用' : '禁用'}
          </Tag>
        ),
      },
      {
        key: 'retentionDays',
        title: '保留天数',
        width: 100,
        dataIndex: 'retentionDays',
        render: (value: unknown) => (
          <Text type="secondary">{String(value)} 天</Text>
        ),
      },
      {
        key: 'createdAt',
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 160,
        sortable: true,
        render: (value: unknown) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(String(value)).format('YYYY-MM-DD HH:mm:ss')}
          </Text>
        ),
      },
      {
        key: 'actions',
        title: '操作',
        width: 260,
        render: (_: unknown, record: BackupPlanItem) => (
          <Space size="small" wrap>
            <Button
              type="link"
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={() => handleExecute(record.id)}
              loading={submitting}
            >
              执行
            </Button>
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => toggleRecords(record.id)}
            >
              {expandedRecords[record.id] ? '收起记录' : '查看记录'}
            </Button>
            <Popconfirm
              title="确认删除该计划?"
              description="删除后计划内的调度将停止"
              onConfirm={() => handleDeletePlan(record.id)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleExecute, handleDeletePlan, toggleRecords, expandedRecords, submitting],
  );
};
