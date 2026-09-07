/**
 * FlowImportExport Export Preview Modal
 * 抽取自 index.tsx (P2-9 Phase 138)
 */
import React from 'react';
import { Modal, Button, Space, Descriptions } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { LowcodeFlow } from '@/api/lowcode';
import type { ExportFormat } from '../types';

interface ExportPreviewModalProps {
  open: boolean;
  exportData: ExportFormat | null;
  selectedFlow: LowcodeFlow | null;
  onClose: () => void;
  onDownload: () => void;
}

export const ExportPreviewModal: React.FC<ExportPreviewModalProps> = ({
  open,
  exportData,
  selectedFlow,
  onClose,
  onDownload,
}) => (
  <Modal
    title={`导出预览: ${exportData?.definition.name}`}
    open={open}
    onCancel={onClose}
    width={700}
    footer={
      <Space>
        <Button onClick={onClose}>关闭</Button>
        <Button type="primary" icon={<DownloadOutlined />} onClick={onDownload}>
          下载 JSON 文件
        </Button>
      </Space>
    }
  >
    {exportData && selectedFlow && (
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="流程名称">{exportData.definition.name}</Descriptions.Item>
        <Descriptions.Item label="描述">
          {exportData.definition.description || '无'}
        </Descriptions.Item>
        <Descriptions.Item label="版本">{exportData.definition.version}</Descriptions.Item>
        <Descriptions.Item label="节点数">
          {exportData.definition.nodes?.length || 0}
        </Descriptions.Item>
        <Descriptions.Item label="连线数">
          {exportData.definition.edges?.length || 0}
        </Descriptions.Item>
        <Descriptions.Item label="导出时间">
          {dayjs(exportData.exportedAt).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        <Descriptions.Item label="版本历史记录数">
          {exportData.versionHistory?.length || 0}
        </Descriptions.Item>
      </Descriptions>
    )}
  </Modal>
);
