/**
 * TemplateDetailModal.tsx - 模板详情弹窗
 * 抽取自 index.tsx (P2-9 Phase 240)
 */
import { Modal, Button, Descriptions, Divider, Typography, Space, Tag } from 'antd';
import { StarOutlined, UserOutlined } from '@ant-design/icons';
import type { Template } from '../useTemplateMarketState';

const { Title, Text } = Typography;
const { Item: DescItem } = Descriptions;

interface Props {
  selected: Template | null;
  open: boolean;
  onClose: () => void;
  onApply: (t: Template) => void;
}

export function TemplateDetailModal({ selected, open, onClose, onApply }: Props) {
  return (
    <Modal
      title={`模板详情: ${selected?.name || ''}`}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>关闭</Button>,
        <Button key="apply" type="primary" onClick={() => selected && onApply(selected)}>应用到 Pipeline</Button>,
      ]}
    >
      {selected && (
        <>
          <Descriptions size="small" bordered column={2}>
            <DescItem label="版本">{selected.version}</DescItem>
            <DescItem label="作者"><Space><UserOutlined />{selected.author}</Space></DescItem>
            <DescItem label="分类"><Tag>{selected.category}</Tag></DescItem>
            <DescItem label="语言"><Tag>{selected.language}</Tag></DescItem>
            <DescItem label="下载量">{selected.downloads.toLocaleString()}</DescItem>
            <DescItem label="Stars"><StarOutlined /> {selected.stars}</DescItem>
            <DescItem label="最后更新">{selected.updatedAt}</DescItem>
            <DescItem label="模板类型">{selected.isOfficial ? <Tag color="blue">官方</Tag> : <Tag>社区</Tag>}</DescItem>
          </Descriptions>
          <Divider />
          <Title level={5}>模板描述</Title>
          <Text>{selected.description}</Text>
          <Divider />
          <Title level={5}>应用方式 (GitLab include 模式)</Title>
          <pre style={{ background: '#f0f0f0', padding: 12, borderRadius: 4, fontSize: 12 }}>
{`include:
  template: "${selected.name}"`}
          </pre>
          <Text type="secondary">将此段加入项目 .gitlab-ci.yml 即可应用该模板</Text>
        </>
      )}
    </Modal>
  );
}
