package approval

import (
	"fmt"
	"time"
)

// StepEvaluation is the outcome of evaluating a step's completion
// condition. The service layer uses this to decide whether to
// transition the step to a terminal state and to advance the flow.
type StepEvaluation struct {
	// Complete is true when the step's condition has been met:
	//   - a rejection was recorded, OR
	//   - the approval threshold was reached, OR
	//   - the step's timeout fired with an auto-deciding action
	//     (approve/reject).
	Complete bool
	// Passed is true when the step is complete AND the flow should
	// continue to the next step. False when the step rejected.
	Passed bool
	// Reason is a short human-readable explanation.
	Reason string
	// CanEscalate is true when the step is in_progress, timed out,
	// and its TimeoutAction is "escalate" — signalling the service
	// to allow the escalate endpoint to advance to the next step.
	CanEscalate bool
	// TerminalStatus, when non-empty, is the status the service should
	// persist for this step to reflect the evaluation outcome
	// (e.g. "approved", "rejected", "timed_out").
	TerminalStatus string
	// ApprovalsNeeded is the effective threshold for this step.
	ApprovalsNeeded int
	// ApprovalsObtained is the count of distinct approved users.
	ApprovalsObtained int
	// RejectionsObtained is the count of distinct rejecting users.
	RejectionsObtained int
}

// EffectiveRequired computes the approval threshold for a step
// definition. Explicit Required > 0 wins over mode; otherwise mode
// drives the threshold. Returns 0 when there are no approvers so
// callers can auto-pass a misconfigured step.
func EffectiveRequired(def ApprovalStepDef) int {
	n := len(def.Approvers)
	if n == 0 {
		return 0
	}
	if def.Required > 0 {
		if def.Required > n {
			return n
		}
		return def.Required
	}
	switch def.Mode {
	case ModeAny:
		return 1
	case ModeMajority:
		return n/2 + 1
	case ModeUnanimous, "":
		return n
	default:
		return n
	}
}

// ValidateWorkflow checks a workflow definition for structural issues
// that would make it unrunnable. Called at creation time and at submit
// time so stale / edited workflows surface errors early.
func ValidateWorkflow(w *ApprovalWorkflow, cfg Config) error {
	if w == nil {
		return fmt.Errorf("workflow is nil")
	}
	if w.Name == "" {
		return fmt.Errorf("workflow name is required")
	}
	if len(w.Steps) == 0 {
		return fmt.Errorf("workflow has no steps")
	}
	if cfg.MaxSteps > 0 && len(w.Steps) > cfg.MaxSteps {
		return fmt.Errorf("workflow has %d steps, max is %d", len(w.Steps), cfg.MaxSteps)
	}
	for i, def := range w.Steps {
		if def.Role == "" {
			return fmt.Errorf("step %d: role is required", i)
		}
		if len(def.Approvers) == 0 {
			return fmt.Errorf("step %d (%s): approvers required", i, def.Role)
		}
		if cfg.MaxApprovers > 0 && len(def.Approvers) > cfg.MaxApprovers {
			return fmt.Errorf("step %d: %d approvers exceeds max %d",
				i, len(def.Approvers), cfg.MaxApprovers)
		}
		if def.Mode != "" &&
			def.Mode != ModeUnanimous &&
			def.Mode != ModeAny &&
			def.Mode != ModeMajority {
			return fmt.Errorf("step %d: unknown mode %q", i, def.Mode)
		}
		if def.TimeoutAction != "" &&
			def.TimeoutAction != TimeoutActionReject &&
			def.TimeoutAction != TimeoutActionEscalate &&
			def.TimeoutAction != TimeoutActionApprove {
			return fmt.Errorf("step %d: unknown timeout_action %q", i, def.TimeoutAction)
		}
	}
	return nil
}

// EvaluateStep computes the completion state of a step given the
// definition, current runtime state, config defaults, and the current
// clock. Pure function: no persistence, no side effects.
//
// The step's own Status is authoritative when already terminal
// (approved / rejected / timed_out). Otherwise EvaluateStep applies the
// approval threshold and timeout rules to decide whether the step has
// become complete (and, if so, in which terminal state it should be
// persisted).
func EvaluateStep(step ApprovalStep, def ApprovalStepDef, cfg Config, now time.Time) StepEvaluation {
	effDef := cfg.EffectiveDefaults(def)
	needed := EffectiveRequired(effDef)
	approvals := countDistinctUsers(step.Approvals, ActionApprove)
	rejections := countDistinctUsers(step.Approvals, ActionReject)

	ev := StepEvaluation{
		ApprovalsNeeded:   needed,
		ApprovalsObtained: approvals,
		RejectionsObtained: rejections,
	}

	// Already-terminal steps are immutable from the evaluation's
	// perspective; callers should not re-evaluate them.
	switch step.Status {
	case StatusApproved, StatusRejected, StatusTimedOut:
		ev.Complete = true
		ev.Passed = step.Status == StatusApproved
		ev.Reason = "step already finished: " + step.Status
		ev.TerminalStatus = step.Status
		return ev
	}

	// Rejection always fails fast regardless of threshold.
	if rejections > 0 {
		ev.Complete = true
		ev.Passed = false
		ev.TerminalStatus = StatusRejected
		ev.Reason = fmt.Sprintf("step rejected by %d approver(s)", rejections)
		return ev
	}

	// A step with no approvers auto-passes so a misconfigured
	// workflow cannot deadlock the flow.
	if needed == 0 {
		ev.Complete = true
		ev.Passed = true
		ev.TerminalStatus = StatusApproved
		ev.Reason = "step has no approvers; auto-passing"
		return ev
	}

	// Threshold met → step passes.
	if approvals >= needed {
		ev.Complete = true
		ev.Passed = true
		ev.TerminalStatus = StatusApproved
		ev.Reason = fmt.Sprintf("%d/%d approvals collected", approvals, needed)
		return ev
	}

	// Threshold not met: check timeout.
	if effDef.TimeoutHours > 0 && step.StartedAt != nil {
		deadline := step.StartedAt.Add(time.Duration(effDef.TimeoutHours) * time.Hour)
		if now.After(deadline) {
			switch effDef.TimeoutAction {
			case TimeoutActionApprove:
				ev.Complete = true
				ev.Passed = true
				ev.TerminalStatus = StatusTimedOut
				ev.Reason = "step timed out; auto-approved per config"
				return ev
			case TimeoutActionReject:
				ev.Complete = true
				ev.Passed = false
				ev.TerminalStatus = StatusTimedOut
				ev.Reason = "step timed out; auto-rejected per config"
				return ev
			case TimeoutActionEscalate:
				ev.CanEscalate = true
				ev.Reason = "step timed out; escalation available"
				return ev
			}
		}
	}

	// Still in flight: not complete, not escalatable.
	ev.Reason = fmt.Sprintf("%d/%d approvals, not yet complete", approvals, needed)
	return ev
}

// countDistinctUsers returns the number of unique user IDs that have
// performed the given action at least once on this step. Multiple
// approvals by the same user count as one.
func countDistinctUsers(recs []ApprovalRecord, action string) int {
	seen := make(map[string]struct{}, len(recs))
	for _, r := range recs {
		if r.Action != action {
			continue
		}
		seen[r.UserID] = struct{}{}
	}
	return len(seen)
}
