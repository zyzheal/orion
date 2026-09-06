/**
 * Dependencies Tab
 * Service dependency overview: summary statistics, selected-service detail
 * card, action bar, and side-by-side table + dependency tree.
 */
import React from 'react';
import { Button, Card, Col, Row, Space, Spin, Statistic, Tag, Text, Tree, Typography } from 'antd';
import { DeploymentUnitOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import Table from '@/components/Table';
import type { ServiceDependency, ServiceDetail } from '@/api/graph';
import { buildServiceColumns } from './columns';
import { buildServiceDependencyTreeData } from './ServiceDependencyTree';
import ServiceDetailCard from './ServiceDetailCard';

const { Text: TypoText } = Typography;

export interface DependenciesTabProps {
  services: ServiceDependency[];
  svcLoading: boolean;
  selectedService: ServiceDetail | null;
  onCloseServiceDetail: () => void;
  onSelectService: (id: string) => void;
  onRefresh: () => void;
}

const DependenciesTab: React.FC<DependenciesTabProps> = ({
  services,
  svcLoading,
  selectedService,
  onCloseServiceDetail,
  onSelectService,
  onRefresh,
}) => {
  const serviceColumns = React.useMemo(
    () => buildServiceColumns({ onSelectService }),
    [onSelectService]
  );
  const treeData = React.useMemo(
    () => buildServiceDependencyTreeData(services),
    [services]
  );

  return (
    <div>
      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="服务总数"
              value={services.length}
              prefix={<DeploymentUnitOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="运行中"
              value={services.filter((s) => s.status === 'running').length}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="降级"
              value={services.filter((s) => s.status === 'degraded').length}
              valueStyle={{ color: colors.warning[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已停止"
              value={services.filter((s) => s.status === 'stopped').length}
              valueStyle={{ color: colors.error[500] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Service Detail */}
      {selectedService && (
        <ServiceDetailCard detail={selectedService} onClose={onCloseServiceDetail} />
      )}

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        }}
      >
        <TypoText type="secondary">服务依赖关系概览</TypoText>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={svcLoading}>
          刷新
        </Button>
      </div>

      {/* Table + Tree */}
      <Row gutter={16}>
        <Col span={14}>
          <Spin spinning={svcLoading}>
            <Table
              columns={serviceColumns}
              dataSource={services}
              loading={svcLoading}
              rowKey="id"
              size="middle"
              striped
            />
          </Spin>
        </Col>
        <Col span={10}>
          <Card title="依赖树" size="small" style={{ maxHeight: 500, overflow: 'auto' }}>
            <Spin spinning={svcLoading}>
              {services.length === 0 ? (
                <Text type="secondary">暂无数据</Text>
              ) : (
                <Tree
                  treeData={treeData}
                  defaultExpandAll={false}
                  showLine
                  selectable
                  onSelect={(keys) => {
                    if (keys.length > 0) {
                      const key = String(keys[0]);
                      // If it's a root node (service ID), show detail
                      if (!key.includes('->')) {
                        onSelectService(key);
                      }
                    }
                  }}
                />
              )}
            </Spin>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DependenciesTab;
