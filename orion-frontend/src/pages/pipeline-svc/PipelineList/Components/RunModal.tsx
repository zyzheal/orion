/**
 * RunModal - Pipeline 运行对话框
 * 抽取自 index.tsx (P2-9 Phase 217)
 */
import { Modal, Input } from 'antd';
import { spacing } from '@/tokens';
import type { Pipeline } from '@/api/pipelines';

interface Props {
  open: boolean;
  selectedPipeline: Pipeline | null;
  runBranch: string;
  setRunBranch: (v: string) => void;
  variablesText: string;
  setVariablesText: (v: string) => void;
  confirmLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RunModal = ({
  open,
  selectedPipeline,
  runBranch,
  setRunBranch,
  variablesText,
  setVariablesText,
  confirmLoading,
  onConfirm,
  onCancel,
}: Props) => (
  <Modal
    title={`运行 Pipeline: ${selectedPipeline?.name || ''}`}
    open={open}
    onOk={onConfirm}
    onCancel={onCancel}
    confirmLoading={confirmLoading}
    okText="触发运行"
    cancelText="取消"
  >
    <div style={{ marginBottom: spacing.md }}>
      <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: 500 }}>
        分支
      </label>
      <Input
        value={runBranch}
        onChange={(e) => setRunBranch(e.target.value)}
        placeholder="输入分支名称，默认为 main"
      />
    </div>
    <div style={{ marginBottom: spacing.md }}>
      <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: 500 }}>
        参数 (JSON)
      </label>
      <Input.TextArea
        value={variablesText}
        onChange={(e) => setVariablesText(e.target.value)}
        placeholder='{"KEY": "value"}'
        rows={4}
      />
    </div>
  </Modal>
);
