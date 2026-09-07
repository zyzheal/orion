/**
 * AuditLogs FilterForm
 * 抽取自 index.tsx (P2-9 Phase 186)
 */
import { Card, Form, Input, Select, DatePicker, Space, Button } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { spacing } from '@/tokens';
import { ALL_ACTIONS, ALL_OUTCOMES } from '../constants';

interface FilterFormValues {
  runId?: string;
  action?: string;
  outcome?: string;
  dateRange?: unknown;
}

interface FilterFormProps {
  form: FormInstance<FilterFormValues>;
  onSearch: () => void;
  onReset: () => void;
}

export const FilterForm = ({ form, onSearch, onReset }: FilterFormProps) => (
  <Card size="small" style={{ marginBottom: spacing.md }}>
    <Form form={form} layout="inline">
      <Form.Item name="runId" label="Run ID">
        <Input placeholder="Run ID" style={{ width: 180 }} />
      </Form.Item>
      <Form.Item name="action" label="Action">
        <Select placeholder="全部" allowClear style={{ width: 150 }} options={ALL_ACTIONS} />
      </Form.Item>
      <Form.Item name="outcome" label="Outcome">
        <Select placeholder="全部" allowClear style={{ width: 120 }} options={ALL_OUTCOMES} />
      </Form.Item>
      <Form.Item name="dateRange" label="时间范围">
        <DatePicker.RangePicker showTime />
      </Form.Item>
      <Form.Item>
        <Space>
          <Button type="primary" icon={<SearchOutlined />} onClick={onSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={onReset}>
            重置
          </Button>
        </Space>
      </Form.Item>
    </Form>
  </Card>
);
