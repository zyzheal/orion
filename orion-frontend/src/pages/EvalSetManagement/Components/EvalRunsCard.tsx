import { Button, Space, Card, Table, Empty } from 'antd';
import { ExportOutlined, SwapOutlined } from '@ant-design/icons';

interface Props {
  runs: any[];
  runColumns: any;
  selectedRuns: any[];
  setSelectedRuns: (r: any[]) => void;
  loading: boolean;
  exporting: boolean;
  onExport: () => void;
  onCompare: () => void;
}

export function EvalRunsCard({ runs, runColumns, selectedRuns, setSelectedRuns, loading, exporting, onExport, onCompare }: Props) {
  return (
    <Card
      title="评测运行记录"
      extra={
        <Space>
          <Button
            icon={<ExportOutlined />}
            loading={exporting}
            onClick={onExport}
            disabled={runs.length === 0}
          >
            导出报告
          </Button>
          <Button
            icon={<SwapOutlined />}
            onClick={onCompare}
            disabled={selectedRuns.length !== 2}
          >
            对比分析
          </Button>
        </Space>
      }
    >
      <Table
        dataSource={runs}
        columns={runColumns}
        rowKey="id"
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys: selectedRuns.map((r) => r.id),
          onChange: (keys) => {
            setSelectedRuns(runs.filter((r) => keys.includes(r.id)).slice(0, 2));
          },
        }}
        loading={loading}
        size="small"
        pagination={false}
        locale={{ emptyText: <Empty description="暂无评测运行记录" /> }}
      />
    </Card>
  );
}
