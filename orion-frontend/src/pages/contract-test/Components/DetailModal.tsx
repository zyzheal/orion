import { Alert, Button, Descriptions, Modal, Space, Tag } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import type { Contract } from '../types';
import { STATUS_MAP } from '../constants';

interface Props {
  selected: Contract | null;
  verifying: boolean;
  handleVerify: (c: Contract) => Promise<void>;
  setSelected: (c: Contract | null) => void;
}

export function DetailModal({ selected, verifying, handleVerify, setSelected }: Props) {
  return (
    <Modal
      title={selected ? `契约详情: ${selected.method} ${selected.endpoint}` : '契约详情'}
      open={!!selected}
      onCancel={() => setSelected(null)}
      footer={[
        <Button key="verify" type="primary" icon={<PlayCircleOutlined />} loading={verifying} onClick={() => selected && handleVerify(selected)}>
          重新验证
        </Button>,
        <Button key="close" onClick={() => setSelected(null)}>关闭</Button>,
      ]}
    >
      {selected && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Descriptions size="small" bordered column={2}>
            <Descriptions.Item label="Consumer">{selected.consumer}</Descriptions.Item>
            <Descriptions.Item label="Provider">{selected.provider}</Descriptions.Item>
            <Descriptions.Item label="Method"><Tag>{selected.method}</Tag></Descriptions.Item>
            <Descriptions.Item label="版本">{selected.version}</Descriptions.Item>
            <Descriptions.Item label="状态" span={2}>
              <Tag color={STATUS_MAP[selected.status]?.color || 'default'}>
                {STATUS_MAP[selected.status]?.label || selected.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="最后验证">{selected.lastVerified || '从未验证'}</Descriptions.Item>
          </Descriptions>
          {selected.status === 'drift' && (
            <Alert message="Schema 漂移详情" description="检测到以下字段变更可能导致前后端不兼容" type="warning" showIcon style={{ marginTop: 12 }} />
          )}
        </Space>
      )}
    </Modal>
  );
}
