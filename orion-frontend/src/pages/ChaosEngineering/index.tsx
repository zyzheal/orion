/**
 * Chaos Engineering Page
 * Phase 3 - Chaos experiments dashboard
 */

import React, { useState, useEffect } from 'react';
import { chaosApi, resilienceApi, ChaosExperiment, ChaosRun, ResilienceScore } from '../../api/chaos';
import { Card, Table, Button, Modal, Form, Select, Input, Tag, Statistic, Row, Col, Progress, message } from 'antd';
import { ThunderboltOutlined, SafetyOutlined, ReloadOutlined } from '@ant-design/icons';

const ChaosEngineering: React.FC = () => {
  const [experiments, setExperiments] = useState<ChaosExperiment[]>([]);
  const [score, setScore] = useState<ResilienceScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expResponse, scoreData] = await Promise.all([
        chaosApi.listExperiments(),
        resilienceApi.getScore(),
      ]);
      setExperiments(expResponse.data || []);
      setScore(scoreData);
    } catch (error) {
      message.error('Failed to load data');
    }
    setLoading(false);
  };

  const handleRunExperiment = async (experimentId: string) => {
    try {
      await chaosApi.runExperiment(experimentId);
      message.success('Experiment started');
      loadData();
    } catch (error) {
      message.error('Failed to start experiment');
    }
  };

  const handleCreateExperiment = async (values: any) => {
    try {
      await chaosApi.createExperiment(values);
      message.success('Experiment created');
      setCreateModal(false);
      loadData();
    } catch (error) {
      message.error('Failed to create experiment');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Environment', dataIndex: ['scope', 'environment'], key: 'environment' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : status === 'completed' ? 'blue' : 'default'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Faults',
      dataIndex: 'faults',
      key: 'faults',
      render: (faults: any[]) => faults.map(f => <Tag key={f.type}>{f.type}</Tag>),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: ChaosExperiment) => (
        <Button onClick={() => handleRunExperiment(record.id)} disabled={record.status !== 'active'}>
          Run
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={24}>
        <Col span={24}>
          <Card title={<><SafetyOutlined /> Resilience Score</>}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="Score" value={score?.score || 0} suffix="/ 100" />
                <Progress 
                  percent={score?.score || 0} 
                  status={score?.score >= 80 ? 'success' : score?.score >= 60 ? 'normal' : 'exception'}
                />
              </Col>
              <Col span={6}>
                <Statistic title="MTTR" value={score?.mttr_ms || 0} suffix="ms" />
              </Col>
              <Col span={6}>
                <Statistic title="Success Rate" value={(score?.success_rate * 100 || 0).toFixed(1)} suffix="%" />
              </Col>
              <Col span={6}>
                <Statistic title="Trend" value={score?.trend || 'stable'} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card 
        title={<><ThunderboltOutlined /> Chaos Experiments</>} 
        style={{ marginTop: 24 }}
        extra={
          <Space>
            <Button icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>Create</Button>
            <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
          </Space>
        }
      >
        <Table columns={columns} dataSource={experiments} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title="Create Experiment"
        open={createModal}
        onCancel={() => setCreateModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateExperiment}>
          <Form.Item label="Name" name="name" required>
            <Input />
          </Form.Item>
          <Form.Item label="Environment" name={['scope', 'environment']} required>
            <Select options={[
              { value: 'staging', label: 'Staging' },
              { value: 'production', label: 'Production' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ChaosEngineering;