/**
 * Diagnostic Reports Page
 * List and view diagnostic reports with pattern matches and confidence scores
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Tag, message, Drawer, Card } from 'antd';
import { colors, spacing } from '@/tokens';
import { ReloadOutlined, FileTextOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { getReports, getReport } from '@/api/diagnostic';
import type { DiagnosticReport } from '@/api/diagnostic';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const DiagnosticReports: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<DiagnosticReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await getReports();
      const apiData = response.data.data;
      setReports(Array.isArray(apiData) ? apiData : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载报告失败：${error.message}`);
      } else {
        message.error('加载报告失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredReports = React.useMemo(() => {
    return reports.filter((r) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [r.id, r.sessionId].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      return true;
    });
  }, [searchQuery, reports]);

  const filterDefs: FilterDefinition[] = [];

  const showReportDetail = async (report: DiagnosticReport) => {
    setSelectedReport(report);
    setDetailDrawerVisible(true);
    try {
      const res = await getReport(report.id);
      setSelectedReport(res.data.data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载报告详情失败：${error.message}`);
      } else {
        message.error('加载报告详情失败，请稍后重试');
      }
    }
  };

  const getConfidenceTag = (confidence: number) => {
    if (confidence >= 0.8) return { color: 'green', label: '高' };
    if (confidence >= 0.5) return { color: 'orange', label: '中' };
    return { color: 'red', label: '低' };
  };

  const columns: TableColumn<DiagnosticReport>[] = [
    {
      key: 'id',
      title: '报告ID',
      dataIndex: 'id',
      render: (v: unknown, record: any) => (
        <Text
          style={{ color: colors.purple[500], cursor: 'pointer' }}
          onClick={() => showReportDetail(record)}
        >
          {v as string}
        </Text>
      ),
    },
    {
      key: 'sessionId',
      title: '会话ID',
      dataIndex: 'sessionId',
      render: (v: unknown) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {v as string}
        </Text>
      ),
    },
    {
      key: 'patternMatches',
      title: '模式匹配数',
      dataIndex: 'patternMatches',
      width: 120,
      sortable: true,
      render: (v: unknown) => <Text strong>{v as number}</Text>,
    },
    {
      key: 'confidence',
      title: '置信度',
      dataIndex: 'confidence',
      width: 120,
      sortable: true,
      render: (v: unknown) => {
        const value = v as number;
        const tag = getConfidenceTag(value);
        return (
          <Tag color={tag.color}>
            {(value * 100).toFixed(1)}% ({tag.label})
          </Tag>
        );
      },
    },
    {
      key: 'generatedAt',
      title: '生成时间',
      dataIndex: 'generatedAt',
      sortable: true,
      width: 160,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(v as string).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 80,
      render: (_: unknown, record: any) => (
        <Button type="link" size="small" onClick={() => showReportDetail(record)}>
          查看
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <FileTextOutlined style={{ marginRight: 8 }} />
            诊断报告
          </Title>
          <Text type="secondary">共 {reports.length} 份报告</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          filters={filterDefs}
          searchPlaceholder="搜索报告ID、会话ID..."
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredReports}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Report Detail Drawer */}
      <Drawer
        title={`报告详情: ${selectedReport?.id}`}
        placement="right"
        width={600}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
      >
        {selectedReport && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <div>
              <Text type="secondary">会话ID:</Text> <Text code>{selectedReport.sessionId}</Text>
            </div>
            <div>
              <Text type="secondary">模式匹配:</Text>{' '}
              <Text strong>{selectedReport.patternMatches}</Text>
            </div>
            <div>
              <Text type="secondary">置信度:</Text>{' '}
              <Tag color={getConfidenceTag(selectedReport.confidence).color}>
                {(selectedReport.confidence * 100).toFixed(1)}%
              </Tag>
            </div>
            <div>
              <Text type="secondary">生成时间:</Text>{' '}
              {dayjs(selectedReport.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </div>

            {selectedReport.findings && selectedReport.findings.length > 0 && (
              <>
                <Title level={5}>诊断发现</Title>
                {selectedReport.findings.map((finding: any, idx: number) => (
                  <Card key={idx} size="small" style={{ background: colors.neutral[50] }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        <Tag color="purple">{finding.pattern}</Tag>
                        <Tag color={getConfidenceTag(finding.confidence).color}>
                          {(finding.confidence * 100).toFixed(0)}%
                        </Tag>
                      </Space>
                      <Text>{finding.description}</Text>
                    </Space>
                  </Card>
                ))}
              </>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default DiagnosticReports;
