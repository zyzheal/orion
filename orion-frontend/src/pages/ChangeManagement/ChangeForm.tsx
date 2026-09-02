/**
 * Change Request Form — shared between create and edit modals
 *
 * Extracted from index.tsx to reduce main file size.
 * Renders a vertical Form with all change request fields.
 */
import { Form, Input, Select, Row, Col, DatePicker } from 'antd';
import { spacing } from '@/tokens';
import { typeConfig, priorityConfig, riskConfig } from './config';

const { TextArea } = Input;

interface ChangeFormProps {
  formInstance: ReturnType<typeof Form.useForm>[0];
}

export function ChangeForm({ formInstance }: ChangeFormProps) {
  return (
    <Form form={formInstance} layout="vertical" style={{ marginTop: spacing.md }}>
      <Row gutter={spacing.md}>
        <Col span={24}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入变更标题' }]}
          >
            <Input placeholder="简要描述变更内容" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item
            name="type"
            label="变更类型"
            rules={[{ required: true, message: '请选择变更类型' }]}
          >
            <Select placeholder="选择变更类型">
              {Object.entries(typeConfig).map(([key, cfg]) => (
                <Select.Option key={key} value={key}>
                  {cfg.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="priority"
            label="优先级"
            rules={[{ required: true, message: '请选择优先级' }]}
          >
            <Select placeholder="选择优先级">
              {Object.entries(priorityConfig).map(([key, cfg]) => (
                <Select.Option key={key} value={key}>
                  {cfg.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item
            name="risk_level"
            label="风险等级"
            rules={[{ required: true, message: '请选择风险等级' }]}
          >
            <Select placeholder="选择风险等级">
              {Object.entries(riskConfig).map(([key, cfg]) => (
                <Select.Option key={key} value={key}>
                  {cfg.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="category" label="分类">
            <Input placeholder="变更分类（可选）" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="description" label="描述">
        <TextArea rows={3} placeholder="详细描述变更内容" />
      </Form.Item>
      <Form.Item name="impact_description" label="影响描述">
        <TextArea rows={2} placeholder="描述变更可能产生的影响" />
      </Form.Item>
      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item name="implementation_plan" label="实施计划">
            <TextArea rows={2} placeholder="变更实施步骤" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="rollback_plan" label="回滚计划">
            <TextArea rows={2} placeholder="变更回滚方案" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item name="scheduled_start" label="计划开始时间">
            <DatePicker showTime style={{ width: '100%' }} placeholder="选择计划开始时间" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="scheduled_end" label="计划结束时间">
            <DatePicker showTime style={{ width: '100%' }} placeholder="选择计划结束时间" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item name="assigned_to" label="负责人">
            <Input placeholder="变更负责人" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="affected_services" label="受影响服务" help="多个服务用逗号分隔">
            <Input placeholder="service-a, service-b" />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
}
