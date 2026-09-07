/**
 * SbomDashboard WaiverModal
 * 抽取自 index.tsx (P2-9 Phase 170)
 */
import type { FormInstance } from 'antd';
import { Form, Input, Modal, Select } from 'antd';
import type { SbomWaiverInput } from '@/api/sbom';

interface WaiverModalProps {
  open: boolean;
  form: FormInstance;
  onOk: () => void;
  onCancel: () => void;
  onFinish: (values: SbomWaiverInput) => void;
}

export const WaiverModal = ({ open, form, onOk, onCancel, onFinish }: WaiverModalProps) => (
  <Modal
    title="创建漏洞豁免"
    open={open}
    onCancel={onCancel}
    onOk={onOk}
    destroyOnClose
  >
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item name="cveId" label="CVE ID" rules={[{ required: true }]}>
        <Input placeholder="CVE-2024-XXXX" />
      </Form.Item>
      <Form.Item name="packageName" label="包名" rules={[{ required: true }]}>
        <Input placeholder="package-name" />
      </Form.Item>
      <Form.Item name="packageVersion" label="包版本" rules={[{ required: true }]}>
        <Input placeholder="1.0.0" />
      </Form.Item>
      <Form.Item name="reason" label="豁免原因" rules={[{ required: true }]}>
        <Input.TextArea rows={3} placeholder="说明豁免理由..." />
      </Form.Item>
      <Form.Item name="scope" label="范围" rules={[{ required: true }]} initialValue="global">
        <Select
          options={[
            { label: '全局', value: 'global' },
            { label: '项目', value: 'project' },
            { label: '环境', value: 'environment' },
          ]}
        />
      </Form.Item>
      <Form.Item name="expiresAt" label="有效期至" rules={[{ required: true }]}>
        <Input type="date" />
      </Form.Item>
    </Form>
  </Modal>
);
