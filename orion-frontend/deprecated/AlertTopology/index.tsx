/**
 * Alert Topology Visualization (P2-19)
 * 告警拓扑可视化 — 告警规则 × CMDB 组件 × 告警事件 关联关系图谱
 *
 * Features:
 * - Alert rule to CMDB CI correlation
 * - Active alert heatmap by service
 * - Dependency chain for alert propagation
 * - Filter by severity/status
 */

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Table, Tag, Statistic, Select, Space, Button, Tooltip, Badge, Modal, Descriptions, message } from 'antd';
import {
  CloudUploadOutlined,
  DatabaseOutlined,
  AlertOutlined,
  ThunderboltOutlined,
  ReloadOutlined,

  FireOutlined,


} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { getAlerts, getAlertRules, getAlertStats, type Alert, type AlertRule } from '@/api/alerts';
import { getActiveAlerts } from '@/api/alerts';

const { Title, Text } = Typography;
const { Option } = Select;

// ==================== Types ====================

interface TopologyNode {
  id: string;
  label: string;
  type: 'alert_rule' | 'ci' | 'alert_event';
  severity?: 'critical' | 'warning' | 'info';
  status?: 'active' | 'resolved' | 'acknowledged' | 'suppressed';
  alertCount?: number;
  children?: string[];
}

interface TopologyEdge {
  source: string;
  target: string;
  type: 'monitors' | 'triggered_by' | 'depends_on';
  label?: string;
}

interface AlertEvent {
  id: string;
  ruleName: string;
  serviceName: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  status: 'firing' | 'resolved' | 'acknowledged';
  timestamp: string;
  duration?: number;
}

// ==================== Severity Config ====================

const SEVERITY_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: colors.error[500], label: '严重' },
  warning: { color: colors.warning[500], label: '警告' },
  info: { color: colors.info[500], label: '信息' },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  firing: { color: colors.error[500], label: '触发中' },
  resolved: { color: colors.success[500], label: '已恢复' },
  acknowledged: { color: colors.warning[500], label: '已确认' },
};

// ==================== Main Component ====================

const AlertTopology: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [, setStats] = useState(null);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [topologyNodes, setTopologyNodes] = useState<TopologyNode[]>([]);
  const [topologyEdges, setTopologyEdges] = useState<TopologyEdge[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [alertsRes, rulesRes, statsRes, activeRes] = await Promise.all([
        getAlerts({ pageSize: 50 }).catch(() => null),
        getAlertRules().catch(() => null),
        getAlertStats().catch(() => null),
        getActiveAlerts().catch(() => null),
      ]);
      setAlerts((alertsRes as any)?.data ?? alertsRes ?? []);
      setRules((rulesRes as any)?.data ?? rulesRes ?? []);
      setStats((statsRes as any)?.data ?? statsRes ?? null);
      setActiveAlerts((activeRes as any)?.data ?? activeRes ?? []);
    } catch {
      message.error('Failed to load alert data');
    } finally {
      setLoading(false);
    }
  };

  // Build topology from alert rules and alerts
  useEffect(() => {
    if (rules.length === 0 && alerts.length === 0) return;

    const nodes: TopologyNode[] = [];
    const edges: TopologyEdge[] = [];
    const alertMap = new Map<string, AlertEvent[]>();

    // Alert rule nodes
    rules.forEach((rule: AlertRule) => {
      const nodeId = 'rule_' + rule.id;
      nodes.push({
        id: nodeId,
        label: rule.name || rule.id,
        type: 'alert_rule',
        severity: (rule.severity as 'critical' | 'warning' | 'info') || 'warning',
        status: rule.enabled ? 'active' : 'resolved',
      });
    });

    // Group alerts by service and create CI nodes + edges
    alerts.forEach((alert: Alert) => {
      const service = alert.source || "unknown";
      const alertNodeId = 'alert_' + alert.id;
      nodes.push({
        id: alertNodeId,
        label: alert.message?.slice(0, 30) || alert.metric || 'Alert',
        type: 'alert_event',
        severity: (alert.severity as 'critical' | 'warning' | 'info') || 'warning',
        status: alert.status || 'firing',
      });

      if (!alertMap.has(service)) {
        alertMap.set(service, []);
        nodes.push({
          id: 'ci_' + service,
          label: service,
          type: 'ci',
          alertCount: 0,
        });
      }
      alertMap.get(service)?.push({
        id: alert.id,
        ruleName: alert.metric || 'Unknown Rule',
        serviceName: service,
        severity: (alert.severity as 'critical' | 'warning' | 'info') || 'warning',
        message: alert.message || '',
        status: alert.status as 'firing' | 'resolved' | 'acknowledged' || 'firing',
        timestamp: alert.createdAt,
      });

      edges.push({
        source: alertNodeId,
        target: 'ci_' + service,
        type: 'triggered_by',
        label: '来自',
      });
    });

    // Update CI alert counts
    alertMap.forEach((events, service) => {
      const ciNode = nodes.find((n) => n.id === 'ci_' + service);
      if (ciNode) ciNode.alertCount = events.length;
      // Link CI to matching rules
      rules.forEach((rule) => {
        if (rule.metric?.includes(service) || rule.name?.includes(service)) {
          const ruleNode = nodes.find((n) => n.id === 'rule_' + rule.id);
          if (ruleNode) {
            edges.push({
              source: 'rule_' + rule.id,
              target: 'ci_' + service,
              type: 'monitors',
              label: '监控',
            });
          }
        }
      });
    });

    // If no alerts, show CI nodes with dependency chains
    if (alerts.length === 0 && nodes.length === 0) {
      const defaultServices = ['api-gateway', 'user-service', 'pipeline-engine', 'monitor-svc', 'cmdb-core'];
      defaultServices.forEach((svc, idx) => {
        nodes.push({ id: 'ci_' + svc, label: svc, type: 'ci', alertCount: 0 });
        if (idx > 0) {
          edges.push({ source: 'ci_' + svc, target: 'ci_' + defaultServices[0], type: 'depends_on', label: '依赖' });
        }
      });
      rules.slice(0, 5).forEach((rule, idx) => {
        nodes.push({ id: 'rule_' + rule.id, label: rule.name || rule.id, type: 'alert_rule', severity: 'warning' });
        edges.push({ source: 'rule_' + rule.id, target: 'ci_' + defaultServices[idx % defaultServices.length], type: 'monitors', label: '监控' });
      });
    }

    setTopologyNodes(nodes);
    setTopologyEdges(edges);
  }, [alerts, rules]);

  const filteredAlerts = alerts.filter((a: Alert) => {
    if (selectedSeverity && a.severity !== selectedSeverity) return false;
    if (selectedStatus && a.status !== selectedStatus) return false;
    return true;
  });

  const alertEventColumns = [
    { title: '告警规则', dataIndex: 'ruleName', key: 'ruleName' },
    { title: '服务/组件', dataIndex: 'serviceName', key: 'serviceName' },
    {
      title: '严重级别', key: 'severity',
      dataIndex: 'severity',
      render: (sev: string) => <Tag color={SEVERITY_CONFIG[sev]?.color || colors.neutral[400]}>{sev}</Tag>,
    },
    { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true },
    {
      title: '状态', key: 'status',
      dataIndex: 'status',
      render: (st: string) => <Tag color={STATUS_CONFIG[st]?.color || colors.neutral[400]}>{st}</Tag>,
    },
    {
      title: '时间', dataIndex: 'timestamp', key: 'timestamp',
      render: (t: string) => t ? new Date(t).toLocaleString() : '—',
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <Col>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <CloudUploadOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            告警拓扑可视化
          </Title>
          <Text type="secondary">告警规则 × CMDB 组件 × 告警事件 关联关系图谱</Text>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </Col>
      </Row>

      {/* Stats Row */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card>
            <Statistic title="告警规则总数" value={rules.length} prefix={<FireOutlined />} valueStyle={{ color: colors.primary[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="活跃告警" value={activeAlerts.length} prefix={<AlertOutlined />} valueStyle={{ color: colors.error[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="关联服务/组件" value={new Set(alerts.map((a: Alert) => a.source || "-")).size} prefix={<DatabaseOutlined />} valueStyle={{ color: colors.info[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="拓扑节点/边" value={`${topologyNodes.length} / ${topologyEdges.length}`} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        {/* Topology Graph (Canvas-based) */}
        <Col span={14}>
          <Card title="告警拓扑图谱" size="default">
            <div
              style={{
                width: '100%',
                height: 400,
                position: 'relative',
                background: colors.light.bg.secondary,
                borderRadius: spacing.sm,
                overflow: 'hidden',
              }}
            >
              <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
                {topologyEdges.map((edge, i) => {
                  const src = topologyNodes.find((n) => n.id === edge.source);
                  const tgt = topologyNodes.find((n) => n.id === edge.target);
                  if (!src || !tgt) return null;
                  const x1 = 60 + ((topologyNodes.indexOf(src) * 160) % 640);
                  const y1 = src.type === 'alert_rule' ? 80 : src.type === 'ci' ? 220 : 340;
                  const x2 = 60 + ((topologyNodes.indexOf(tgt) * 160) % 640);
                  const y2 = tgt.type === 'alert_rule' ? 80 : tgt.type === 'ci' ? 220 : 340;
                  const color = edge.type === 'monitors' ? colors.success[500] : edge.type === 'triggered_by' ? colors.error[500] : colors.neutral[400];
                  return (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" strokeDasharray={edge.type === 'depends_on' ? '4 4' : '0'} opacity="0.4" />
                  );
                })}
              </svg>
              {topologyNodes.slice(0, 20).map((node, i) => {
                const x = 60 + (i * 100) % 640;
                const y = node.type === 'alert_rule' ? 80 : node.type === 'ci' ? 220 : 340;
                const color = node.type === 'alert_rule'
                  ? SEVERITY_CONFIG[node.severity || 'warning']?.color || colors.primary[500]
                  : node.type === 'ci'
                  ? colors.info[500]
                  : SEVERITY_CONFIG[node.severity || 'warning']?.color || colors.primary[500];

                return (
                  <Tooltip key={node.id} title={`${node.type} · ${node.label}${node.alertCount ? ` (${node.alertCount} alerts)` : ''}`}>
                    <div
                      style={{
                        position: 'absolute',
                        left: x,
                        top: y,
                        width: 40,
                        height: 40,
                        borderRadius: node.type === 'alert_rule' ? 8 : node.type === 'ci' ? '50%' : 4,
                        backgroundColor: color + '22',
                        border: `2px solid ${color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        boxShadow: node.status === 'active' ? `0 0 12px ${color}` : 'none',
                        animation: node.status === 'active' ? 'alertPulse 1.5s ease-in-out infinite' : 'none',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.15)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}
                    >
                      {node.type === 'alert_rule' && <FireOutlined style={{ color }} />}
                      {node.type === 'ci' && <DatabaseOutlined style={{ color }} />}
                      {node.type === 'alert_event' && <AlertOutlined style={{ color }} />}
                      {node.alertCount && node.alertCount > 0 && (
                        <Badge count={node.alertCount} size="small" />
                      )}
                    </div>
                  </Tooltip>
                );
              })}
              <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 12 }}>
                <Space size="small">
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.primary[500], display: 'inline-block' }} />
                    <Text type="secondary" style={{ fontSize: 11 }}>告警规则</Text>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: colors.info[500], display: 'inline-block' }} />
                    <Text type="secondary" style={{ fontSize: 11 }}>CMDB 组件</Text>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.error[500], display: 'inline-block' }} />
                    <Text type="secondary" style={{ fontSize: 11 }}>告警事件</Text>
                  </span>
                </Space>
              </div>
              {topologyNodes.length === 0 && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.neutral[400] }}>
                  <Text>暂无拓扑数据</Text>
                </div>
              )}
            </div>
            <style>{`
              @keyframes alertPulse {
                0%, 100% { box-shadow: 0 0 4px ${colors.error[500]}44; }
                50% { box-shadow: 0 0 20px ${colors.error[500]}88; }
              }
            `}</style>
          </Card>
        </Col>

        {/* Alert Events */}
        <Col span={10}>
          <Card title="告警事件列表">
            <Space wrap size="small" style={{ marginBottom: spacing.sm }}>
              <Select
                style={{ width: 100 }}
                placeholder="严重级别"
                value={selectedSeverity || undefined}
                onChange={(v) => setSelectedSeverity(v || null)}
                allowClear
              >
                <Option value="critical">严重</Option>
                <Option value="warning">警告</Option>
                <Option value="info">信息</Option>
              </Select>
              <Select
                style={{ width: 100 }}
                placeholder="状态"
                value={selectedStatus || undefined}
                onChange={(v) => setSelectedStatus(v || null)}
                allowClear
              >
                <Option value="firing">触发中</Option>
                <Option value="resolved">已恢复</Option>
                <Option value="acknowledged">已确认</Option>
              </Select>
            </Space>
            <Table
              columns={alertEventColumns}
              dataSource={filteredAlerts.map((a: Alert) => ({
                id: a.id,
                ruleName: a.metric || "-",
                serviceName: a.source || "-" || '-',
                severity: a.severity || 'warning',
                message: a.message || '-',
                status: a.status || 'active',
                timestamp: a.createdAt || new Date().toISOString(),
              }))}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5, showSizeChanger: false }}
              onRow={(record) => ({
                onClick: () => setSelectedAlert(alerts.find((a) => a.id === record.id) || null),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        </Col>
      </Row>

      {/* Alert Detail Modal */}
      <Modal
        title="告警详情"
        open={!!selectedAlert}
        onCancel={() => setSelectedAlert(null)}
        footer={null}
      >
        {selectedAlert && (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="ID">{selectedAlert.id}</Descriptions.Item>
            <Descriptions.Item label="规则">{selectedAlert.metric || '-'}</Descriptions.Item>
            <Descriptions.Item label="服务/资源">{selectedAlert.source || '-'}</Descriptions.Item>
            <Descriptions.Item label="严重级别">
              <Tag color={SEVERITY_CONFIG[selectedAlert.severity || 'warning']?.color || colors.neutral[400]}>{selectedAlert.severity || 'warning'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_CONFIG[selectedAlert.status || 'firing']?.color || colors.neutral[400]}>{selectedAlert.status || 'firing'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="消息" span={2}>{selectedAlert.message || '-'}</Descriptions.Item>
            <Descriptions.Item label="开始时间" span={2}>{selectedAlert.createdAt || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AlertTopology;
