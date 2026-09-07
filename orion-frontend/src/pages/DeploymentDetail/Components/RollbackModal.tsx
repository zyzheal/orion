/**
 * DeploymentDetail rollback confirmation modal
 * 抽取自 index.tsx (P2-9 Phase 168)
 */
import { Modal, Result } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import type { Deployment } from '@/api/deployments';

interface RollbackModalProps {
  deployment: Deployment;
  open: boolean;
  isRollingBack: boolean;
  onOk: () => void;
  onCancel: () => void;
}

export const RollbackModal = ({
  deployment,
  open,
  isRollingBack,
  onOk,
  onCancel,
}: RollbackModalProps) => (
  <Modal
    title="确认回滚"
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    okText="确认回滚"
    cancelText="取消"
    okButtonProps={{ danger: true, loading: isRollingBack }}
  >
    <Result
      status="warning"
      title={`确定要回滚 ${deployment.appName} 到 ${deployment.version} 吗？`}
      subTitle="回滚操作将恢复此版本的部署，当前版本将被替换。"
      icon={<QuestionCircleOutlined />}
    />
  </Modal>
);
