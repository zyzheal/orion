/**
 * ServiceCatalog DetailModal
 * 抽取自 index.tsx (P2-9 Phase 189)
 */
import { Button, Descriptions, Modal, Tag } from 'antd';
import type { ServiceCatalog } from '@/api/service-catalog';

interface DetailModalProps {
  open: boolean;
  item: ServiceCatalog | null;
  onClose: () => void;
}

export const DetailModal = ({ open, item, onClose }: DetailModalProps) => (
  <Modal
    title="服务详情"
    open={open}
    onCancel={onClose}
    footer={<Button onClick={onClose}>关闭</Button>}
    width={560}
  >
    {item && (
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="服务 ID">{item.id}</Descriptions.Item>
        <Descriptions.Item label="服务名称">{item.name}</Descriptions.Item>
        <Descriptions.Item label="服务值">
          <pre style={{ margin: 0, fontSize: 12, maxHeight: 120, overflow: 'auto' }}>
            {item.value}
          </pre>
        </Descriptions.Item>
        <Descriptions.Item label="启用状态">
          <Tag color={item.enabled ? 'green' : 'default'}>
            {item.enabled ? '已启用' : '已禁用'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}
        </Descriptions.Item>
      </Descriptions>
    )}
  </Modal>
);
