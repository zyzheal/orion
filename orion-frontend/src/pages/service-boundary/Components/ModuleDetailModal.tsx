import { Button, Descriptions, Modal, Tag } from 'antd';
import type { ModuleRef } from '../types';

interface Props {
  selected: ModuleRef | null;
  onClose: () => void;
}

export function ModuleDetailModal({ selected, onClose }: Props) {
  return (
    <Modal
      title={`模块详情: ${selected?.module || ''}`}
      open={!!selected}
      onCancel={onClose}
      footer={[<Button key="close" onClick={onClose}>关闭</Button>]}
    >
      {selected && (
        <Descriptions size="small" bordered column={2}>
          <Descriptions.Item label="模块名称">{selected.module}</Descriptions.Item>
          <Descriptions.Item label="风险等级">
            <Tag color={selected.risk === 'high' ? 'red' : selected.risk === 'medium' ? 'orange' : 'green'}>
              {selected.risk === 'high' ? '高' : selected.risk === 'medium' ? '中' : '低'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="被引用次数">{selected.references}</Descriptions.Item>
          <Descriptions.Item label="子文件数">{selected.files > 0 ? selected.files : '—'}</Descriptions.Item>
          <Descriptions.Item label="代码行数">{selected.lines > 0 ? selected.lines.toLocaleString() : '—'}</Descriptions.Item>
          <Descriptions.Item label="接口层">
            {selected.hasInterface ? <Tag color="green">已定义</Tag> : <Tag color="red">缺失</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="分析说明" span={2}>
            {selected.references >= 100
              ? '被 100+ 模块引用，接口变更风险极高，应优先建立接口层'
              : selected.references >= 70
                ? '被 70+ 模块引用，建议建立接口层'
                : '引用次数适中，当前风险可控'}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}
