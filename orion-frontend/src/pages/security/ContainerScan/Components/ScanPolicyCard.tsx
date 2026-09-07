/**
 * ContainerScan Policy Card
 * 抽取自 index.tsx (P2-9 Phase 133)
 */
import React from 'react';
import { Card, Form, Space, Select, Row, Col, Switch, Button, Tooltip, message } from 'antd';
import { StopOutlined, SettingOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ScanPolicy } from '../types';
import { commonStyle } from '../constants';

const { Option } = Select;

interface ScanPolicyCardProps {
  policy: ScanPolicy;
  setPolicy: (updater: (prev: ScanPolicy) => ScanPolicy) => void;
  policyForm: import('antd').FormInstance;
}

export const ScanPolicyCard: React.FC<ScanPolicyCardProps> = ({
  policy,
  setPolicy,
  policyForm,
}) => (
  <Card
    title={
      <Space>
        <SettingOutlined />
        <span>扫描策略</span>
      </Space>
    }
    style={{
      borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    }}
  >
    <Form
      form={policyForm}
      layout="horizontal"
      initialValues={policy}
      style={{ maxWidth: 700, margin: '0 auto' }}
    >
      <Row gutter={[spacing.lg, spacing.md]}>
        <Col span={12}>
          <Form.Item label="扫描引擎" name="engine">
            <Select placeholder="选择扫描引擎">
              <Option value="Trivy">Trivy</Option>
              <Option value="Clair">Clair</Option>
              <Option value="Aqua">Aqua</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="扫描频率" name="frequency">
            <Select placeholder="选择扫描频率">
              <Option value="每次推送">每次推送</Option>
              <Option value="每日">每日</Option>
              <Option value="每周">每周</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="漏洞阈值" name="threshold">
            <Select placeholder="选择漏洞阈值">
              <Option value="Critical only">Critical only</Option>
              <Option value="Critical+High">Critical+High</Option>
              <Option value="All">All</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="自动阻止部署" name="autoBlock" valuePropName="checked">
            <Switch
              checkedChildren="开启"
              unCheckedChildren="关闭"
              onChange={(checked: boolean) => {
                setPolicy((prev) => ({ ...prev, autoBlock: checked }));
                message.info(checked ? '自动阻止部署已开启' : '自动阻止部署已关闭');
              }}
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item style={{ textAlign: 'right', marginTop: spacing.sm }}>
        <Tooltip title="扫描策略保存 API 开发中">
          <Button
            type="primary"
            icon={<StopOutlined />}
            disabled
            style={{
              backgroundColor: commonStyle.neutral,
              borderColor: commonStyle.neutral,
              minWidth: 120,
            }}
          >
            保存策略
          </Button>
        </Tooltip>
      </Form.Item>
    </Form>
  </Card>
);
