/**
 * P3-08 仪表板模板市场
 * 预置模板 · 一键应用 · 个性化配置
 * 纯前端页面，无需后端 API
 */
import React, { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Tag,
  Typography,
  Input,
  Select,
  Button,
  Modal,
  Empty,
  Space,
  message,
} from 'antd';
import {
  AppstoreOutlined,
  CloudServerOutlined,
  RocketOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  BoxPlotOutlined,
  RobotOutlined,
  FundOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;

// ---- Types ----

type TemplateCategory = '全部' | '运维' | '开发' | '数据' | '安全';

interface TemplateItem {
  id: number;
  name: string;
  description: string;
  widgetCount: number;
  category: Exclude<TemplateCategory, '全部'>;
  icon: React.ReactNode;
  iconColor: string;
}

// ---- Constants ----

const ICON_FONT_SIZE = 36; // px

// ---- Template Data ----

const TEMPLATES: TemplateItem[] = [
  {
    id: 1,
    name: '运维概览',
    description: '服务器/容器/网络核心指标',
    widgetCount: 8,
    category: '运维',
    icon: <CloudServerOutlined style={{ fontSize: ICON_FONT_SIZE }} />,
    iconColor: colors.primary[500],
  },
  {
    id: 2,
    name: '开发效率',
    description: 'DORA/CI/CD/代码提交',
    widgetCount: 6,
    category: '开发',
    icon: <RocketOutlined style={{ fontSize: ICON_FONT_SIZE }} />,
    iconColor: colors.purple[500],
  },
  {
    id: 3,
    name: '数据质量',
    description: '数据管道/质量规则/血缘',
    widgetCount: 6,
    category: '数据',
    icon: <DatabaseOutlined style={{ fontSize: ICON_FONT_SIZE }} />,
    iconColor: colors.success[500],
  },
  {
    id: 4,
    name: '安全态势',
    description: '漏洞/威胁/合规评分',
    widgetCount: 7,
    category: '安全',
    icon: <SafetyCertificateOutlined style={{ fontSize: ICON_FONT_SIZE }} />,
    iconColor: colors.error[500],
  },
  {
    id: 5,
    name: '告警监控',
    description: '告警规则/事件/趋势',
    widgetCount: 5,
    category: '运维',
    icon: <ThunderboltOutlined style={{ fontSize: ICON_FONT_SIZE }} />,
    iconColor: colors.warning[500],
  },
  {
    id: 6,
    name: '制品管理',
    description: '制品版本/下载量/依赖',
    widgetCount: 5,
    category: '开发',
    icon: <BoxPlotOutlined style={{ fontSize: ICON_FONT_SIZE }} />,
    iconColor: colors.primary[500],
  },
  {
    id: 7,
    name: 'AI 效能',
    description: 'AI 采纳率/Token 消耗/模型性能',
    widgetCount: 6,
    category: '数据',
    icon: <RobotOutlined style={{ fontSize: ICON_FONT_SIZE }} />,
    iconColor: colors.purple[500],
  },
  {
    id: 8,
    name: '成本分析',
    description: '云成本/资源利用率/预算',
    widgetCount: 7,
    category: '运维',
    icon: <FundOutlined style={{ fontSize: ICON_FONT_SIZE }} />,
    iconColor: colors.success[500],
  },
];

// ---- Component ----

const DashboardTemplateMarket: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('全部');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    template: TemplateItem | null;
  }>({ visible: false, template: null });
  const [applying, setApplying] = useState(false);
  const [applyingId, setApplyingId] = useState<number | null>(null);

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter((t) => {
      const matchCategory = selectedCategory === '全部' || t.category === selectedCategory;
      const matchSearch =
        !searchKeyword ||
        t.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        t.description.toLowerCase().includes(searchKeyword.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchKeyword]);

  const handleApply = (template: TemplateItem) => {
    setApplyingId(template.id);
    setConfirmModal({ visible: true, template });
  };

  const handleConfirmApply = async () => {
    if (!confirmModal.template) return;
    setApplying(true);
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 500));
    setApplying(false);
    setApplyingId(null);
    setConfirmModal({ visible: false, template: null });
    message.success(`模板「${confirmModal.template.name}」已应用`);
  };

  const handleCancelModal = () => {
    setApplyingId(null);
    setConfirmModal({ visible: false, template: null });
  };

  const handleCategoryChange = (value: TemplateCategory) => {
    setSelectedCategory(value);
  };

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
  };

  return (
    <div style={{ padding: spacing.lg }}>
      {/* Title */}
      <Title level={2} style={{ marginBottom: 8, fontWeight: 600, color: colors.neutral[900] }}>
        <AppstoreOutlined
          style={{ marginRight: 12, color: colors.primary[500], fontSize: 24 }}
        />
        仪表板模板市场
      </Title>
      <Text type="secondary" style={{ fontSize: 14 }}>
        预置模板 · 一键应用 · 个性化配置
      </Text>

      {/* Filter Bar */}
      <div
        style={{
          marginTop: spacing.md,
          marginBottom: spacing.lg,
          display: 'flex',
          gap: spacing.sm,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Select
          value={selectedCategory}
          onChange={handleCategoryChange}
          style={{ width: 160 }}
          size="middle"
        >
          <Option value="全部">全部分类</Option>
          <Option value="运维">运维</Option>
          <Option value="开发">开发</Option>
          <Option value="数据">数据</Option>
          <Option value="安全">安全</Option>
        </Select>
        <Search
          placeholder="搜索模板名称或描述"
          allowClear
          onSearch={handleSearch}
          onChange={(e) => setSearchKeyword(e.target.value)}
          style={{ width: 300 }}
          size="middle"
        />
      </div>

      {/* Template Grid */}
      {filteredTemplates.length === 0 ? (
        <Empty description="没有找到匹配的模板" />
      ) : (
        <Row gutter={[spacing.md, spacing.md]}>
          {filteredTemplates.map((template) => (
            <Col span={8} key={template.id}>
              <Card
                hoverable
                style={{
                  borderLeft: `3px solid ${template.iconColor}`,
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      background: `${template.iconColor}10`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ color: template.iconColor }}>{template.icon}</span>
                  </div>
                  <Tag
                    color={
                      template.category === '运维'
                        ? colors.primary[500]
                        : template.category === '开发'
                          ? colors.purple[500]
                          : template.category === '数据'
                            ? colors.success[500]
                            : colors.error[500]
                    }
                  >
                    {template.category}
                  </Tag>
                </div>

                <div style={{ marginTop: spacing.sm }}>
                  <Text strong style={{ fontSize: 16, display: 'block' }}>
                    {template.name}
                  </Text>
                  <Paragraph
                    type="secondary"
                    style={{
                      marginTop: 4,
                      marginBottom: spacing.sm,
                      fontSize: 13,
                    }}
                  >
                    {template.description}
                  </Paragraph>
                  <Space
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: spacing.sm,
                    }}
                  >
                    <Tag style={{ fontSize: 12 }}>
                      {template.widgetCount} Widgets
                    </Tag>
                    <Button
                      type="primary"
                      size="middle"
                      loading={applyingId === template.id}
                      disabled={applyingId === template.id}
                      onClick={() => handleApply(template)}
                      style={{
                        borderRadius: 6,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      }}
                    >
                      应用模板
                    </Button>
                  </Space>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Confirm Modal */}
      <Modal
        title={`确认应用模板：${confirmModal.template?.name || ''}`}
        open={confirmModal.visible}
        onOk={handleConfirmApply}
        onCancel={handleCancelModal}
        confirmLoading={applying}
        okText="确认应用"
        cancelText="取消"
        destroyOnClose
      >
        {confirmModal.template && (
          <div>
            <p style={{ marginBottom: spacing.sm }}>
              即将将 <strong>{confirmModal.template.name}</strong> 模板应用至当前仪表板。
            </p>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              该模板包含 {confirmModal.template.widgetCount} 个 Widget 组件，应用后当前仪表板布局将被替换。
            </Paragraph>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DashboardTemplateMarket;
