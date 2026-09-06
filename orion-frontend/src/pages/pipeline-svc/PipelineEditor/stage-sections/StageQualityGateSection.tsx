/**
 * StageQualityGateSection - 质量门禁配置区块
 */
import React from 'react';
import { Button, Card, Divider, Form, InputNumber, Radio, Select, Space, Switch, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined, SafetyOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { METRIC_OPTIONS, OPERATOR_OPTIONS } from '../StageModalConfig';
import type { QualityGateConfig, QualityGateRule } from '../types';

interface StageQualityGateSectionProps {
  value: QualityGateConfig;
  onChange: (value: QualityGateConfig) => void;
}

const StageQualityGateSection: React.FC<StageQualityGateSectionProps> = ({
  value,
  onChange,
}) => {
  const addRule = () => {
    const newRule: QualityGateRule = {
      id: `rule-${Date.now()}`,
      metric: 'test_pass_rate',
      operator: '>=',
      threshold: 80,
    };
    onChange({ ...value, rules: [...value.rules, newRule] });
  };

  const removeRule = (id: string) =>
    onChange({ ...value, rules: value.rules.filter((r) => r.id !== id) });

  const updateRule = (id: string, field: keyof QualityGateRule, ruleValue: string | number | boolean) =>
    onChange({
      ...value,
      rules: value.rules.map((r) => (r.id === id ? { ...r, [field]: ruleValue } : r)),
    });

  return (
    <>
      <Divider orientation="left" orientationMargin={0}>
        <Space>
          <SafetyOutlined />
          <span>质量门禁配置</span>
        </Space>
      </Divider>

      <Card size="small" style={{ marginBottom: spacing.md }}>
        <Form.Item label="启用质量门禁" valuePropName="checked">
          <Switch
            checked={value.enabled}
            onChange={(checked) => onChange({ ...value, enabled: checked })}
            checkedChildren="启用"
            unCheckedChildren="禁用"
          />
        </Form.Item>

        {value.enabled && (
          <>
            <Form.Item label="不通过时的动作">
              <Radio.Group
                value={value.failureAction}
                onChange={(e) =>
                  onChange({
                    ...value,
                    failureAction: e.target.value,
                  })
                }
              >
                <Space direction="vertical">
                  <Radio value="block">
                    <Space>
                      <Tag color="error">阻断</Tag>
                      <span>阻断流水线执行</span>
                    </Space>
                  </Radio>
                  <Radio value="warn">
                    <Space>
                      <Tag color="warning">警告</Tag>
                      <span>记录警告但继续执行</span>
                    </Space>
                  </Radio>
                  <Radio value="continue">
                    <Space>
                      <Tag color="default">继续</Tag>
                      <span>不处理，直接继续</span>
                    </Space>
                  </Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            <Form.Item label="规则列表">
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {value.rules.map((rule) => (
                  <Card
                    key={rule.id}
                    size="small"
                    extra={
                      <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => removeRule(rule.id)}
                      />
                    }
                  >
                    <Space style={{ width: '100%' }} size={8}>
                      <Select
                        value={rule.metric}
                        onChange={(ruleMetric) => updateRule(rule.id, 'metric', ruleMetric)}
                        options={METRIC_OPTIONS}
                        style={{ width: 160 }}
                        placeholder="选择指标"
                      />
                      <Select
                        value={rule.operator}
                        onChange={(ruleOperator) => updateRule(rule.id, 'operator', ruleOperator)}
                        options={OPERATOR_OPTIONS}
                        style={{ width: 80 }}
                      />
                      <InputNumber
                        value={rule.threshold}
                        onChange={(ruleThreshold) =>
                          updateRule(rule.id, 'threshold', ruleThreshold || 0)
                        }
                        style={{ width: 120 }}
                        placeholder="阈值"
                      />
                    </Space>
                  </Card>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={addRule} block>
                  添加质量规则
                </Button>
              </Space>
            </Form.Item>
          </>
        )}

        {!value.enabled && (
          <div style={{ padding: '8px 0', color: colors.neutral[500] }}>
            启用后可配置质量检查规则，如测试通过率、代码覆盖率、漏洞数量等
          </div>
        )}
      </Card>
    </>
  );
};

export default StageQualityGateSection;
