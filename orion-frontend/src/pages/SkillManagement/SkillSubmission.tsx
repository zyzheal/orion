/**
 * Skill Submission - Submit new skill form with metadata
 */
import React, { useState } from 'react';
import { Typography, Button, Space, Card, Form, Input, Select, message, Tag } from 'antd';
import { PlusOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { createSkill, type SkillPackageInput } from '@/api/skills';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const categoryOptions = [
  { label: 'CI/CD', value: 'ci-cd' },
  { label: '数据库', value: 'database' },
  { label: '监控', value: 'monitoring' },
  { label: '安全', value: 'security' },
  { label: 'AI/ML', value: 'ai-ml' },
  { label: '基础设施', value: 'infrastructure' },
];

const SkillSubmission: React.FC = () => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [submittedSkills, setSubmittedSkills] = useState<SkillPackageInput[]>([]);

  const handleAddTag = () => {
    if (tagInput && !tags.includes(tagInput)) {
      setTags([...tags, tagInput]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload: SkillPackageInput = {
        name: values.name,
        version: values.version || '1.0.0',
        description: values.description,
        category: values.category,
        tags,
        content: values.content,
      };
      await createSkill(payload);
      message.success('技能提交成功');
      form.resetFields();
      setTags([]);
      setSubmittedSkills((prev) => [...prev, payload]);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : '提交失败，请检查表单';
        message.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: spacing[6] }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          技能提交
        </Title>
        <Text type="secondary">提交新的技能包到社区市场</Text>
      </div>

      <Card
        title={
          <Space>
            <PlusOutlined />
            提交新技能
          </Space>
        }
        style={{ marginBottom: spacing[6] }}
      >
        <Form form={form} layout="vertical" style={{ maxWidth: 700 }}>
          <Form.Item
            name="name"
            label="技能名称"
            rules={[{ required: true, message: '请输入技能名称' }]}
          >
            <Input placeholder="例如: Kubernetes 健康检查" />
          </Form.Item>

          <Form.Item name="version" label="版本号" initialValue="1.0.0">
            <Input placeholder="1.0.0" />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="选择分类" options={categoryOptions} />
          </Form.Item>

          <Form.Item label="标签">
            <Space wrap>
              {tags.map((tag) => (
                <Tag key={tag} closable onClose={() => handleRemoveTag(tag)}>
                  {tag}
                </Tag>
              ))}
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onPressEnter={handleAddTag}
                style={{ width: 120 }}
                placeholder="+ 标签"
                size="small"
              />
            </Space>
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <TextArea rows={3} placeholder="详细描述技能的功能和使用场景..." />
          </Form.Item>

          <Form.Item name="content" label="技能内容">
            <TextArea rows={8} placeholder="技能的详细内容（YAML/JSON 配置或代码）..." />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSubmit}
              loading={submitting}
            >
              提交技能
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Submission History */}
      {submittedSkills.length > 0 && (
        <Card title="提交历史" extra={<Text type="secondary">本次会话提交</Text>}>
          {submittedSkills.map((skill, index) => (
            <div
              key={index}
              style={{
                marginBottom: spacing[3],
                paddingBottom: spacing[3],
                borderBottom:
                  index < submittedSkills.length - 1
                    ? `1px solid ${colors.light.border.light}`
                    : 'none',
              }}
            >
              <Space>
                <Text strong>{skill.name}</Text>
                <Tag>v{skill.version}</Tag>
                <Tag color="blue">{skill.category}</Tag>
                <Text type="secondary">{dayjs().fromNow()}</Text>
              </Space>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

export default SkillSubmission;
