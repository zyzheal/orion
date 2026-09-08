/**
 * ComponentRegistry Table with category filter
 * 抽取自 index.tsx (P2-9 Phase 194)
 */
import { Button, Card, Empty, Select, Space, Table } from 'antd';
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ComponentRegistry } from '@/api/lowcode';
import { CATEGORIES } from '../constants';

const { Option } = Select;

interface ComponentTableProps {
  columns: ColumnsType<ComponentRegistry>;
  components: ComponentRegistry[];
  loading: boolean;
  category: string;
  onCategoryChange: (v: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
}

export const ComponentTable = ({
  columns,
  components,
  loading,
  category,
  onCategoryChange,
  onRefresh,
  onCreate,
}: ComponentTableProps) => (
  <Card
    title="组件列表"
    extra={
      <Space>
        <Select
          style={{ width: 120 }}
          value={category}
          onChange={onCategoryChange}
          allowClear
          placeholder="分类筛选"
        >
          {CATEGORIES.map((c) => (
            <Option key={c.value} value={c.value}>
              {c.label}
            </Option>
          ))}
        </Select>
        <Button icon={<ReloadOutlined />} size="small" onClick={onRefresh} loading={loading}>
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          注册组件
        </Button>
      </Space>
    }
  >
    {components.length === 0 ? (
      <Empty description="暂无已注册组件，请注册第一个组件" />
    ) : (
      <Table
        columns={columns}
        dataSource={components}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        size="small"
      />
    )}
  </Card>
);
