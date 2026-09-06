/**
 * InstancesTab.tsx - 流程实例 Tab
 * 抽取自 ProcessStep/index.tsx (P2-9 Phase 96)
 */
import React, { useMemo } from 'react';
import { Card, Row, Col, Space, Select, Button, Table } from 'antd';
import { ReloadOutlined, RocketOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ProcessInstance } from '@/api/process-steps';
import { statusLabel } from '../constants';
import { makeInstColumns } from '../columns';

interface InstancesTabProps {
  instances: ProcessInstance[];
  instLoading: boolean;
  instTotal: number;
  instPage: number;
  setInstPage: (n: number) => void;
  setInstFilter: (updater: (f: { status?: string; definitionId?: string }) => { status?: string; definitionId?: string }) => void;
  fetchInstances: () => void;
  handleStartInstance: (defId?: string) => void;
  handleViewInstance: (id: string) => void;
}

export const InstancesTab: React.FC<InstancesTabProps> = (props) => {
  const columns = useMemo(
    () => makeInstColumns({ handleViewInstance: props.handleViewInstance }),
    [props.handleViewInstance],
  );

  return (
    <Card>
      <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
        <Col>
          <Space>
            <Select
              placeholder="状态筛选"
              allowClear
              style={{ width: 140 }}
              onChange={(v) => props.setInstFilter((f) => ({ ...f, status: v }))}
              options={Object.entries(statusLabel).map(([k, v]) => ({
                label: v,
                value: k,
              }))}
            />
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={props.fetchInstances}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={() => props.handleStartInstance()}
            >
              启动实例
            </Button>
          </Space>
        </Col>
      </Row>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={props.instances}
        loading={props.instLoading}
        pagination={{
          current: props.instPage,
          total: props.instTotal,
          pageSize: 20,
          onChange: props.setInstPage,
          showTotal: (t) => `共 ${t} 条`,
        }}
      />
    </Card>
  );
};
