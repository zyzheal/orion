/**
 * PR Trigger Management table column builders
 * 抽取自 index.tsx (P2-9 Phase 153)
 */
import { Button, Space, Switch, Tag, Typography } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  GithubOutlined,
  GitlabOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { PRTriggerRule } from '@/api/prTriggers';
import { PROVIDER_LABEL, SECURITY_LABEL } from './constants';

const { Text } = Typography;

export interface PRTriggerColumnDeps {
  pipelines: Array<{ label: string; value: string }>;
  handleEdit: (record: PRTriggerRule) => void;
  handleDelete: (ruleId: string) => void;
  handleToggle: (ruleId: string, enabled: boolean) => void;
}

export function buildPRTriggerColumns(deps: PRTriggerColumnDeps): ColumnsType<PRTriggerRule> {
  const { pipelines, handleEdit, handleDelete, handleToggle } = deps;
  return [
    {
      title: '流水线',
      dataIndex: 'pipelineId',
      key: 'pipelineId',
      width: 180,
      render: (v: string) => {
        const pipeline = pipelines.find((p) => p.value === v);
        return <Text strong>{pipeline?.label || v.slice(0, 8)}...</Text>;
      },
    },
    {
      title: '仓库',
      dataIndex: 'repository',
      key: 'repository',
      width: 200,
      ellipsis: true,
    },
    {
      title: '平台',
      dataIndex: 'provider',
      key: 'provider',
      width: 140,
      render: (v: string) => (
        <Tag color={v === 'github' ? 'default' : v === 'gitlab' ? 'orange' : 'blue'}>
          {v === 'github' && <GithubOutlined />}
          {v === 'gitlab' && <GitlabOutlined />}
          {PROVIDER_LABEL[v] || v}
        </Tag>
      ),
    },
    {
      title: '触发事件',
      dataIndex: 'prActions',
      key: 'prActions',
      width: 180,
      render: (v: string[]) => (
        <Space wrap>
          {v.slice(0, 3).map((action) => (
            <Tag key={action} color="blue">
              {action}
            </Tag>
          ))}
          {v.length > 3 && <Tag>+{v.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '目标分支',
      key: 'branches',
      width: 150,
      render: (_: unknown, record: PRTriggerRule) => (
        <Space wrap>
          {record.branchFilter?.targetBranches?.slice(0, 2).map((b: string) => (
            <Tag key={b} color="green">
              {b}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '安全级别',
      dataIndex: 'securityLevel',
      key: 'securityLevel',
      width: 100,
      render: (v: string) => <Tag>{SECURITY_LABEL[v] || v}</Tag>,
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (_: unknown, record: PRTriggerRule) => (
        <Switch
          size="small"
          checked={record.enabled}
          onChange={() => handleToggle(record.id!, record.enabled)}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: PRTriggerRule) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id!)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];
}
