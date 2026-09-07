/**
 * RDM table column builders
 * 抽取自 index.tsx (P2-9 Phase 155)
 */
import { Button, Space, Tag, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import { PRIORITY_MAP, STATUS_MAP } from './constants';
import type { TabKey } from './types';

interface ColumnDeps {
  handleEdit: (record: any) => void;
  handleDelete: (id: string) => void;
}

function tagRender(map: Record<string, { color: string; label: string }>) {
  return (_: unknown, record: Record<string, unknown>) => {
    const v = record.status as string;
    return <Tag color={map[v]?.color}>{map[v]?.label || v}</Tag>;
  };
}

function priorityRender(_: unknown, record: Record<string, unknown>) {
  const v = record.priority as string;
  return <Tag color={PRIORITY_MAP[v]?.color}>{PRIORITY_MAP[v]?.label || v}</Tag>;
}

function severityRender(_: unknown, record: Record<string, unknown>) {
  const v = record.severity as string;
  return <Tag color={PRIORITY_MAP[v]?.color}>{v}</Tag>;
}

export function buildColumnsForTab(activeTab: TabKey): TableColumn[] {
  switch (activeTab) {
    case 'requirements':
      return [
        { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
        { title: '优先级', dataIndex: 'priority', key: 'priority', render: priorityRender },
        { title: '状态', dataIndex: 'status', key: 'status', render: tagRender(STATUS_MAP) },
        { title: 'Story Points', dataIndex: 'storyPoints', key: 'storyPoints', width: 100 },
        { title: '经办人', dataIndex: 'assignee', key: 'assignee' },
      ];
    case 'defects':
      return [
        { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
        { title: '严重程度', dataIndex: 'severity', key: 'severity', render: severityRender },
        { title: '状态', dataIndex: 'status', key: 'status', render: tagRender(STATUS_MAP) },
        { title: '经办人', dataIndex: 'assignee', key: 'assignee' },
      ];
    case 'sprints':
      return [
        { title: '名称', dataIndex: 'name', key: 'name' },
        { title: '状态', dataIndex: 'status', key: 'status', render: tagRender(STATUS_MAP) },
        { title: '开始日期', dataIndex: 'startDate', key: 'startDate' },
        { title: '结束日期', dataIndex: 'endDate', key: 'endDate' },
      ];
    case 'tasks':
      return [
        { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
        { title: '状态', dataIndex: 'status', key: 'status', render: tagRender(STATUS_MAP) },
        { title: '经办人', dataIndex: 'assignee', key: 'assignee' },
      ];
  }
}

export function buildActionColumn(deps: ColumnDeps): TableColumn {
  return {
    title: '操作',
    key: 'action',
    width: 180,
    render: (_: unknown, record: any) => (
      <Space>
        <Tooltip title="编辑">
          <Button type="link" icon={<EditOutlined />} onClick={() => deps.handleEdit(record)} />
        </Tooltip>
        <Tooltip title="删除">
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => deps.handleDelete(record.id)}
          />
        </Tooltip>
      </Space>
    ),
  };
}
