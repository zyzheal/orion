/**
 * FlowImportExport Import Card
 * 抽取自 index.tsx (P2-9 Phase 138)
 */
import React from 'react';
import { Card, Button, Upload, Typography } from 'antd';
import { UploadOutlined, InboxOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { UploadFile } from 'antd/es/upload/interface';
import type { ImportPreview, ValidateResult } from '../types';
import { ImportPreviewCard } from './ImportPreviewCard';

const { Dragger } = Upload;

interface ImportCardProps {
  fileList: UploadFile[];
  importPreview: ImportPreview | null;
  validateResult: ValidateResult | null;
  handleFileChange: (info: { file: UploadFile; fileList: UploadFile[] }) => void;
  handleImportDrop: (e: React.DragEvent) => void;
  openImportModal: () => void;
}

export const ImportCard: React.FC<ImportCardProps> = ({
  fileList,
  importPreview,
  validateResult,
  handleFileChange,
  handleImportDrop,
  openImportModal,
}) => (
  <Card
    title="导入流程"
    style={{ height: '100%' }}
    extra={
      <Button
        size="small"
        type="primary"
        icon={<UploadOutlined />}
        onClick={openImportModal}
        disabled={fileList.length === 0}
      >
        开始导入
      </Button>
    }
  >
    <Typography.Text
      type="secondary"
      style={{ display: 'block', marginBottom: spacing.md }}
    >
      选择 JSON 文件导入流程定义
    </Typography.Text>
    <Dragger
      fileList={fileList}
      beforeUpload={() => false}
      onChange={handleFileChange}
      onDrop={handleImportDrop}
      accept=".json"
      maxCount={1}
      showUploadList={{ showRemoveIcon: true }}
      style={{ padding: spacing.sm }}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined style={{ color: colors.primary[500], fontSize: 48 }} />
      </p>
      <p className="ant-upload-text">点击或拖拽 JSON 文件到此处</p>
      <p className="ant-upload-hint">支持导出时生成的 JSON 文件格式</p>
    </Dragger>

    {importPreview && (
      <ImportPreviewCard importPreview={importPreview} validateResult={validateResult} />
    )}
  </Card>
);
