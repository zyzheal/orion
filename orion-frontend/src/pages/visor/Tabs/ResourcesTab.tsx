/**
 * ResourcesTab.tsx - 资源监控 Tab
 * 抽取自 VisorPage.tsx (P2-9 Phase 94)
 */
import React, { useMemo } from 'react';
import { Row, Col, Card, Select, Button, Space, Spin, Tag, Typography } from 'antd';
import { CloudServerOutlined, DashboardOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { Host, ResourceUsage } from '@/api/visor';
import { resourceTypeIconMap, resourceTypeLabelMap, RESOURCE_TYPE_OPTIONS } from '../constants';

const { Text } = Typography;

interface ResourcesTabProps {
  hosts: Host[];
  resources: ResourceUsage[];
  filteredResources: ResourceUsage[];
  resourceLoading: boolean;
  resourceTypeFilter: string;
  loadResources: () => void;
  handleFilterByType: (type: string) => void;
}

export const ResourcesTab: React.FC<ResourcesTabProps> = (props) => {
  const filteredResourcesByHost = useMemo(() => {
    return props.filteredResources.reduce<Record<string, ResourceUsage[]>>((acc, r) => {
      if (!acc[r.hostId]) acc[r.hostId] = [];
      acc[r.hostId].push(r);
      return acc;
    }, {} as Record<string, ResourceUsage[]>);
  }, [props.filteredResources]);

  return (
    <div>
      {/* Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Space>
          <Select
            style={{ width: 140 }}
            value={props.resourceTypeFilter}
            onChange={props.handleFilterByType}
            options={RESOURCE_TYPE_OPTIONS}
          />
          <Button icon={<ReloadOutlined />} onClick={props.loadResources} loading={props.resourceLoading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Resource Cards */}
      <Spin spinning={props.resourceLoading}>
        {Object.keys(filteredResourcesByHost).length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 40 }}>
            <DashboardOutlined style={{ fontSize: 48, color: colors.neutral[300] }} />
            <p style={{ marginTop: spacing.md, color: colors.neutral[500] }}>暂无资源监控数据</p>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {Object.entries(filteredResourcesByHost).map(([hostId, resList]) => {
              const host = props.hosts.find((h) => h.id === hostId);
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={hostId}>
                  <Card
                    size="small"
                    title={
                      <Space>
                        <CloudServerOutlined />
                        {host?.hostname || hostId.slice(0, 8)}
                      </Space>
                    }
                  >
                    {resList.map((r) => (
                      <div
                        key={r.type}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: spacing[3],
                        }}
                      >
                        <Space>
                          {resourceTypeIconMap[r.type] || <DashboardOutlined />}
                          <Text>{resourceTypeLabelMap[r.type] || r.type}</Text>
                        </Space>
                        <Space>
                          <Tag color={r.usage > 80 ? 'red' : r.usage > 50 ? 'orange' : 'green'}>
                            {r.usage}
                            {r.unit}
                          </Tag>
                        </Space>
                      </div>
                    ))}
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      更新时间: {resList[0]?.timestamp || '-'}
                    </Text>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Spin>
    </div>
  );
};
