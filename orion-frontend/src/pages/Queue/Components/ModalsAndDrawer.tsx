import { EnqueueModal } from '../Modals/EnqueueModal';
import { DequeueModal } from '../Modals/DequeueModal';
import { DetailDrawer } from './DetailDrawer';
import type { useQueueState } from '../useQueueState';

type State = ReturnType<typeof useQueueState>;

interface Props {
  state: State;
}

export function ModalsAndDrawer({ state: s }: Props) {
  return (
    <>
      <EnqueueModal
        open={s.enqueueModalVisible}
        form={s.enqueueForm}
        submitting={s.submitting}
        onCancel={() => s.setEnqueueModalVisible(false)}
        onOk={s.handleEnqueue}
      />

      <DequeueModal
        open={s.dequeueModalVisible}
        form={s.dequeueForm}
        submitting={s.submitting}
        onCancel={() => s.setDequeueModalVisible(false)}
        onOk={s.handleDequeue}
      />

      <DetailDrawer
        open={s.detailDrawerVisible}
        selectedJob={s.selectedJob}
        onClose={() => s.setDetailDrawerVisible(false)}
        handleComplete={s.handleComplete}
        handleFail={s.handleFail}
      />
    </>
  );
}
