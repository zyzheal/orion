/**
 * ChaosEngineering Experiments Table
 * 抽取自 index.tsx (P2-9 Phase 132)
 */
import React from 'react';
import { Card, Table, Button, Space } from 'antd';
import { ThunderboltOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ChaosExperiment } from '@/api/chaos';
import { buildExperimentColumns } from '../experimentColumns';

interface ExperimentsTableProps {
  experiments: ChaosExperiment[];
  loading: boolean;
  runningId: string | null;
  openDetail: (exp: ChaosExperiment) => void;
  handleRunExperiment: (experimentId: string) => void;
  openCreate: () => void;
  loadData: () => void;
}

export const ExperimentsTable: React.FC<ExperimentsTableProps> = ({
  experiments,
  loading,
  runningId,
  openDetail,
  handleRunExperiment,
  openCreate,
  loadData,
}) => (
  <Card
    title={
      <>
        <ThunderboltOutlined style={{ marginRight: spacing.sm }} />
        混沌实验列表
      </>
    }
    extra={
      <Space>
        <Button icon={<PlusOutlined />} type="primary" onClick={openCreate}>
          创建实验
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </Space>
    }
  >
    <Table
      columns={buildExperimentColumns({ openDetail, handleRunExperiment, runningId })}
      dataSource={experiments}
      rowKey="id"
      loading={loading}
      pagination={{ pageSize: 10, showSizeChanger: true }}
    />
  </Card>
);
