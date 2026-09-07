/**
 * FlowImportExport Import Preview Card
 * 抽取自 index.tsx (P2-9 Phase 138)
 */
import React from 'react';
import { Card, Statistic, Divider, Row, Col, Alert, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { spacing, themeVars } from '@/tokens';
import dayjs from 'dayjs';
import type { ImportPreview, ValidateResult } from '../types';

interface ImportPreviewCardProps {
  importPreview: ImportPreview;
  validateResult: ValidateResult | null;
}

export const ImportPreviewCard: React.FC<ImportPreviewCardProps> = ({
  importPreview,
  validateResult,
}) => (
  <Card size="small" style={{ marginTop: spacing.sm, background: themeVars.bgSecondary }}>
    <Statistic title="流程名称" value={importPreview.name} valueStyle={{ fontSize: 14 }} />
    <Divider style={{ margin: `${spacing.sm} 0` }} />
    <Row gutter={12}>
      <Col span={8}>
        <Statistic title="节点数" value={importPreview.nodeCount} />
      </Col>
      <Col span={8}>
        <Statistic title="连线数" value={importPreview.edgeCount} />
      </Col>
      <Col span={8}>
        <Statistic title="版本历史" value={importPreview.versionHistoryLength || 0} />
      </Col>
    </Row>
    {importPreview.exportedAt && (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        导出时间: {dayjs(importPreview.exportedAt).format('YYYY-MM-DD HH:mm')}
      </Typography.Text>
    )}

    {validateResult && (
      <div style={{ marginTop: spacing.sm }}>
        {validateResult.errors.length > 0 && (
          <Alert
            type="error"
            message={`校验失败: ${validateResult.errors.join(', ')}`}
            showIcon
            icon={<CloseCircleOutlined />}
            style={{ marginBottom: 4 }}
          />
        )}
        {validateResult.warnings.length > 0 && (
          <Alert
            type="warning"
            message={`警告: ${validateResult.warnings.join(', ')}`}
            showIcon
          />
        )}
        {validateResult.valid && validateResult.errors.length === 0 && (
          <Alert
            type="success"
            message="文件校验通过，可以导入"
            showIcon
            icon={<CheckCircleOutlined />}
          />
        )}
      </div>
    )}
  </Card>
);
