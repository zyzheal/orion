/**
 * Diagnostic Trigger Page
 * Start a new diagnostic session by providing trigger type and initial symptoms
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Card, Form, Input, Select, Button, Space, message, Alert, Tag } from 'antd';
import { colors } from '@/tokens';
import { ThunderboltOutlined, RocketOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { triggerDiagnostic } from '@/api/diagnostic';

const { Title, Text } = Typography;

interface SymptomFormItem {
  type: string;
  source: string;
  description: string;
  severity: string;
}

const DiagnosticTrigger: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [triggerForm] = Form.useForm();
  const [symptoms, setSymptoms] = useState<SymptomFormItem[]>([]);

  const addSymptom = () => {
    setSymptoms([...symptoms, { type: '', source: '', description: '', severity: 'medium' }]);
  };

  const removeSymptom = (index: number) => {
    setSymptoms(symptoms.filter((_, i) => i !== index));
  };

  const updateSymptom = (index: number, field: keyof SymptomFormItem, value: string) => {
    const newSymptoms = [...symptoms];
    newSymptoms[index] = { ...newSymptoms[index], [field]: value };
    setSymptoms(newSymptoms);
  };

  const handleSubmit = async (values: any) => {
    const validSymptoms = symptoms.filter((s) => s.type && s.source);
    const data: any = {
      triggerType: values.triggerType,
      triggerId: values.triggerId,
    };
    if (validSymptoms.length > 0) {
      data.symptoms = validSymptoms;
    }

    setSubmitting(true);
    try {
      const response = await triggerDiagnostic(data);
      const sessionId = response.data?.sessionId;
      message.success('诊断会话已创建');
      if (sessionId) {
        navigate(`/diagnostic/sessions`);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建诊断会话失败：${error.message}`);
      } else {
        message.error('创建诊断会话失败，请稍后重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/diagnostic/sessions')}
        >
          返回
        </Button>
        <div style={{ flex: 1 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            <RocketOutlined style={{ marginRight: 8 }} />
            触发诊断
          </Title>
          <Text type="secondary">启动新的诊断会话，收集症状并分析问题</Text>
        </div>
      </div>

      <Alert
        type="info"
        message="提示"
        description="诊断系统会根据提供的症状自动匹配知识库中的模式，并生成诊断报告。请尽可能提供完整的症状信息以提高诊断准确性。"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card>
        <Form form={triggerForm} layout="vertical" onFinish={handleSubmit}>
          {/* Trigger Info */}
          <Title level={5}>触发信息</Title>
          <Form.Item
            name="triggerType"
            label="触发类型"
            rules={[{ required: true, message: '请选择触发类型' }]}
          >
            <Select
              placeholder="选择触发类型"
              options={[
                { label: '手动触发 (Manual)', value: 'manual' },
                { label: '自动触发 (Automated)', value: 'automated' },
                { label: '告警触发 (Alert)', value: 'alert' },
                { label: '定时触发 (Scheduled)', value: 'scheduled' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="triggerId"
            label="触发器ID"
            rules={[{ required: true, message: '请输入触发器ID' }]}
          >
            <Input placeholder="例如：pipeline-abc-123, alert-456" />
          </Form.Item>

          {/* Symptoms */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Title level={5} style={{ margin: 0 }}>
              症状列表
              {symptoms.length > 0 && (
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {symptoms.length} 个症状
                </Tag>
              )}
            </Title>
            <Button icon={<PlusOutlined />} onClick={addSymptom}>
              添加症状
            </Button>
          </div>

          {symptoms.length === 0 && (
            <Alert
              type="warning"
              message="暂无症状"
              description="点击「添加症状」按钮开始收集诊断症状，也可以先提交触发信息后再添加症状。"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          {symptoms.map((symptom, index) => (
            <Card
              key={index}
              size="small"
              style={{ marginBottom: 12, background: colors.neutral[50] }}
              title={`症状 #${index + 1}`}
              extra={
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeSymptom(index)}
                >
                  移除
                </Button>
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Form.Item label="症状类型" required>
                  <Input
                    placeholder="例如：high_latency"
                    value={symptom.type}
                    onChange={(e) => updateSymptom(index, 'type', e.target.value)}
                  />
                </Form.Item>
                <Form.Item label="来源" required>
                  <Input
                    placeholder="例如：api-gateway"
                    value={symptom.source}
                    onChange={(e) => updateSymptom(index, 'source', e.target.value)}
                  />
                </Form.Item>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Form.Item label="严重级别">
                  <Select
                    value={symptom.severity}
                    onChange={(value) => updateSymptom(index, 'severity', value)}
                    options={[
                      { label: '低', value: 'low' },
                      { label: '中', value: 'medium' },
                      { label: '高', value: 'high' },
                      { label: '严重', value: 'critical' },
                    ]}
                  />
                </Form.Item>
                <Form.Item label="描述">
                  <Input
                    placeholder="描述症状表现..."
                    value={symptom.description}
                    onChange={(e) => updateSymptom(index, 'description', e.target.value)}
                  />
                </Form.Item>
              </div>
            </Card>
          ))}

          {/* Submit */}
          <Form.Item style={{ marginTop: 24 }}>
            <Space>
              <Button
                type="primary"
                icon={<RocketOutlined />}
                htmlType="submit"
                loading={submitting}
                size="large"
              >
                {submitting ? '提交中...' : '触发诊断'}
              </Button>
              <Button onClick={() => triggerForm.resetFields()}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default DiagnosticTrigger;
