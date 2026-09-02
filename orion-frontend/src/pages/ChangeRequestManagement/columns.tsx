/**
 * Change Request Management - Table Columns
 *
 * Factory function that builds the ColumnsType<ChangeRequest>
 * for the main table. Accepts handler callbacks used by
 * column renders and action buttons.
 */
import { Badge, Button, Popconfirm, Space, Tag } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { ChangeRequest } from '@/api/change-requests';
import {
  changeTypeLabel,
  impactScopeLabel,
  riskLevelColor,
  riskLevelLabel,
  statusColor,
  statusLabel,
} from './config';

/** Handler callback signature expected by the columns factory. */
export interface ChangeRequestColumnsHandlers {
  handleViewDetail: (record: ChangeRequest) => void;
  handleAIRisk: (record: ChangeRequest) => void;
  handleEdit: (record: ChangeRequest) => void;
  handleSubmitForApproval: (id: string) => void;
  handleStartExecution: (record: ChangeRequest) => void;
  handleViewExecution: (record: ChangeRequest) => void;
  handleDelete: (id: string) => void;
}

export const buildColumns = (handlers: ChangeRequestColumnsHandlers): ColumnsType<ChangeRequest> =>
  [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record) => (
        <a onClick={() => handlers.handleViewDetail(record)}>{text}</a>
      ),
    },
    {
      title: '变更类型',
      dataIndex: 'changeType',
      key: 'changeType',
      width: 100,
      render: (val: string) => <Tag>{changeTypeLabel[val] ?? val}</Tag>,
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 80,
      render: (val: string) => <Tag color={riskLevelColor[val]}>{riskLevelLabel[val] ?? val}</Tag>,
    },
    {
      title: '影响范围',
      dataIndex: 'impactScope',
      key: 'impactScope',
      width: 80,
      render: (val: string | null) => (val ? <Tag>{impactScopeLabel[val] ?? val}</Tag> : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (val: string) => (
        <Badge status={statusColor[val] as any} text={statusLabel[val] ?? val} />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 300,
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handlers.handleViewDetail(record)}>
            详情
          </Button>
          <Button type="link" icon={<ThunderboltOutlined />} onClick={() => handlers.handleAIRisk(record)}>
            AI 风险
          </Button>
          {record.status === 'draft' && (
            <>
              <Button type="link" icon={<EditOutlined />} onClick={() => handlers.handleEdit(record)}>
                编辑
              </Button>
              <Button
                type="link"
                icon={<SendOutlined />}
                onClick={() => handlers.handleSubmitForApproval(record.id)}
              >
                提交
              </Button>
            </>
          )}
          {record.status === 'approved' && (
            <Button
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => handlers.handleStartExecution(record)}
            >
              执行
            </Button>
          )}
          {record.status === 'implementing' && (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handlers.handleViewExecution(record)}
            >
              进度
            </Button>
          )}
          {['draft', 'rejected', 'cancelled'].includes(record.status) && (
            <Popconfirm title="确认删除？" onConfirm={() => handlers.handleDelete(record.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];
