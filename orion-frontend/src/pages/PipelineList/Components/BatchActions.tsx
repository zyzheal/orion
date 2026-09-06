/**
 * BatchActions - 批量操作栏
 * 抽取自 index.tsx (P2-9 Phase 108)
 */
import React from 'react';
import { Card, Button, Space, Typography } from 'antd';
import { PlayCircleOutlined, ExportOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { PipelineListState } from '../usePipelineListState';

const { Text } = Typography;

interface BatchActionsProps {
  state: PipelineListState;
}

export const BatchActions: React.FC<BatchActionsProps> = ({ state }) => {
  if (state.selectedRowKeys.length === 0) return null;

  return (
    <Card size="small" style={{ marginBottom: spacing.md, background: colors.info[50] }}>
      <Space>
        <Text strong>已选择 {state.selectedRowKeys.length} 项</Text>
        <Button size="small" onClick={() => state.setSelectedRowKeys([])}>
          取消选择
        </Button>
        <Button
          size="small"
          icon={<PlayCircleOutlined />}
          onClick={state.handleBatchTrigger}
          loading={state.batchLoading}
        >
          批量触发
        </Button>
        <Button
          size="small"
          danger
          loading={state.batchLoading}
          onClick={state.handleBatchDelete}
        >
          批量删除
        </Button>
        <Button size="small" icon={<ExportOutlined />} onClick={state.handleExport}>
          导出选中
        </Button>
      </Space>
    </Card>
  );
};
