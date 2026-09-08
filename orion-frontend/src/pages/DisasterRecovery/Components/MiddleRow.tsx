import { Row, Col, Card, Table, Space, Button, Tag, Typography, Descriptions } from 'antd';
import { CloudServerOutlined, ReloadOutlined, PlusOutlined, HistoryOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { useDisasterRecoveryState } from '../useDisasterRecoveryState';

const { Text } = Typography;

type State = ReturnType<typeof useDisasterRecoveryState>;

interface Props {
  state: State;
  rtoRpoColumns: any;
  drillColumns: any;
}

export function MiddleRow({ state: s, rtoRpoColumns, drillColumns }: Props) {
  return (
    <Row gutter={16} style={{ marginBottom: spacing.md }}>
      {/* Left: RTO/RPO Configuration Table */}
      <Col span={14}>
        <Card
          title={
            <Space>
              <CloudServerOutlined />
              <Text strong>RTO/RPO 配置</Text>
            </Space>
          }
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} size="small" loading={s.loading} onClick={s.handleRefresh} />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="small"
                onClick={() => s.setCreateModalOpen(true)}
              >
                新建灾备计划
              </Button>
            </Space>
          }
          style={{ borderRadius: 12 }}
        >
          <Table
            columns={rtoRpoColumns}
            dataSource={s.rtoRpoRecords}
            rowKey="id"
            size="small"
            pagination={false}
            loading={s.loading}
          />
        </Card>
      </Col>

      {/* Right: Drill History */}
      <Col span={10}>
        <Card
          title={
            <Space>
              <HistoryOutlined />
              <Text strong>灾备演练历史</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                (最近 5 次)
              </Text>
            </Space>
          }
          style={{ borderRadius: 12 }}
        >
          <Table
            columns={drillColumns}
            dataSource={s.drillRecords}
            rowKey="id"
            size="small"
            pagination={false}
            expandable={{
              expandedRowRender: (record) => (
                <Descriptions column={1} size="small" style={{ margin: 0, padding: '8px 16px' }}>
                  <Descriptions.Item label="服务">
                    <Tag color="blue">{record.service}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="描述">
                    <Text>{record.description}</Text>
                  </Descriptions.Item>
                </Descriptions>
              ),
            }}
          />
        </Card>
      </Col>
    </Row>
  );
}
