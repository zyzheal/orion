/**
 * TemplatesTable.tsx - 模板列表表格
 * 抽取自 index.tsx (P2-9 Phase 240)
 */
import { Card, Table, Tag, Button, Space, Input, Typography } from 'antd';
import {
  FileTextOutlined,
  CopyOutlined,
  StarOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import type { Template } from '../useTemplateMarketState';

const { Text } = Typography;

interface Props {
  templates: Template[];
  onSelect: (t: Template) => void;
  onApply: (t: Template) => void;
  onFork: (t: Template) => void;
}

export function TemplatesTable({ templates, onSelect, onApply, onFork }: Props) {
  const columns: { title: string; dataIndex: string; width?: number; render: (v: any, r: Template) => React.ReactNode }[] = [
    {
      title: '模板名称',
      dataIndex: 'name',
      render: (_v, t) => (
        <Space>
          <FileTextOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{t.name}</Text>
          {t.isOfficial && <Tag color="blue">官方</Tag>}
          <Tag>{t.version}</Tag>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      render: (v) => <Text type="secondary">{v}</Text>,
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 80,
      render: (v) => <Tag color="purple">{v}</Tag>,
    },
    {
      title: '语言',
      dataIndex: 'language',
      width: 70,
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: '下载',
      dataIndex: 'downloads',
      width: 80,
      render: (v) => <Text>{v.toLocaleString()}</Text>,
    },
    {
      title: '⭐',
      dataIndex: 'stars',
      width: 70,
      render: (v) => (
        <Space>
          <StarOutlined />
          <Text>{v}</Text>
        </Space>
      ),
    },
    {
      title: '操作',
      width: 120,
      render: (_v, t) => (
        <Space size="small">
          <Button
            size="small"
            type="primary"
            icon={<CopyOutlined />}
            onClick={(e) => { e.stopPropagation(); onApply(t); }}
          >
            应用
          </Button>
          <Button
            size="small"
            icon={<ArrowUpOutlined />}
            onClick={(e) => { e.stopPropagation(); onFork(t); }}
          >
            复刻
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title="模板列表">
      <Table
        dataSource={templates}
        columns={columns}
        rowKey="id"
        onRow={(t) => ({ onClick: () => onSelect(t), style: { cursor: 'pointer' } })}
        pagination={false}
      />
    </Card>
  );
}
