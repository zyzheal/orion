/**
 * Modals.tsx - Digital Twin 两个 Modal (Create Snapshot + Start Recording)
 * 抽取自 index.tsx (P2-9 Phase 244)
 */
import { Modal, Form, Select, Input } from 'antd';
import type { FormInstance } from 'antd';

interface Props {
  snapshotModal: boolean;
  setSnapshotModal: (v: boolean) => void;
  recordingModal: boolean;
  setRecordingModal: (v: boolean) => void;
  form: FormInstance;
  handleCreateSnapshot: (values: Record<string, unknown>) => Promise<void>;
  handleStartRecording: (values: Record<string, unknown>) => Promise<void>;
}

export function Modals({
  snapshotModal, setSnapshotModal,
  recordingModal, setRecordingModal,
  form,
  handleCreateSnapshot,
  handleStartRecording,
}: Props) {
  return (
    <>
      <Modal
        title="Create Snapshot"
        open={snapshotModal}
        onCancel={() => setSnapshotModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateSnapshot}>
          <Form.Item label="Environment" name="environment" required>
            <Select
              options={[
                { value: 'production', label: 'Production' },
                { value: 'staging', label: 'Staging' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Note" name="note">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Start Traffic Recording"
        open={recordingModal}
        onCancel={() => setRecordingModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleStartRecording}>
          <Form.Item label="Source Environment" name="source_env" required>
            <Select options={[{ value: 'production', label: 'Production' }]} />
          </Form.Item>
          <Form.Item label="Path Prefixes" name="path_prefixes">
            <Input placeholder="/api/v1/*" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
