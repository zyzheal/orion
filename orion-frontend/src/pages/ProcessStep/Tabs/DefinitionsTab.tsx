/**
 * DefinitionsTab.tsx - 流程定义 Tab
 * 抽取自 ProcessStep/index.tsx (P2-9 Phase 96)
 */
import React, { useMemo } from 'react';
import { Card, Row, Col, Space, Select, Button, Table } from 'antd';
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ProcessDefinition } from '@/api/process-steps';
import { makeDefColumns } from '../columns';

interface DefinitionsTabProps {
  definitions: ProcessDefinition[];
  defLoading: boolean;
  defTotal: number;
  defPage: number;
  setDefPage: (n: number) => void;
  setDefFilter: (updater: (f: { entityType?: string; enabled?: boolean }) => { entityType?: string; enabled?: boolean }) => void;
  fetchDefinitions: () => void;
  handleCreateDef: () => void;
  handleViewDefDetail: (id: string) => void;
  handleEditDef: (def: ProcessDefinition) => void;
  handleDeleteDef: (id: string) => void;
  handleStartInstance: (defId?: string) => void;
}

export const DefinitionsTab: React.FC<DefinitionsTabProps> = (props) => {
  const columns = useMemo(
    () =>
      makeDefColumns({
        handleViewDefDetail: props.handleViewDefDetail,
        handleEditDef: props.handleEditDef,
        handleDeleteDef: props.handleDeleteDef,
        handleStartInstance: props.handleStartInstance,
      }),
    [
      props.handleViewDefDetail,
      props.handleEditDef,
      props.handleDeleteDef,
      props.handleStartInstance,
    ],
  );

  return (
    <Card>
      <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
        <Col>
          <Space>
            <Select
              placeholder="实体类型"
              allowClear
              style={{ width: 140 }}
              onChange={(v) => props.setDefFilter((f) => ({ ...f, entityType: v }))}
              options={[
                { label: '工单', value: 'ticket' },
                { label: '变更', value: 'change' },
                { label: '发布', value: 'release' },
              ]}
            />
            <Select
              placeholder="启用状态"
              allowClear
              style={{ width: 120 }}
              onChange={(v) => props.setDefFilter((f) => ({ ...f, enabled: v }))}
              options={[
                { label: '启用', value: true },
                { label: '禁用', value: false },
              ]}
            />
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={props.fetchDefinitions}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={props.handleCreateDef}>
              新建定义
            </Button>
          </Space>
        </Col>
      </Row>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={props.definitions}
        loading={props.defLoading}
        pagination={{
          current: props.defPage,
          total: props.defTotal,
          pageSize: 20,
          onChange: props.setDefPage,
          showTotal: (t) => `共 ${t} 条`,
        }}
      />
    </Card>
  );
};
