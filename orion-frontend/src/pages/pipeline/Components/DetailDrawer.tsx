/**
 * DetailDrawer.tsx - 数据管道日志/血缘抽屉
 * 抽取自 PipelineManagementPage.tsx (P2-9 Phase 90)
 */
import React from 'react';
import { Drawer, Card, Descriptions } from 'antd';
import { spacing, themeVars } from '@/tokens';

interface DetailDrawerProps {
  open: boolean;
  title: string;
  content: string;
  loading: boolean;
  selectedName: string;
  onClose: () => void;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  open,
  title,
  content,
  loading,
  selectedName,
  onClose,
}) => (
  <Drawer title={title} open={open} onClose={onClose} width={600}>
    {selectedName && (
      <Card size="small" style={{ marginBottom: spacing.md }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="管道">{selectedName}</Descriptions.Item>
        </Descriptions>
      </Card>
    )}
    <Card title={title.includes('日志') ? '执行日志' : '数据血缘'} size="small">
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>加载中...</div>
      ) : (
        <pre
          style={
            {
              background: themeVars.bgSecondary,
              padding: spacing.md,
              borderRadius: spacing.sm,
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 400,
              overflow: 'auto',
            } as React.CSSProperties
          }
        >
          {content}
        </pre>
      )}
    </Card>
  </Drawer>
);
