/**
 * SBOM Document info card
 */
import React from 'react';
import { Button, Card, Descriptions, Space } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import StatusBadge from '@/components/StatusBadge';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';

interface DocInfoCardProps {
  doc: any;
  scanLoading: boolean;
  onDownload: () => void;
  onScan: () => void;
}

function getDocStatus(status?: string): 'failed' | 'success' | 'cancelled' | 'pending' {
  if (status === 'failed') return 'failed';
  if (status === 'success') return 'success';
  if (status === 'expired') return 'cancelled';
  return 'pending';
}

export const DocInfoCard: React.FC<DocInfoCardProps> = ({ doc, scanLoading, onDownload, onScan }) => (
  <Card style={{ marginBottom: spacing.lg }}>
    <Descriptions title="文档信息" bordered column={3}>
      <Descriptions.Item label="Document ID">{doc.documentId}</Descriptions.Item>
      <Descriptions.Item label="格式">{doc.format}</Descriptions.Item>
      <Descriptions.Item label="规范版本">{doc.specVersion}</Descriptions.Item>
      <Descriptions.Item label="Build ID">{doc.buildId}</Descriptions.Item>
      <Descriptions.Item label="Pipeline Run">{doc.pipelineRunId}</Descriptions.Item>
      <Descriptions.Item label="包数量">{doc.packageCount}</Descriptions.Item>
      <Descriptions.Item label="状态">
        <StatusBadge status={getDocStatus(doc.status)} size="small" />
      </Descriptions.Item>
      <Descriptions.Item label="创建时间">
        {dayjs(doc.createdAt).format('YYYY-MM-DD HH:mm')}
      </Descriptions.Item>
      <Descriptions.Item label="过期时间">
        {doc.expiresAt ? dayjs(doc.expiresAt).format('YYYY-MM-DD') : '-'}
      </Descriptions.Item>
    </Descriptions>
    <Space style={{ marginTop: spacing.md }}>
      <Button icon={<DownloadOutlined />} onClick={onDownload}>
        下载 {doc.format.toUpperCase()}
      </Button>
      <Button icon={<ReloadOutlined />} onClick={onScan} loading={scanLoading}>
        重新扫描漏洞
      </Button>
    </Space>
  </Card>
);
