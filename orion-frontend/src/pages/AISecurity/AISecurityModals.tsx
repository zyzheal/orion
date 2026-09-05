/**
 * AISecurity Modals
 */
import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tag,
  Badge,
  Descriptions,
  Progress,
  Typography,
  Spin,
  Checkbox,
} from 'antd';
import { SecurityScanOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import type {
  UISecurityPolicy,
  PolicyEvaluation,
  SecurityStats,
  PolicyStatus,
  PolicySeverity,
} from '@/api/security-policies';

type FormInstance = ReturnType<typeof Form.useForm>[0];
const { Title, Text } = Typography;

interface AISecurityModalsProps {
  loading: boolean;
  policies: UISecurityPolicy[];
  stats: SecurityStats | null;
  createModalVisible: boolean;
  setCreateModalVisible: (v: boolean) => void;
  editModalVisible: boolean;
  setEditModalVisible: (v: boolean) => void;
  editPolicy: UISecurityPolicy | null;
  setEditPolicy: (v: UISecurityPolicy | null) => void;
  evaluateModalVisible: boolean;
  setEvaluateModalVisible: (v: boolean) => void;
  detailModalVisible: boolean;
  setDetailModalVisible: (v: boolean) => void;
  selectedPolicy: UISecurityPolicy | null;
  setSelectedPolicy: (v: UISecurityPolicy | null) => void;
  evaluations: PolicyEvaluation[];
  submitting: boolean;
  createForm: FormInstance;
  editForm: FormInstance;
  handleCreate: () => void;
  handleEdit: () => void;
  handleEvaluate: () => void;
  getComplianceColor: (score: number) => string;
  severityLabelMap: Record<string, string>;
  severityColorMap: Record<string, string>;
  statusColorMap: Record<string, string>;
  statusLabelMap: Record<string, string>;
  policyTypeOptions: { label: string; value: string }[];
  severityOptions: { label: string; value: string }[];
}

export const AISecurityModals: React.FC<AISecurityModalsProps> = (props) => (
  <>
        {/* Create Policy Modal */}
        <Modal
          title="创建安全策略"
          open={props.createModalVisible}
          onCancel={() => props.setCreateModalVisible(false)}
          onOk={props.handleCreate}
          confirmLoading={props.submitting}
          width={600}
          destroyOnClose
        >
          <Form form={props.createForm} layout="vertical">
            <Form.Item
              name="name"
              label="策略名称"
              rules={[{ required: true, message: '请输入策略名称' }]}
            >
              <Input placeholder="如: SQL 注入防护" />
            </Form.Item>
            <Form.Item
              name="type"
              label="策略类型"
              rules={[{ required: true, message: '请选择策略类型' }]}
            >
              <Select>
                <Select.Option value="input_validation">输入验证</Select.Option>
                <Select.Option value="output_filtering">输出过滤</Select.Option>
                <Select.Option value="pii_detection">PII 检测</Select.Option>
                <Select.Option value="rate_limiting">速率限制</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="severity"
              label="严重级别"
              rules={[{ required: true, message: '请选择严重级别' }]}
              initialValue="medium"
            >
              <Select>
                <Select.Option value="low">低</Select.Option>
                <Select.Option value="medium">中</Select.Option>
                <Select.Option value="high">高</Select.Option>
                <Select.Option value="critical">严重</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={3} placeholder="策略描述..." />
            </Form.Item>
            <Form.Item name="rules" label="规则 (逗号分隔)">
              <Input.TextArea rows={2} placeholder="如: block_sql_keywords, escape_special_chars" />
            </Form.Item>
            <Form.Item name="enabled" label="启用状态" valuePropName="checked" initialValue={true}>
              <Select>
                <Select.Option value={true}>启用</Select.Option>
                <Select.Option value={false}>禁用</Select.Option>
              </Select>
            </Form.Item>
          </Form>
        </Modal>

        {/* Edit Policy Modal */}
        <Modal
          title="编辑安全策略"
          open={props.editModalVisible}
          onCancel={() => {
            props.setEditModalVisible(false);
            props.setEditPolicy(null);
          }}
          onOk={props.handleEdit}
          confirmLoading={props.submitting}
          width={600}
          destroyOnClose
        >
          <Form form={props.editForm} layout="vertical">
            <Form.Item
              name="name"
              label="策略名称"
              rules={[{ required: true, message: '请输入策略名称' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="type"
              label="策略类型"
              rules={[{ required: true, message: '请选择策略类型' }]}
            >
              <Select>
                <Select.Option value="input_validation">输入验证</Select.Option>
                <Select.Option value="output_filtering">输出过滤</Select.Option>
                <Select.Option value="pii_detection">PII 检测</Select.Option>
                <Select.Option value="rate_limiting">速率限制</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="severity"
              label="严重级别"
              rules={[{ required: true, message: '请选择严重级别' }]}
            >
              <Select>
                <Select.Option value="low">低</Select.Option>
                <Select.Option value="medium">中</Select.Option>
                <Select.Option value="high">高</Select.Option>
                <Select.Option value="critical">严重</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="rules" label="规则 (逗号分隔)">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="enabled" label="启用状态" valuePropName="checked">
              <Select>
                <Select.Option value={true}>启用</Select.Option>
                <Select.Option value={false}>禁用</Select.Option>
              </Select>
            </Form.Item>
          </Form>
        </Modal>

        {/* Evaluate Policy Modal */}
        <Modal
          title="策略评估"
          open={props.evaluateModalVisible}
          onCancel={() => props.setEvaluateModalVisible(false)}
          onOk={props.handleEvaluate}
          confirmLoading={props.submitting}
          width={700}
        >
          <Alert
            message="策略评估说明"
            description="策略评估将运行预定义的测试用例，验证每个安全策略是否按预期工作。评估过程可能需要几分钟。"
            type="info"
            showIcon
            style={{ marginBottom: spacing.md }}
          />
          <Title level={5}>最近评估结果</Title>
          <AntTable
            dataSource={props.evaluations}
            rowKey="policyId"
            pagination={false}
            size="small"
            columns={[
              {
                title: '策略',
                dataIndex: 'policyName',
                key: 'policyName',
              },
              {
                title: '结果',
                key: 'result',
                render: (_: unknown, record: PolicyEvaluation) => {
                  const config: Record<
                    string,
                    { color: string; icon: React.ReactNode; text: string }
                  > = {
                    pass: { color: 'green', icon: <CheckCircleOutlined />, text: '通过' },
                    fail: { color: 'red', icon: <CloseCircleOutlined />, text: '失败' },
                    warning: { color: 'orange', icon: <WarningOutlined />, text: '警告' },
                  };
                  const c = config[record.result];
                  return (
                    <Tag color={c.color} icon={c.icon}>
                      {c.text}
                    </Tag>
                  );
                },
              },
              {
                title: '时间',
                dataIndex: 'timestamp',
                key: 'timestamp',
                render: (value: unknown) => dayjs(String(value)).format('YYYY-MM-DD HH:mm'),
              },
              {
                title: '详情',
                dataIndex: 'details',
                key: 'details',
                ellipsis: true,
              },
            ]}
          />
        </Modal>

        {/* Policy Detail Modal */}
        <Modal
          title={props.selectedPolicy ? props.selectedPolicy.name : '策略详情'}
          open={props.detailModalVisible}
          onCancel={() => {
            props.setDetailModalVisible(false);
            props.setSelectedPolicy(null);
          }}
          footer={[
            <Button
              key="close"
              onClick={() => {
                props.setDetailModalVisible(false);
                props.setSelectedPolicy(null);
              }}
            >
              关闭
            </Button>,
          ]}
          width={650}
        >
          {props.selectedPolicy && (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="策略名称">{props.selectedPolicy.name}</Descriptions.Item>
                <Descriptions.Item label="类型">
                  <Tag icon={typeIconMap[props.selectedPolicy.type]} color="blue">
                    {typeLabelMap[props.selectedPolicy.type]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="严重级别">
                  <Tag color={props.severityColorMap[props.selectedPolicy.severity]}>
                    {props.severityLabelMap[props.selectedPolicy.severity]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={props.statusColorMap[props.selectedPolicy.status]}>
                    {props.statusLabelMap[props.selectedPolicy.status]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="违规次数">
                  <Badge
                    count={props.selectedPolicy.violations}
                    style={{
                      backgroundColor:
                        props.selectedPolicy.violations > 0 ? colors.error[500] : colors.success[500],
                    }}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="启用状态">
                  {props.selectedPolicy.enabled ? (
                    <Tag color="green">已启用</Tag>
                  ) : (
                    <Tag color="default">已禁用</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="创建人">{props.selectedPolicy.createdBy}</Descriptions.Item>
                <Descriptions.Item label="最后更新">
                  {dayjs(props.selectedPolicy.lastUpdated).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="描述" span={2}>
                  {props.selectedPolicy.description}
                </Descriptions.Item>
              </Descriptions>
              <div>
                <Title level={5}>策略规则</Title>
                <Space wrap>
                  {props.selectedPolicy.rules.map((rule, idx) => (
                    <Tag key={String(idx)} icon={<SecurityScanOutlined />}>
                      {rule}
                    </Tag>
                  ))}
                </Space>
              </div>
              {props.stats && (
                <div>
                  <Title level={5}>合规评分概览</Title>
                  <Progress
                    percent={props.stats.complianceScore}
                    strokeColor={props.getComplianceColor(props.stats.complianceScore)}
                    format={() => `${props.stats.complianceScore}%`}
                  />
                </div>
              )}
            </Space>
          )}
        </Modal>
  </>
);
