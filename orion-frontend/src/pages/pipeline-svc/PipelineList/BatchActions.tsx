/**
 * Pipeline Batch Actions Component
 * Toolbar for bulk enable/disable/delete operations on selected pipelines.
 */
import React, { useState } from 'react';
import { Space, Button, Modal, message, Tag } from 'antd';
import { CheckOutlined, StopOutlined, DeleteOutlined } from '@ant-design/icons';
import { batchUpdatePipelines } from '@/api/pipelines';
import { colors, spacing } from '@/tokens';

interface BatchActionsProps {
  selectedIds: string[];
  onRefresh: () => void;
  onClearSelection: () => void;
}

const BatchActions: React.FC<BatchActionsProps> = ({ selectedIds, onRefresh, onClearSelection }) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  const handleBatchAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    const labels = { activate: '启用', deactivate: '停用', delete: '删除' };
    Modal.confirm({
      title: `批量${labels[action]}`,
      content: `确认${labels[action]} ${selectedIds.length} 个 Pipeline？${action === 'delete' ? '此操作不可撤销。' : ''}`,
      okText: `确认${labels[action]}`,
      cancelText: '取消',
      okButtonProps: { danger: action === 'delete' },
      onOk: async () => {
        try {
          setActionLoading(action);
          await batchUpdatePipelines(selectedIds, action);
          message.success(`已${labels[action]} ${selectedIds.length} 个 Pipeline`);
          onRefresh();
          onClearSelection();
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : '操作失败';
          message.error(`批量${labels[action]}失败: ${msg}`);
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      background: colors.primary[50],
      borderRadius: 6,
      marginBottom: spacing[3],
    }}>
      <span style={{ fontSize: 13 }}>
        已选择 <Tag color="blue">{selectedIds.length}</Tag> 个 Pipeline
      </span>
      <Space>
        <Button
          size="small"
          icon={<CheckOutlined />}
          loading={actionLoading === 'activate'}
          onClick={() => handleBatchAction('activate')}
        >
          批量启用
        </Button>
        <Button
          size="small"
          icon={<StopOutlined />}
          loading={actionLoading === 'deactivate'}
          onClick={() => handleBatchAction('deactivate')}
        >
          批量停用
        </Button>
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          loading={actionLoading === 'delete'}
          onClick={() => handleBatchAction('delete')}
        >
          批量删除
        </Button>
      </Space>
    </div>
  );
};

export default BatchActions;
