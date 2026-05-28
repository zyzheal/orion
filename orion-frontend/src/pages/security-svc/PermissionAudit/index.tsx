/**
 * PermissionAudit - 权限审计日志页面
 * 展示权限决策日志，供安全审计使用
 */

import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Select, Button, Space, Statistic, Row, Col, message, Alert, Badge } from 'antd';
import { ReloadOutlined, FilterOutlined, BarChartOutlined, WarningOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { queryDeniedLogs, queryDeniedStats, getAnomalies, getHighRiskUsers, type AuditLogEntry, type AuditStats, type UEBAAnomaly, type UEBARiskUser } from '@/api/permission-audit';
import { colors } from '@/tokens';

const { Option } = Select;

const PermissionAudit: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditStats[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(100);
  const [hours, setHours] = useState(24);

  // UEBA state
  const [anomalies, setAnomalies] = useState<UEBAAnomaly[]>([]);
  const [riskUsers, setRiskUsers] = useState<UEBARiskUser[]>([]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await queryDeniedLogs(limit);
      setLogs(res.data);
      setTotal(res.total);
    } catch (err: any) {
      message.error('获取审计日志失败: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await queryDeniedStats(hours);
      setStats(res.data);
    } catch (err: any) {
      message.error('获取统计信息失败: ' + (err.message || '未知错误'));
    }
  };

  const fetchAnomalies = async () => {
    try {
      const [anomalyRes, riskRes] = await Promise.all([
        getAnomalies(hours),
        getHighRiskUsers(hours, 10),
      ]);
      setAnomalies(anomalyRes || []);
      setRiskUsers(riskRes || []);
    } catch (err: any) {
      message.error('获取 UEBA 数据失败: ' + (err.message || '未知错误'));
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
    fetchAnomalies();
  }, [limit, hours]);

  const columns: ColumnsType<AuditLogEntry> = [
    {
      title: '时间',
      dataIndex: 'evaluated_at',
      key: 'evaluated_at',
      width: 180,
      render: (val) => val ? new Date(val).toLocaleString('zh-CN') : '-',
    },
    {
      title: '用户',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 120,
    },
    {
      title: '租户',
      dataIndex: 'tenant_id',
      key: 'tenant_id',
      width: 140,
      render: (val) => val || '-',
    },
    {
      title: '资源类型',
      dataIndex: 'resource_type',
      key: 'resource_type',
      width: 120,
      render: (val) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: '资源ID',
      dataIndex: 'resource_id',
      key: 'resource_id',
      width: 120,
      ellipsis: true,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 80,
    },
    {
      title: '决策',
      dataIndex: 'decision',
      key: 'decision',
      width: 80,
      render: (val) => (
        <Tag color={val === 'deny' ? 'red' : 'green'}>
          {val === 'deny' ? '拒绝' : '允许'}
        </Tag>
      ),
    },
    {
      title: '来源',
      dataIndex: 'decision_source',
      key: 'decision_source',
      width: 100,
      render: (val) => {
        const colorMap: Record<string, string> = {
          rbac: 'orange',
          abac: 'purple',
          relationship: 'cyan',
          super_admin_bypass: 'gold',
          all: 'green',
        };
        return <Tag color={colorMap[val] || 'default'}>{val}</Tag>;
      },
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
  ];

  const statColumns: ColumnsType<AuditStats> = [
    {
      title: '用户',
      dataIndex: 'user_id',
      key: 'user_id',
    },
    {
      title: '拒绝次数',
      dataIndex: 'count',
      key: 'count',
      render: (val) => <Tag color="red">{val}</Tag>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="拒绝记录总数"
              value={total}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: colors.error[400] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="统计时段 (小时)"
              value={hours}
              suffix="h"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃用户数"
              value={stats.length}
              valueStyle={{ color: colors.primary[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="最高拒绝数"
              value={stats[0]?.count || 0}
              valueStyle={{ color: colors.warning[500] }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="拒绝原因统计 (按用户)"
        extra={
          <Space>
            <span>时段:</span>
            <Select value={hours} onChange={setHours} style={{ width: 100 }}>
              <Option value={1}>1小时</Option>
              <Option value={6}>6小时</Option>
              <Option value={24}>24小时</Option>
              <Option value={72}>3天</Option>
              <Option value={168}>7天</Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchStats(); fetchAnomalies(); }}>
              刷新
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          dataSource={stats}
          columns={statColumns}
          rowKey="user_id"
          pagination={false}
          size="small"
        />
      </Card>

      {/* ─── UEBA 异常行为告警面板 ─── */}
      {anomalies.length > 0 && (
        <Card
          title={
            <Space>
              <WarningOutlined style={{ color: colors.warning[500] }} />
              异常行为告警 (UEBA)
              <Badge count={anomalies.length} style={{ backgroundColor: colors.error[500] }} />
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          {anomalies.map((anomaly, index) => {
            const severityColor: Record<string, string> = {
              low: 'blue',
              medium: 'orange',
              high: 'red',
              critical: 'magenta',
            };
            return (
              <Alert
                key={index}
                type={anomaly.severity === 'critical' || anomaly.severity === 'high' ? 'error' : 'warning'}
                message={
                  <Space>
                    <Tag color={severityColor[anomaly.severity] || 'default'}>
                      {anomaly.severity.toUpperCase()}
                    </Tag>
                    <span>{anomaly.message}</span>
                  </Space>
                }
                description={`用户: ${anomaly.userId} | 类型: ${anomaly.alertType} | 检测时间: ${new Date(anomaly.timestamp).toLocaleString('zh-CN')}`}
                showIcon
                style={{ marginBottom: 8 }}
              />
            );
          })}
        </Card>
      )}

      {/* ─── UEBA 高风险用户列表 ─── */}
      {riskUsers.length > 0 && (
        <Card
          title={
            <Space>
              <UserOutlined style={{ color: colors.purple[500] }} />
              高风险用户列表 (UEBA)
            </Space>
          }
          extra={<Tag color="purple">{riskUsers.length} 位高风险用户</Tag>}
          style={{ marginBottom: 16 }}
        >
          <Table
            dataSource={riskUsers}
            columns={[
              {
                title: '用户',
                dataIndex: 'userId',
                key: 'userId',
                width: 160,
              },
              {
                title: '风险等级',
                dataIndex: 'riskLevel',
                key: 'riskLevel',
                width: 100,
                render: (val: string) => {
                  const colorMap: Record<string, string> = { low: 'green', medium: 'orange', high: 'red', critical: 'magenta' };
                  return <Tag color={colorMap[val] || 'default'}>{val}</Tag>;
                },
              },
              {
                title: '拒绝次数',
                dataIndex: 'denyCount',
                key: 'denyCount',
                width: 100,
              },
              {
                title: '拒绝频率',
                dataIndex: 'denyRate',
                key: 'denyRate',
                width: 100,
                render: (val: number) => `${val.toFixed(1)} 次/小时`,
              },
            ]}
            rowKey="userId"
            pagination={false}
            size="small"
          />
        </Card>
      )}

      <Card
        title="权限拒绝日志"
        extra={
          <Space>
            <FilterOutlined />
            <span>显示:</span>
            <Select value={limit} onChange={setLimit} style={{ width: 100 }}>
              <Option value={50}>50条</Option>
              <Option value={100}>100条</Option>
              <Option value={200}>200条</Option>
              <Option value={500}>500条</Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={fetchLogs}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={logs}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1200 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default PermissionAudit;