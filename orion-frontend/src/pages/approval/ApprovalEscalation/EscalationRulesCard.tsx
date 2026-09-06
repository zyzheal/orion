/**
 * EscalationRulesCard - 升级策略配置卡（含新建规则 Modal）
 */
import React, { useState } from 'react';
import {
  Typography,
  Card,
  Tag,
  Space,
  Button,
  Switch,
  Modal,
  Form,
  Input,
  Select,
  message,
  Row,
  Col,
} from 'antd';
import { ThunderboltOutlined, ArrowUpOutlined, PlusOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { MOCK_RULES } from './constants';
import type { EscalationRule } from './types';

const { Text } = Typography;
const { Option } = Select;

export const EscalationRulesCard: React.FC = () => {
  const [rules, setRules] = useState<EscalationRule[]>(MOCK_RULES);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          message.success(`规则「${r.name}」已${r.enabled ? '停用' : '启用'}`);
          return { ...r, enabled: !r.enabled };
        }
        return r;
      })
    );
  };

  const handleCreateRule = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const newRule: EscalationRule = {
        id: `r${rules.length + 1}`,
        name: values.name,
        threshold: `${values.thresholdUnit === 'min' ? '分钟' : '小时'} ${values.threshold}`,
        thresholdMinutes:
          values.thresholdUnit === 'min' ? values.threshold : values.threshold * 60,
        action: values.action,
        enabled: true,
        priority: rules.length + 1,
      };
      setRules((prev) => [...prev, newRule]);
      message.success(`升级规则「${newRule.name}」已创建`);
      setCreateModalVisible(false);
      createForm.resetFields();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建规则失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined style={{ color: colors.warning[500] }} />
          <Text strong>升级策略配置</Text>
        </Space>
      }
      extra={
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
        >
          新建规则
        </Button>
      }
      style={{ height: '100%' }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {rules
          .sort((a, b) => a.priority - b.priority)
          .map((rule) => (
            <Card
              key={rule.id}
              size="small"
              style={{
                background: rule.enabled ? colors.primary[50] : colors.neutral[50],
                borderRadius: spacing.sm,
              }}
            >
              <Row gutter={12} align="middle">
                <Col flex="auto">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <Text strong style={{ fontSize: 14 }}>
                      {rule.name}
                    </Text>
                    <Tag color={rule.enabled ? 'processing' : 'default'} style={{ fontSize: 11 }}>
                      {rule.enabled ? '启用中' : '已停用'}
                    </Tag>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Tag color="orange" style={{ fontSize: 11 }}>
                      {rule.threshold}
                    </Tag>
                    <ArrowUpOutlined style={{ color: colors.neutral[500], fontSize: 10 }} />
                    <Text style={{ fontSize: 13 }}>{rule.action}</Text>
                  </div>
                </Col>
                <Col>
                  <Switch
                    checked={rule.enabled}
                    onChange={() => toggleRule(rule.id)}
                    checkedChildren="开"
                    unCheckedChildren="关"
                    size="small"
                  />
                </Col>
              </Row>
            </Card>
          ))}
      </Space>

      <Modal
        title="新建升级规则"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setCreateModalVisible(false);
              createForm.resetFields();
            }}
          >
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleCreateRule}>
            创建规则
          </Button>,
        ]}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            label="规则名称"
            name="name"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="例如：四级超时升级" />
          </Form.Item>
          <Form.Item
            label="超时阈值"
            name="threshold"
            rules={[{ required: true, message: '请输入阈值' }]}
          >
            <Input
              type="number"
              placeholder="例如：4"
              addonAfter={
                <Form.Item name="thresholdUnit" noStyle initialValue="min">
                  <Select style={{ width: 80 }}>
                    <Option value="min">分钟</Option>
                    <Option value="hour">小时</Option>
                  </Select>
                </Form.Item>
              }
            />
          </Form.Item>
          <Form.Item
            label="升级动作"
            name="action"
            rules={[{ required: true, message: '请输入升级动作' }]}
          >
            <Input.TextArea rows={2} placeholder="例如：通知项目经理" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
