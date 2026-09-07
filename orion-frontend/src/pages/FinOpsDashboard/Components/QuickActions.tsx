/**
 * QuickActions - 快捷操作
 * 抽取自 index.tsx (P2-9 Phase 125)
 */
import React from 'react';
import { Button, Card, Space } from 'antd';
import { ExportOutlined, SettingOutlined, FileSearchOutlined } from '@ant-design/icons';
import type { FinOpsDashboardState } from '../useFinOpsDashboardState';

interface QuickActionsProps {
  state: FinOpsDashboardState;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ state }) => {
  const { loading, handleExportReport } = state;

  return (
    <Card title="快捷操作" bordered={false} style={{ borderRadius: 8 }} loading={loading}>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Button
          icon={<ExportOutlined />}
          block
          onClick={handleExportReport}
          style={{ textAlign: 'left' }}
        >
          导出报表
        </Button>
        <Button icon={<SettingOutlined />} block style={{ textAlign: 'left' }}>
          设置预算
        </Button>
        <Button icon={<FileSearchOutlined />} block style={{ textAlign: 'left' }}>
          查看明细
        </Button>
      </Space>
    </Card>
  );
};
