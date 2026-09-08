/**
 * AI Model Evolution Dashboard (A7 技术演进)
 *
 * 模型能力矩阵、版本对比、采用率、灰度状态。
 *
 * 拆分自 index.tsx (P2-9 Phase 199)
 */
import { useMemo } from 'react';
import { Card, Select, Table } from 'antd';
import { useModelEvolutionState } from './useModelEvolutionState';
import { buildColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { InfoRow } from './Components/InfoRow';

const ModelEvolution = () => {
  const {
    loading,
    models,
    selectedProvider,
    setSelectedProvider,
    loadModels,
    filtered,
    totalRequests,
  } = useModelEvolutionState();

  const columns = useMemo(() => buildColumns(), []);

  return (
    <div style={{ padding: 0 }}>
      <PageHeader loading={loading} onRefresh={loadModels} />

      <StatsRow models={models} />

      <Card
        title="模型能力矩阵"
        extra={
          <Select
            options={[
              { label: '全部供应商', value: 'all' },
              ...[...new Set(models.map((m) => m.provider))].map((p: string) => ({
                label: p,
                value: p,
              })),
            ]}
            value={selectedProvider}
            onChange={setSelectedProvider}
            allowClear
            style={{ width: 150 }}
            size="small"
          />
        }
      >
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
        />
      </Card>

      <InfoRow models={models} totalRequests={totalRequests} />
    </div>
  );
};

export default ModelEvolution;
