import { Drawer } from 'antd';
import { ApprovalDetailDrawer } from '../ApprovalDetailDrawer';

interface DetailPanelProps {
  detailDrawerVisible: boolean;
  setDetailDrawerVisible: (v: boolean) => void;
  selectedApproval: any;
  openCommentModal: (record: any, action: any) => void;
}

export function DetailPanel({ detailDrawerVisible, setDetailDrawerVisible, selectedApproval, openCommentModal }: DetailPanelProps) {
  return (
    <Drawer
      title={selectedApproval ? selectedApproval.title : '审批详情'}
      open={detailDrawerVisible}
      onClose={() => setDetailDrawerVisible(false)}
      width={720}
      destroyOnClose
    >
      {selectedApproval && (
        <ApprovalDetailDrawer
          approval={selectedApproval}
          openCommentModal={openCommentModal}
        />
      )}
    </Drawer>
  );
}
