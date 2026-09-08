import { Alert } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';

interface Props {
  onDismiss: () => void;
}

export function GuideAlert({ onDismiss }: Props) {
  return (
    <Alert
      type="info"
      style={{ margin: '8px 16px 0', borderRadius: 8 }}
      message={
        <span style={{ fontSize: 13 }}>
          <strong>如何使用 ChatOps？</strong> 本页为
          <span style={{ color: colors.primary[500], fontWeight: 500 }}>管理中心</span>
          （数据看板、命令文档、执行记录、配置管理）。 需要对话操作？点击页面
          <span style={{ color: colors.primary[500], fontWeight: 500 }}>右下角</span>
          的悬浮按钮打开 AI 助手。
        </span>
      }
      action={
        <a onClick={onDismiss} style={{ fontSize: 12 }}>
          <CloseOutlined /> 不再提示
        </a>
      }
      closable
      onClose={onDismiss}
    />
  );
}
