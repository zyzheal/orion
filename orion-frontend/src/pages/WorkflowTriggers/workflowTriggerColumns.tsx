/**
 * WorkflowTriggers table columns
 * 抽取自 index.tsx (P2-9 Phase 131)
 */
import { Typography, Tag, Space, Button, Switch, Tooltip, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import type { WorkflowTrigger, WorkflowTriggerType } from '@/api/workflow-trigger';
import type { WorkflowDefinition } from '@/api/workflow';
import { TRIGGER_TYPE_CONFIG } from './constants';

const { Text } = Typography;

interface WorkflowTriggerColumnsDeps {
  workflows: WorkflowDefinition[];
  handleToggle: (trigger: WorkflowTrigger) => void;
  openEdit: (trigger: WorkflowTrigger) => void;
  handleDelete: (id: string) => void;
}

export const buildWorkflowTriggerColumns = ({
  workflows,
  handleToggle,
  openEdit,
  handleDelete,
}: WorkflowTriggerColumnsDeps): TableColumn<WorkflowTrigger>[] => [
  {
    key: 'name',
    title: '名称',
    dataIndex: 'name',
    width: 180,
    render: (v: unknown) => <Text strong>{String(v)}</Text>,
  },
  {
    key: 'type',
    title: '类型',
    dataIndex: 'type',
    width: 120,
    render: (v: unknown) => {
      const cfg = TRIGGER_TYPE_CONFIG[v as WorkflowTriggerType] ?? {
        color: 'default',
        label: String(v),
        icon: null,
      };
      return (
        <Tag color={cfg.color} icon={cfg.icon}>
          {cfg.label}
        </Tag>
      );
    },
  },
  {
    key: 'workflowId',
    title: '关联工作流',
    dataIndex: 'workflowId',
    width: 150,
    render: (v: unknown) => {
      const wf = workflows.find((w) => w.id === v);
      return wf ? (
        <Text ellipsis style={{ maxWidth: 130 }}>
          {wf.name}
        </Text>
      ) : (
        String(v)
      );
    },
  },
  {
    key: 'condition',
    title: '触发条件',
    width: 200,
    render: (_: unknown, record?: WorkflowTrigger) => {
      if (!record) return null;
      if (record.type === 'cron' && record.cronExpression) {
        return (
          <Text code style={{ fontSize: 12 }}>
            {record.cronExpression}
          </Text>
        );
      }
      if (record.type === 'event' && record.eventType) {
        return <Tag>{record.eventType}</Tag>;
      }
      if (record.type === 'webhook' && record.webhookPath) {
        return (
          <Text code style={{ fontSize: 11 }}>
            {record.webhookPath}
          </Text>
        );
      }
      return <Text type="secondary">-</Text>;
    },
  },
  {
    key: 'enabled',
    title: '状态',
    dataIndex: 'enabled',
    width: 80,
    render: (v: unknown) => (v ? <Tag color="success">启用</Tag> : <Tag>禁用</Tag>),
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    dataIndex: 'updatedAt',
    width: 160,
    render: (v: unknown) => (v ? new Date(String(v)).toLocaleString('zh-CN') : '-'),
  },
  {
    key: 'actions',
    title: '操作',
    width: 180,
    render: (_: unknown, record?: WorkflowTrigger) =>
      record ? (
        <Space size="small">
          <Tooltip title={record.enabled ? '禁用' : '启用'}>
            <Switch
              size="small"
              checked={record.enabled}
              onChange={() => handleToggle(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Popconfirm title="确认删除该触发器?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ) : null,
  },
];
