/**
 * UEBA - User Behavior Analytics Page
 * 用户行为分析页面
 */

import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, Row, Col, Statistic, Input, Select, message } from 'antd';
import { ReloadOutlined, WarningOutlined, UserOutlined, AlertOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getHighRiskUsers, getAnomalies, type UEBAStats, type AnomalyAlert } from '@/api/ueba';

const { Option } = Select;

const { Search } = Input;

const UEBAPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [risks, setRisks] = useState<UEBAStats[]>([]);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [hours, setHours] = useState(24);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [riskRes, alertRes] = await Promise.all([
        getHighRiskUsers(hours, 20),
        getAnomalies(hours),
      ]);
      setRisks(riskRes.data);
      setAlerts(alertRes.data);
    } catch (err: any) {
      message.error('获取数据失败: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [hours]);

  const riskColumns: ColumnsType<UEBAStats> = [
    {
      title: '用户ID',
      dataIndex: 'userId',
      key: 'userId',
      render: (val) => <Space><UserOutlined />{val}</Space>,
    },
    {
      title: '拒绝次数',
      dataIndex: 'denyCount',
      key: 'denyCount',
      sorter: (a, b) => a.denyCount - b.denyCount,
      render: (val) => <Tag color="red">{val}</Tag>,
    },
    {
      title: '拒绝率',
      dataIndex: 'denyRate',
      key: 'denyRate',
      render: (val) => `${val.toFixed(2)}次/小时`,
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (val) => {
        const colorMap: Record<string, string> = { critical: 'red', high: 'orange', medium: 'yellow', low: 'green' };
        return <Tag color={colorMap[val]}>{val.toUpperCase()}</Tag>;
      },
    },
    {
      title: '最后拒绝',
      dataIndex: 'lastDenyAt',
      key: 'lastDenyAt',
      render: (val) => val ? new Date(val).toLocaleString('zh-CN') : '-',
    },
  ];

  const alertColumns: ColumnsType<AnomalyAlert> = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (val) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '用户',
      dataIndex: 'userId',
      key: 'userId',
    },
    {
      title: '告警类型',
      dataIndex: 'alertType',
      key: 'alertType',
      render: (val) => {
        const typeMap: Record<string, string> = {
          frequent_denial: '频繁拒绝',
          unusual_resource_access: '异常访问',
          off_hours_access: '非工作时间访问',
          cross_tenant_attempt: '跨租户尝试',
        };
        return <Tag>{typeMap[val] || val}</Tag>;
      },
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      render: (val) => {
        const colorMap: Record<string, string> = { critical: 'red', high: 'orange', medium: 'yellow', low: 'blue' };
        return <Tag color={colorMap[val]}>{val.toUpperCase()}</Tag>;
      },
    },
    {
      title: '描述',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="高风险用户" value={risks.length} prefix={<WarningOutlined />} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="异常告警" value={alerts.length} prefix={<AlertOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="统计时段" value={hours} suffix="小时" />
          </Card>
        </Col>
      </Row>

      <Card title="异常告警" extra={<Space><Select value={hours} onChange={setHours} style={{ width: 100 }}><Option value={6}>6小时</Option><Option value={24}>24小时</Option><Option value={72}>3天</Option><Option value={168}>7天</Option></Select><Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button></Space>} style={{ marginBottom: 16 }}>
        <Table dataSource={alerts} columns={alertColumns} rowKey="timestamp" pagination={false} loading={loading} size="small" />
      </Card>

      <Card title="高风险用户" extra={<Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>}>
        <Table dataSource={risks} columns={riskColumns} rowKey="userId" pagination={{ pageSize: 10 }} loading={loading} />
      </Card>
    </div>
  );
};

export default UEBAPage;