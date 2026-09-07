/**
 * FormDesigner schema preview modal
 * 抽取自 index.tsx (P2-9 Phase 161)
 */
import { Modal } from 'antd';
import { themeVars } from '@/tokens';

interface SchemaPreviewModalProps {
  open: boolean;
  schema: string;
  onCancel: () => void;
}

export const SchemaPreviewModal = ({ open, schema, onCancel }: SchemaPreviewModalProps) => (
  <Modal title="Schema 预览" open={open} onCancel={onCancel} footer={null} width={640}>
    <pre
      style={{
        background: themeVars.bgSecondary,
        padding: 16,
        borderRadius: 8,
        maxHeight: 400,
        overflow: 'auto',
      }}
    >
      {schema}
    </pre>
  </Modal>
);
