package approval

import (
	"fmt"
	"time"
)

// NewPendingStep builds a fresh ApprovalStep for position idx of the
// given workflow definition. All approvals start empty and the step is
// left in StatusPending; the service layer flips it to StatusInProgress
// on start (see StartStep).
func NewPendingStep(idx int, def ApprovalStepDef, cfg Config) ApprovalStep {
	effDef := cfg.EffectiveDefaults(def)
	if effDef.ID == "" {
		effDef.ID = fmt.Sprintf("step-%d-%s", idx, effDef.Role)
	}
	return ApprovalStep{
		StepIndex: idx,
		Def:       effDef,
		Status:    StatusPending,
		Approvals: []ApprovalRecord{},
	}
}

// StartStep transitions a pending step to in_progress and stamps
// StartedAt. Idempotent: calling on an already-in_progress step is a
// no-op; calling on a terminal step is an error.
func (s *ApprovalStep) StartStep(now time.Time) error {
	switch s.Status {
	case StatusPending:
		t := now
		s.StartedAt = &t
		s.Status = StatusInProgress
		return nil
	case StatusInProgress:
		return nil
	default:
		return fmt.Errorf("cannot start step %d in status %q", s.StepIndex, s.Status)
	}
}

// FinishStep transitions a step to a terminal state (approved,
// rejected, or timed_out). Sets FinishedAt and refuses terminal-to-
// terminal transitions.
func (s *ApprovalStep) FinishStep(status string, now time.Time) error {
	if !isTerminalStatus(status) {
		return fmt.Errorf("step %d: %q is not a terminal status", s.StepIndex, status)
	}
	if isTerminalStatus(s.Status) {
		return fmt.Errorf("step %d already in terminal status %q", s.StepIndex, s.Status)
	}
	t := now
	s.FinishedAt = &t
	s.Status = status
	return nil
}

// AppendRecord adds an approval record to the step. It performs light
// validation: rejects records with empty UserID or unknown Action, and
// dedupes identical (UserID, Action) pairs that occur within the same
// step — the second call with the same user+action returns an error
// rather than silently accepting it, so the service layer surfaces the
// duplicate to the caller.
func (s *ApprovalStep) AppendRecord(rec ApprovalRecord) error {
	if rec.UserID == "" {
		return fmt.Errorf("step %d: record user_id required", s.StepIndex)
	}
	if rec.Action != ActionApprove &&
		rec.Action != ActionReject &&
		rec.Action != ActionComment {
		return fmt.Errorf("step %d: unknown action %q", s.StepIndex, rec.Action)
	}
	if rec.InstanceID == "" {
		return fmt.Errorf("step %d: record instance_id required", s.StepIndex)
	}
	if rec.StepIndex != s.StepIndex {
		return fmt.Errorf("step %d: record step_index mismatch (%d)",
			s.StepIndex, rec.StepIndex)
	}
	if rec.ActionedAt.IsZero() {
		now := time.Now().UTC()
		rec.ActionedAt = now
	}
	if s.Approvals == nil {
		s.Approvals = []ApprovalRecord{}
	}
	for _, existing := range s.Approvals {
		if existing.Action == rec.Action && existing.UserID == rec.UserID &&
			existing.Action != ActionComment {
			return fmt.Errorf("step %d: user %s already %s'd this step",
				s.StepIndex, rec.UserID, rec.Action)
		}
	}
	s.Approvals = append(s.Approvals, rec)
	return nil
}

// isTerminalStatus returns true when s is one of the terminal states
// a step or instance can occupy.
func isTerminalStatus(s string) bool {
	switch s {
	case StatusApproved, StatusRejected, StatusTimedOut:
		return true
	}
	return false
}

// IsInFlight returns true when the step is in_progress but has no
// recorded terminal outcome yet.
func (s *ApprovalStep) IsInFlight() bool {
	return s.Status == StatusInProgress
}

// HasApprovedBy reports whether the given user has already approved
// this step (used to reject duplicate submits at the service layer).
func (s *ApprovalStep) HasApprovedBy(userID string) bool {
	for _, r := range s.Approvals {
		if r.Action == ActionApprove && r.UserID == userID {
			return true
		}
	}
	return false
}

// HasRejectedBy reports whether the given user has already rejected
// this step.
func (s *ApprovalStep) HasRejectedBy(userID string) bool {
	for _, r := range s.Approvals {
		if r.Action == ActionReject && r.UserID == userID {
			return true
		}
	}
	return false
}
