/**
 * ExpandedRow.tsx - Backup 表格展开行渲染组件
 * 抽取自 Backup/index.tsx (P2-9 Phase 68)
 */
import React from 'react';
import { Space, Tag, Button, Popconfirm, Typography } from 'antd';
import { RollbackOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { statusColorMap, statusLabelMap, formatSize } from './constants';
import type { BackupRecord } from './types';

const { Text } = Typography;

interface ExpandedRowProps {
  records: BackupRecord[];
  openRestore: (record: BackupRecord) => void;
  handleDeleteRecord: (planId: string, recordId: string) => void;
  planId: string;
}

export const ExpandedRow: React.FC<ExpandedRowProps> = ({
  records,
  openRestore,
  handleDeleteRecord,
  planId,
}) => {
  if (records.length === 0) return <Text type="secondary">暂无备份记录</Text>;

  return (
    <div style={{ padding: '8px 0' }}>
      {records.map((r) => (
        <div
          key={r.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 0',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Space>
            <Tag color={statusColorMap[r.status]}>{statusLabelMap[r.status]}</Tag>
            <Text>{r.id.slice(0, 8)}...</Text>
            <Text type="secondary">{formatSize(r.size)}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(r.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          </Space>
          <Space size="small">
            <Button type="link" size="small" icon={<RollbackOutlined />} onClick={() => openRestore(r)}>
              恢复
            </Button>
            <Popconfirm
              title="确认删除该备份记录?"
              onConfirm={() => handleDeleteRecord(planId, r.id)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        </div>
      ))}
    </div>
  );
};
