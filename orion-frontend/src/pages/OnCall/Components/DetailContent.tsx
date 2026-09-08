import { OnCallDetailContent } from '../OnCallDetailContent';
import type { useOnCallState } from '../useOnCallState';

type State = ReturnType<typeof useOnCallState>;

export function makeDetailContentFactory(s: State) {
  return () => (
    <OnCallDetailContent
      selectedSchedule={s.selectedSchedule}
      currentOnCall={s.currentOnCall}
      resolveUserName={s.resolveUserName}
      getAssignmentsForSchedule={s.getAssignmentsForSchedule}
      getOverridesForSchedule={s.getOverridesForSchedule}
    />
  );
}
