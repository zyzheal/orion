/**
 * Service Boundary - 服务边界与模块耦合分析
 * P2-9 Phase 268 refactor: 已抽取 types / constants / useServiceBoundaryState /
 * Columns / Components/{PageHeader,StatsRow,BootMaturityCard,FrontendCard,ModuleDetailModal}
 */
import { Card, Row, Col, Table, Alert, Button, Empty } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import { useServiceBoundaryState } from './useServiceBoundaryState';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { BootMaturityCard } from './Components/BootMaturityCard';
import { FrontendCard } from './Components/FrontendCard';
import { ModuleDetailModal } from './Components/ModuleDetailModal';

const ServiceBoundaryPage = () => {
  const state = useServiceBoundaryState();

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />
      {state.loading ? (
        <PageSkeleton rows={6} />
      ) : (
        <>
          <StatsRow state={state} />
          <Alert
            message="核心结论"
            description="Go 后端零循环依赖 · 前端零循环依赖 · 接口层覆盖率极低(5%) · Top 4 模块(ai/notification/ci-cd/ticketing)被100+模块引用，接口变更风险极高"
            type="info"
            showIcon
            style={{ marginBottom: spacing.md }}
          />
          <Row gutter={[spacing.md, spacing.md]}>
            <Col span={16}>
              <Card
                title="跨模块引用耦合度 (Go 后端)"
                extra={
                  <Button icon={<ReloadOutlined />} onClick={state.load}>
                    刷新
                  </Button>
                }
              >
                <Table
                  dataSource={state.safeModules}
                  columns={state.moduleColumns}
                  rowKey="module"
                  size="small"
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: <Empty description="暂无数据" /> }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <BootMaturityCard />
              <FrontendCard />
            </Col>
          </Row>
          <Alert
            message="治理建议"
            description="① 对 ai/notification/ci-cd/ticketing 建立接口层 ② 引入配置中心+热加载 ③ 按子域拆分 ai/ci-cd 聚合容器 ④ 前端路由2230行按模块拆分"
            type="warning"
            showIcon
            style={{ marginTop: spacing.md }}
          />
        </>
      )}
      <ModuleDetailModal selected={state.selected} onClose={() => state.setSelected(null)} />
    </div>
  );
};

export default ServiceBoundaryPage;
