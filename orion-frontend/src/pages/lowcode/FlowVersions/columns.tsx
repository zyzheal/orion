/**
 * FlowVersions columns
 * 抽取自 index.tsx (P2-9 Phase 184)
 */
import { Button, Space, Tag, Tooltip, Popconfirm, Typography } from 'antd';
import { EyeOutlined, RollbackOutlined } from '@ant-design/icons';
import type { LowcodeFlowVersion } from '@/api/lowcode';
import dayjs from 'dayjs';

const { Text } = Typography;

interface ColumnsDeps {
  onViewVersion: (version: LowcodeFlowVersion) => void;
  onRestoreVersion: (version: LowcodeFlowVersion) => void;
}

export const buildVersionColumns = ({ onViewVersion, onRestoreVersion }: ColumnsDeps) => [
  {
    title: '版本号',
    dataIndex: 'version',
    key: 'version',
    width: 100,
    render: (v: string) => <Tag color="blue">{v}</Tag>,
  },
  {
    title: '变更说明',
    dataIndex: 'changeLog',
    key: 'changeLog',
    ellipsis: true,
    render: (text?: string) => text || <Text type="secondary">无说明</Text>,
  },
  {
    title: '创建人',
    dataIndex: 'createdBy',
    key: 'createdBy',
    width: 120,
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
    render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    sorter: (a: LowcodeFlowVersion, b: LowcodeFlowVersion) =>
      dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    fixed: 'right' as const,
    render: (_: unknown, record: LowcodeFlowVersion) => (
      <Space size="small">
        <Tooltip title="查看快照">
          <Button size="small" icon={<EyeOutlined />} onClick={() => onViewVersion(record)} />
        </Tooltip>
        <Popconfirm
          title="恢复到此版本"
          description="恢复后将用该版本的节点/连线覆盖当前流程，确定吗？"
          onConfirm={() => onRestoreVersion(record)}
          okText="恢复"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Tooltip title="恢复此版本">
            <Button size="small" danger icon={<RollbackOutlined />} />
          </Tooltip>
        </Popconfirm>
      </Space>
    ),
  },
];
