/**
 * EvalSetColumns.tsx - EvalSet 表格列定义
 * 抽取自 EvalSetManagement/index.tsx (P2-9 Phase 60)
 */
import { useMemo } from 'react';
import { Space, Tag, Button, Popconfirm, Typography } from 'antd';
import { EyeOutlined, PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { statusColor, statusLabel } from './constants';
import type { EvalSet, EvalRun } from './types';

const { Text } = Typography;

export interface EvalSetColumnHandlers {
  runLoading: string | null;
  handleViewSet: (id: string) => void;
  handleRunEval: (setId: string, setName: string) => void;
  handleDeleteSet: (id: string, name: string) => void;
}

export const useEvalSetColumns = (
  handlers: EvalSetColumnHandlers,
): ColumnsType<EvalSet> => {
  const { runLoading, handleViewSet, handleRunEval, handleDeleteSet } = handlers;

  return useMemo<ColumnsType<EvalSet>>(
    () => [
      {
        title: '评测集名称',
        dataIndex: 'name',
        key: 'name',
        render: (val: string, record: EvalSet) => (
          <Space>
            <Text strong>{val}</Text>
            {record.is_active && <Tag color="green">活跃</Tag>}
          </Space>
        ),
      },
      {
        title: '描述',
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
      },
      {
        title: '版本',
        dataIndex: 'version',
        key: 'version',
        render: (val: number) => <Tag>v{val}</Tag>,
        width: 60,
      },
      {
        title: '用例数',
        key: 'cases',
        render: (_, record: EvalSet) => record.cases?.length ?? 0,
        width: 80,
      },
      {
        title: '创建人',
        dataIndex: 'created_by',
        key: 'created_by',
        width: 100,
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 160,
      },
      {
        title: '操作',
        key: 'actions',
        width: 220,
        render: (_, record: EvalSet) => (
          <Space size="small">
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewSet(record.id)}>
              查看
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={runLoading === record.id}
              onClick={() => handleRunEval(record.id, record.name)}
            >
              运行
            </Button>
            <Popconfirm
              title="确定删除此评测集？"
              onConfirm={() => handleDeleteSet(record.id, record.name)}
              okText="确定"
              cancelText="取消"
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [runLoading, handleViewSet, handleRunEval, handleDeleteSet],
  );
};

export const useRunColumns = (): ColumnsType<EvalRun> => {
  return useMemo<ColumnsType<EvalRun>>(
    () => [
      {
        title: 'Run ID',
        dataIndex: 'id',
        key: 'id',
        render: (val: string) => (
          <Text code style={{ fontSize: 11 }}>
            {val.slice(0, 8)}...
          </Text>
        ),
        width: 100,
      },
      {
        title: '评测集',
        dataIndex: 'set_id',
        key: 'set_id',
        render: (val: string) => (
          <Text code style={{ fontSize: 11 }}>
            {val.slice(0, 8)}
          </Text>
        ),
        width: 100,
      },
      {
        title: '模型',
        dataIndex: 'model',
        key: 'model',
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 80,
        render: (val: string) => (
          <Tag color={statusColor[val] || 'default'}>{statusLabel[val] || val}</Tag>
        ),
      },
      {
        title: '通过率',
        key: 'pass_rate',
        width: 100,
        render: (_, record: EvalRun) => {
          const rate = record.total_count > 0 ? (record.pass_count / record.total_count) * 100 : 0;
          return <Text>{rate.toFixed(1)}%</Text>;
        },
      },
      {
        title: '平均 Recall',
        dataIndex: 'avg_recall',
        key: 'avg_recall',
        width: 100,
        render: (val: number) => (val !== undefined ? val.toFixed(3) : '-'),
      },
      {
        title: '平均 Score',
        dataIndex: 'avg_score',
        key: 'avg_score',
        width: 100,
        render: (val: number) => (val !== undefined ? val.toFixed(3) : '-'),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 160,
      },
    ],
    [],
  );
};
