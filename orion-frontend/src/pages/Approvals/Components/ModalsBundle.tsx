import { ApprovalModals } from '../ApprovalModals';
import type { useApprovalState } from '../useApprovalState';

type State = ReturnType<typeof useApprovalState>;

interface Props {
  createForm: any;
  handleCreateWrapper: () => Promise<void>;
  state: State;
}

export function ApprovalModalsBundle({ createForm, handleCreateWrapper, state: s }: Props) {
  return (
    <ApprovalModals
      createModalVisible={s.createModalVisible}
      setCreateModalVisible={s.setCreateModalVisible}
      createForm={createForm}
      submitting={s.submitting}
      handleCreate={handleCreateWrapper}
      commentModalVisible={s.commentModalVisible}
      setCommentModalVisible={s.setCommentModalVisible}
      commentAction={s.commentAction}
      commentText={s.commentText}
      setCommentText={s.setCommentText}
      commentSubmitting={s.commentSubmitting}
      handleCommentSubmit={s.handleCommentSubmit}
    />
  );
}
