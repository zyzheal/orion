/**
 * FlowImportExport Import Confirm Modal
 * 抽取自 index.tsx (P2-9 Phase 138)
 */
import React from 'react';
import { Modal, Alert, Descriptions, Input } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ImportPreview, ImportResult, ValidateResult } from '../types';

const {TextArea} = Input;

interface ImportConfirmModalProps {
  open: boolean;
  importing: boolean;
  importPreview: ImportPreview | null;
  importName: string;
  setImportName: (v: string) => void;
  importDescription: string;
  setImportDescription: (v: string) => void;
  validateResult: ValidateResult | null;
  importResult: ImportResult | null;
  onOk: () => void;
  onCancel: () => void;
}

export const ImportConfirmModal: React.FC<ImportConfirmModalProps> = ({
  open,
  importing,
  importPreview,
  importName,
  setImportName,
  importDescription,
  setImportDescription,
  validateResult,
  importResult,
  onOk,
  onCancel,
}) => (
  <Modal
    title="确认导入"
    open={open}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={importing}
    okText={importing ? '导入中...' : '确认导入'}
    cancelText="取消"
  >
    {importPreview && (
      <div>
        <Descriptions bordered column={1} size="small" style={{ marginBottom: spacing.md }}>
          <Descriptions.Item label="流程名称">
            <Input value={importName} onChange={(e) => setImportName(e.target.value)} />
          </Descriptions.Item>
          <Descriptions.Item label="描述">
            <TextArea
              value={importDescription}
              onChange={(e) => setImportDescription(e.target.value)}
              rows={2}
            />
          </Descriptions.Item>
          <Descriptions.Item label="节点数">{importPreview.nodeCount}</Descriptions.Item>
          <Descriptions.Item label="连线数">{importPreview.edgeCount}</Descriptions.Item>
        </Descriptions>

        {validateResult && validateResult.errors.length > 0 && (
          <Alert
            type="error"
            message={`校验错误: ${validateResult.errors.join(', ')}`}
            showIcon
            icon={<CloseCircleOutlined />}
            style={{ marginBottom: spacing.sm }}
          />
        )}
        {validateResult && validateResult.warnings.length > 0 && (
          <Alert
            type="warning"
            message={`警告: ${validateResult.warnings.join(', ')}`}
            showIcon
            style={{ marginBottom: spacing.sm }}
          />
        )}

        {importResult && (
          <Alert
            type={importResult.success ? 'success' : 'error'}
            message={importResult.success ? '导入成功' : `导入失败: ${importResult.message}`}
            showIcon
            icon={importResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          />
        )}
      </div>
    )}
  </Modal>
);
