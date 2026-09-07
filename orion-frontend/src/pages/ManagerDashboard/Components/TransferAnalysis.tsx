/**
 * ManagerDashboard TransferAnalysis
 * 抽取自 index.tsx (P2-9 Phase 181)
 */
import { Row, Col, Table } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import CardPanel from '@/components/CardPanel';
import { PieChart } from '@/components/charts';
import type { ManagerDashboardData } from '@/types/pages';
import { buildTransferColumns } from '../columns';

type TransferAnalysisData = ManagerDashboardData['transferAnalysis'];

interface TransferAnalysisProps {
  transferAnalysis: TransferAnalysisData;
}

export const TransferAnalysis = ({ transferAnalysis }: TransferAnalysisProps) => (
  <Row gutter={[16, 16]}>
    <Col xs={24} xl={14}>
      <CardPanel title="转派分析" extra={<SwapOutlined />}>
        <PieChart
          title="转派原因分布"
          data={transferAnalysis.topTransferReasons.map((r) => ({
            name: r.reason,
            value: r.count,
          }))}
          variant="donut"
          height={200}
        />
      </CardPanel>
    </Col>
    <Col xs={24} xl={10}>
      <CardPanel title="主要转派原因">
        <Table
          dataSource={transferAnalysis.topTransferReasons}
          columns={buildTransferColumns()}
          rowKey="reason"
          pagination={false}
          size="small"
        />
      </CardPanel>
    </Col>
  </Row>
);
