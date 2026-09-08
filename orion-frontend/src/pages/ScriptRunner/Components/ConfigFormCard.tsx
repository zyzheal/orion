/**
 * ConfigFormCard.tsx - 脚本配置表单卡
 * 抽取自 index.tsx (P2-9 Phase 230)
 */
import React from 'react';
import { Button, Card, Form, Input, Select, Space, type FormInstance } from 'antd';
import { PlayCircleOutlined, SafetyOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ScriptConfig } from '@/api/scripts';
import { languageOptions, levelOptions } from '../constants';

const { TextArea } = Input;

interface Props {
  form: FormInstance<ScriptConfig>;
  loading: boolean;
  scanning: boolean;
  onScan: () => void;
  onExecute: () => void;
}

export const ConfigFormCard: React.FC<Props> = ({
  form,
  loading,
  scanning,
  onScan,
  onExecute,
}) => (
  <Card title="脚本配置" style={{ marginBottom: spacing.md }}>
    <Form
      form={form}
      layout="vertical"
      initialValues={{ language: 'javascript', level: 'safe' }}
    >
      <Space style={{ marginBottom: spacing.md }} wrap>
        <Form.Item name="language" label="语言" style={{ marginBottom: 0, width: 160 }}>
          <Select options={languageOptions} />
        </Form.Item>
        <Form.Item name="level" label="安全级别" style={{ marginBottom: 0, width: 160 }}>
          <Select options={levelOptions} />
        </Form.Item>
      </Space>
      <Form.Item
        name="code"
        label="脚本代码"
        rules={[{ required: true, message: '请输入脚本代码' }]}
      >
        <TextArea
          rows={12}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
          placeholder="输入脚本代码..."
        />
      </Form.Item>
      <Space>
        <Button icon={<SafetyOutlined />} onClick={onScan} loading={scanning}>
          安全扫描
        </Button>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={onExecute}
          loading={loading}
        >
          执行脚本
        </Button>
      </Space>
    </Form>
  </Card>
);
