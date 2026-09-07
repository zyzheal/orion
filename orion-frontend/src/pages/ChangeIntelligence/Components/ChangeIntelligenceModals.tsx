/**
 * ChangeIntelligenceModals - 2 Modal (触发分析 + 报告详情)
 * 抽取自 index.tsx (P2-9 Phase 119)
 */
import React, { useMemo } from 'react';
import { Modal, Form, Input, Descriptions, Row, Col, Card, Table, Tag, Typography } from 'antd';
import { colors, spacing, themeVars } from '@/tokens';
import type { ChangeIntelligenceState } from '../useChangeIntelligenceState';
import { riskLevelColor, buildAffectedServiceColumns } from '../changeColumns';

const { Text } = Typography;

interface ChangeIntelligenceModalsProps {
  state: ChangeIntelligenceState;
}

export const ChangeIntelligenceModals: React.FC<ChangeIntelligenceModalsProps> = ({ state }) => {
  const {
    analyzeModalVisible,
    setAnalyzeModalVisible,
    reportDetailVisible,
    setReportDetailVisible,
    selectedReport,
    blastRadius,
    affectedServices,
    analyzeForm,
    handleAnalyze,
  } = state;

  const affectedColumns = useMemo(() => buildAffectedServiceColumns(), []);

  return (
    <>
      {/* Analyze Modal */}
      <Modal
        title="触发变更分析"
        open={analyzeModalVisible}
        onCancel={() => setAnalyzeModalVisible(false)}
        onOk={() => analyzeForm.submit()}
        destroyOnClose
      >
        <Form form={analyzeForm} layout="vertical" onFinish={handleAnalyze}>
          <Form.Item name="prId" label="PR ID" rules={[{ required: true }]}>
            <Input placeholder="123" />
          </Form.Item>
          <Form.Item name="repoId" label="仓库 ID" rules={[{ required: true }]}>
            <Input placeholder="org/repo" />
          </Form.Item>
          <Form.Item name="commitSha" label="Commit SHA" rules={[{ required: true }]}>
            <Input placeholder="abc123def456..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Report Detail Modal */}
      <Modal
        title="变更分析报告详情"
        open={reportDetailVisible}
        onCancel={() => setReportDetailVisible(false)}
        footer={null}
        width={1000}
      >
        {selectedReport && (
          <>
            <Descriptions bordered column={3} style={{ marginBottom: spacing.lg }}>
              <Descriptions.Item label="PR ID">{selectedReport.prId}</Descriptions.Item>
              <Descriptions.Item label="仓库">{selectedReport.repoId}</Descriptions.Item>
              <Descriptions.Item label="Commit">
                {selectedReport.commitSha.slice(0, 7)}
              </Descriptions.Item>
              <Descriptions.Item label="风险评分">
                <Text
                  strong
                  style={{
                    color:
                      selectedReport.riskScore >= 0.8
                        ? colors.error[600]
                        : selectedReport.riskScore >= 0.5
                          ? colors.warning[500]
                          : colors.success[600],
                  }}
                >
                  {(selectedReport.riskScore * 100).toFixed(1)}%
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="风险级别">
                <Tag color={riskLevelColor[selectedReport.riskLevel]}>
                  {selectedReport.riskLevel.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="影响服务">
                {selectedReport.affectedServices}
              </Descriptions.Item>
            </Descriptions>

            {/* SHAP Factors */}
            {selectedReport.shapFactors && selectedReport.shapFactors.length > 0 && (
              <Card title="SHAP 风险因子" size="small" style={{ marginBottom: spacing.md }}>
                {selectedReport.shapFactors.map(
                  (f: { factor: string; value: number; contribution: number }, i: number) => (
                    <Row key={String(i)} style={{ marginBottom: spacing.sm }}>
                      <Col span={6}>
                        <Text strong>{f.factor}</Text>
                      </Col>
                      <Col span={4}>
                        <Text>{f.value.toFixed(3)}</Text>
                      </Col>
                      <Col span={6}>
                        <div
                          style={{
                            height: 8,
                            borderRadius: 4,
                            background: themeVars.borderLight,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(Math.abs(f.contribution) * 100, 100)}%`,
                              height: '100%',
                              borderRadius: 4,
                              background:
                                f.contribution > 0 ? colors.error[400] : colors.success[500],
                            }}
                          />
                        </div>
                      </Col>
                      <Col span={4}>
                        <Text type={f.contribution > 0 ? 'danger' : 'success'}>
                          {(f.contribution * 100).toFixed(1)}%
                        </Text>
                      </Col>
                    </Row>
                  )
                )}
              </Card>
            )}

            {/* Blast Radius Visualization */}
            {blastRadius && (
              <Card title="影响面图谱" size="small" style={{ marginBottom: spacing.md }}>
                <div
                  style={{ minHeight: 200, display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}
                >
                  {blastRadius.nodes.map((node) => (
                    <Tag
                      key={node.id}
                      color={
                        node.type === 'file'
                          ? 'blue'
                          : node.type === 'service'
                            ? 'green'
                            : node.type === 'capability'
                              ? 'purple'
                              : node.type === 'slo'
                                ? 'red'
                                : 'default'
                      }
                      style={{ margin: 0, padding: '4px 8px' }}
                    >
                      {node.label}
                    </Tag>
                  ))}
                </div>
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  {blastRadius.nodes.length} 个节点，{blastRadius.edges.length} 条边
                </Text>
              </Card>
            )}

            {/* Affected Services */}
            {affectedServices.length > 0 && (
              <Card title="受影响服务" size="small">
                <Table
                  columns={affectedColumns}
                  dataSource={affectedServices}
                  rowKey="id"
                  size="small"
                  pagination={false}
                />
              </Card>
            )}
          </>
        )}
      </Modal>
    </>
  );
};
