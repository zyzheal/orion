/**
 * FormInstancePipeline table columns
 * 抽取自 index.tsx (P2-9 Phase 176)
 */
import { Button, Space, Tag, Popconfirm } from 'antd';
import { EyeOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { FormInstance } from '@/api/lowcode';
import { STATUS_CONFIG } from './constants';

interface ColumnsDeps {
  handleViewDetail: (inst: FormInstance) => void;
  handleApprove: (id: string, action: 'approve' | 'reject') => void;
}

export function buildColumns({ handleViewDetail, handleApprove }: ColumnsDeps): ColumnsType<FormInstance> {
  return [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const cfg = STATUS_CONFIG[v];
        return <Tag color={cfg?.color}>{cfg?.label || v}</Tag>;
      },
    },
    {
      title: '提交者',
      dataIndex: 'submittedBy',
      key: 'submittedBy',
      width: 100,
    },
    {
      title: '审批人',
      dataIndex: 'approvedBy',
      key: 'approvedBy',
      width: 100,
      render: (v: string) => v || '-',
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 160,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '审批时间',
      dataIndex: 'approvedAt',
      key: 'approvedAt',
      width: 160,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: FormInstance) => (
        <Space>
          <Button
            size="small"
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {(record.status === 'submitted' || record.status === 'pending') && (
            <>
              <Popconfirm
                title="确认审批通过？"
                onConfirm={() => handleApprove(record.id, 'approve')}
              >
                <Button size="small" type="link" icon={<CheckOutlined />}>
                  通过
                </Button>
              </Popconfirm>
              <Popconfirm title="确认拒绝？" onConfirm={() => handleApprove(record.id, 'reject')}>
                <Button size="small" type="link" danger icon={<CloseOutlined />}>
                  拒绝
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];
}
