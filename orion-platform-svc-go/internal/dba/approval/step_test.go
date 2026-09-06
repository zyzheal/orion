package approval

import (
	"testing"
	"time"
)

func TestNewPendingStep_Defaults(t *testing.T) {
	cfg := Defaults()
	def := ApprovalStepDef{Role: "team_lead", Mode: ModeAny, Approvers: []string{"a"}}
	step := NewPendingStep(0, def, cfg)
	if step.Status != StatusPending {
		t.Fatalf("expected pending status, got %q", step.Status)
	}
	if step.StepIndex != 0 {
		t.Fatalf("expected step index 0, got %d", step.StepIndex)
	}
	if step.Def.TimeoutHours != 24 {
		t.Fatalf("expected default timeout 24h, got %d", step.Def.TimeoutHours)
	}
	if step.Def.TimeoutAction != TimeoutActionReject {
		t.Fatalf("expected default timeout action reject, got %q", step.Def.TimeoutAction)
	}
	if step.Def.ID == "" {
		t.Fatalf("expected generated step ID")
	}
	if step.Approvals == nil {
		t.Fatalf("expected non-nil approvals slice")
	}
	if len(step.Approvals) != 0 {
		t.Fatalf("expected zero initial approvals, got %d", len(step.Approvals))
	}
}

func TestStep_StartStep_Idempotent(t *testing.T) {
	cfg := Defaults()
	step := NewPendingStep(0, ApprovalStepDef{Role: "r", Approvers: []string{"a"}}, cfg)
	now := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)

	if err := step.StartStep(now); err != nil {
		t.Fatalf("first start failed: %v", err)
	}
	if step.Status != StatusInProgress {
		t.Fatalf("expected in_progress after start, got %q", step.Status)
	}
	if step.StartedAt == nil || !step.StartedAt.Equal(now) {
		t.Fatalf("started_at not set correctly")
	}

	// Second start is a no-op.
	if err := step.StartStep(now); err != nil {
		t.Fatalf("second start should be no-op: %v", err)
	}
}

func TestStep_StartStep_OnTerminal(t *testing.T) {
	cfg := Defaults()
	step := NewPendingStep(0, ApprovalStepDef{Role: "r", Approvers: []string{"a"}}, cfg)
	now := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)
	_ = step.StartStep(now)
	_ = step.FinishStep(StatusApproved, now)
	err := step.StartStep(now)
	if err == nil {
		t.Fatalf("expected error starting a terminal step")
	}
}

func TestStep_FinishStep_InvalidStatus(t *testing.T) {
	cfg := Defaults()
	step := NewPendingStep(0, ApprovalStepDef{Role: "r", Approvers: []string{"a"}}, cfg)
	if err := step.FinishStep("weird", time.Now()); err == nil {
		t.Fatalf("expected error for non-terminal status")
	}
}

func TestStep_FinishStep_TerminalToTerminal(t *testing.T) {
	cfg := Defaults()
	step := NewPendingStep(0, ApprovalStepDef{Role: "r", Approvers: []string{"a"}}, cfg)
	now := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)
	_ = step.StartStep(now)
	_ = step.FinishStep(StatusRejected, now)
	err := step.FinishStep(StatusApproved, now)
	if err == nil {
		t.Fatalf("expected error for terminal-to-terminal")
	}
}

func TestStep_AppendRecord_Duplicate(t *testing.T) {
	cfg := Defaults()
	step := NewPendingStep(0, ApprovalStepDef{Role: "r", Approvers: []string{"a"}}, cfg)
	now := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)
	_ = step.StartStep(now)

	rec := ApprovalRecord{
		InstanceID: "i1",
		StepIndex:  0,
		UserID:     "alice",
		Action:     ActionApprove,
		ActionedAt: now,
	}
	if err := step.AppendRecord(rec); err != nil {
		t.Fatalf("first record failed: %v", err)
	}
	if err := step.AppendRecord(rec); err == nil {
		t.Fatalf("expected duplicate-approve error")
	}
}

func TestStep_AppendRecord_DifferentUsers(t *testing.T) {
	cfg := Defaults()
	step := NewPendingStep(0, ApprovalStepDef{Role: "r", Approvers: []string{"a", "b"}}, cfg)
	now := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)
	_ = step.StartStep(now)

	recs := []ApprovalRecord{
		{InstanceID: "i1", StepIndex: 0, UserID: "alice", Action: ActionApprove, ActionedAt: now},
		{InstanceID: "i1", StepIndex: 0, UserID: "bob", Action: ActionApprove, ActionedAt: now},
		{InstanceID: "i1", StepIndex: 0, UserID: "carol", Action: ActionComment, ActionedAt: now, Comment: "hi"},
	}
	for _, r := range recs {
		if err := step.AppendRecord(r); err != nil {
			t.Fatalf("append %v failed: %v", r, err)
		}
	}
	if len(step.Approvals) != len(recs) {
		t.Fatalf("expected %d records, got %d", len(recs), len(step.Approvals))
	}
}

func TestStep_AppendRecord_MismatchedStepIndex(t *testing.T) {
	cfg := Defaults()
	step := NewPendingStep(0, ApprovalStepDef{Role: "r", Approvers: []string{"a"}}, cfg)
	rec := ApprovalRecord{
		InstanceID: "i1",
		StepIndex:  5, // mismatch
		UserID:     "alice",
		Action:     ActionApprove,
		ActionedAt: time.Now(),
	}
	if err := step.AppendRecord(rec); err == nil {
		t.Fatalf("expected step index mismatch error")
	}
}

func TestStep_AppendRecord_MissingUser(t *testing.T) {
	cfg := Defaults()
	step := NewPendingStep(0, ApprovalStepDef{Role: "r", Approvers: []string{"a"}}, cfg)
	if err := step.AppendRecord(ApprovalRecord{
		InstanceID: "i1",
		StepIndex:  0,
		UserID:     "",
		Action:     ActionApprove,
	}); err == nil {
		t.Fatalf("expected missing-user error")
	}
}

func TestStep_AppendRecord_UnknownAction(t *testing.T) {
	cfg := Defaults()
	step := NewPendingStep(0, ApprovalStepDef{Role: "r", Approvers: []string{"a"}}, cfg)
	if err := step.AppendRecord(ApprovalRecord{
		InstanceID: "i1",
		StepIndex:  0,
		UserID:     "alice",
		Action:     "explode",
	}); err == nil {
		t.Fatalf("expected unknown-action error")
	}
}

func TestStep_HasApprovedBy_HasRejectedBy(t *testing.T) {
	cfg := Defaults()
	step := NewPendingStep(0, ApprovalStepDef{Role: "r", Approvers: []string{"a", "b"}}, cfg)
	now := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)
	_ = step.StartStep(now)
	_ = step.AppendRecord(ApprovalRecord{InstanceID: "i1", StepIndex: 0, UserID: "alice", Action: ActionApprove, ActionedAt: now})
	_ = step.AppendRecord(ApprovalRecord{InstanceID: "i1", StepIndex: 0, UserID: "bob", Action: ActionReject, ActionedAt: now})
	if !step.HasApprovedBy("alice") {
		t.Fatalf("alice should have approved")
	}
	if step.HasApprovedBy("bob") {
		t.Fatalf("bob should not have approved")
	}
	if !step.HasRejectedBy("bob") {
		t.Fatalf("bob should have rejected")
	}
	if step.HasRejectedBy("alice") {
		t.Fatalf("alice should not have rejected")
	}
}
