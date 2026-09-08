/**
 * columns.tsx - 审计日志列定义
 * 抽取自 index.tsx (P2-9 Phase 208)
 */
import { Space, Button, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { AuditLogEntry } from '@/api/audit';

const { Text } = Typography;

export function buildAuditLogColumns(
  onViewDetail: (log: AuditLogEntry) => void
): ColumnsType<AuditLogEntry> {
  return [
    {
      title: '序列号',
      dataIndex: 'sequenceNumber',
      key: 'sequenceNumber',
      width: 80,
      render: (seq: number) => `#${seq}`,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      render: (text: string) => (
        <Space>
          <FileTextOutlined />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '用户 ID',
      dataIndex: 'userId',
      key: 'userId',
    },
    {
      title: '资源类型',
      dataIndex: 'resourceType',
      key: 'resourceType',
      render: (text?: string) => text || '-',
    },
    {
      title: '时间戳',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (ts: string) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '详情',
      key: 'detail',
      render: (_: unknown, record: AuditLogEntry) => (
        <Button type="link" size="small" onClick={() => onViewDetail(record)}>
          查看
        </Button>
      ),
    },
  ];
}
