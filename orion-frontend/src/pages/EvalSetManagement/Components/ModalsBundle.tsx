import { CreateEvalSetModal } from '../CreateEvalSetModal';
import { EvalSetDetailModal } from '../EvalSetDetailModal';
import type { useEvalSetState } from '../useEvalSetState';

type State = ReturnType<typeof useEvalSetState>;

export function EvalSetModalsBundle({ s }: { s: State }) {
  return (
    <>
      <CreateEvalSetModal
        open={s.createModalOpen}
        onCancel={() => {
          s.setCreateModalOpen(false);
          s.createForm.resetFields();
        }}
        onOk={s.handleCreateSet}
        form={s.createForm}
      />
      <EvalSetDetailModal
        selectedSet={s.selectedSet}
        runLoading={s.runLoading}
        onClose={() => s.setSelectedSet(null)}
        onRunEval={s.handleRunEval}
      />
    </>
  );
}
