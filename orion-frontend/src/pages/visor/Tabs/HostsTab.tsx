/**
 * HostsTab.tsx - 主机管理 Tab
 * 抽取自 VisorPage.tsx (P2-9 Phase 94)
 */
import React, { useMemo } from 'react';
import { Row, Col, Card, Statistic, Button, Space, Modal, Form, Input, Select } from 'antd';
import { CloudServerOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import Table from '@/components/Table';
import type { Host } from '@/api/visor';
import type { HostFormValues } from '../useVisorState';
import { makeHostColumns } from '../columns';
import { OS_OPTIONS } from '../constants';

interface HostsTabProps {
  hosts: Host[];
  hostLoading: boolean;
  hostModalVisible: boolean;
  setHostModalVisible: (v: boolean) => void;
  hostForm: ReturnType<typeof Form.useForm<HostFormValues>>[0];
  hostSubmitting: boolean;
  hostStats: { total: number; online: number; offline: number; error: number };
  loadHosts: () => void;
  handleAddHost: () => void;
  handleRemoveHost: (id: string) => void;
  handleViewHostStatus: (id: string) => void;
}

export const HostsTab: React.FC<HostsTabProps> = (props) => {
  const hostColumns = useMemo(
    () => makeHostColumns(props.handleRemoveHost, props.handleViewHostStatus),
    [props.handleRemoveHost, props.handleViewHostStatus]
  );

  return (
    <div>
      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="主机总数" value={props.hostStats.total} prefix={<CloudServerOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="在线"
              value={props.hostStats.online}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="离线"
              value={props.hostStats.offline}
              valueStyle={{ color: colors.neutral[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="异常"
              value={props.hostStats.error}
              valueStyle={{ color: colors.error[500] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={props.loadHosts} loading={props.hostLoading}>
            刷新
          </Button>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => props.setHostModalVisible(true)}
        >
          添加主机
        </Button>
      </div>

      {/* Hosts Table */}
      <Table
        columns={hostColumns}
        dataSource={props.hosts}
        loading={props.hostLoading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Add Host Modal */}
      <Modal
        title="添加主机"
        open={props.hostModalVisible}
        onCancel={() => props.setHostModalVisible(false)}
        onOk={props.handleAddHost}
        confirmLoading={props.hostSubmitting}
        width={500}
        destroyOnClose
      >
        <Form form={props.hostForm} layout="vertical">
          <Form.Item
            name="hostname"
            label="主机名"
            rules={[{ required: true, message: '请输入主机名' }]}
          >
            <Input placeholder="如: prod-web-01" />
          </Form.Item>
          <Form.Item name="ip" label="IP地址" rules={[{ required: true, message: '请输入IP地址' }]}>
            <Input placeholder="如: 10.0.0.1" />
          </Form.Item>
          <Form.Item name="os" label="操作系统" initialValue="linux">
            <Select options={OS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
