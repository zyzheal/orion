package approval

import (
	"testing"
	"time"
)

// ---- EffectiveRequired ----

func TestEffectiveRequired_Modes(t *testing.T) {
	cases := []struct {
		name string
		def  ApprovalStepDef
		want int
	}{
		{"unanimous-3", ApprovalStepDef{Mode: ModeUnanimous, Approvers: []string{"a", "b", "c"}}, 3},
		{"any-3", ApprovalStepDef{Mode: ModeAny, Approvers: []string{"a", "b", "c"}}, 1},
		{"majority-3", ApprovalStepDef{Mode: ModeMajority, Approvers: []string{"a", "b", "c"}}, 2},
		{"majority-2", ApprovalStepDef{Mode: ModeMajority, Approvers: []string{"a", "b"}}, 2},
		{"empty-mode-defaults-unanimous", ApprovalStepDef{Approvers: []string{"a", "b"}}, 2},
		{"empty-approvers", ApprovalStepDef{Approvers: nil}, 0},
		// Required wins over mode.
		{"required-overrides-any", ApprovalStepDef{Mode: ModeAny, Required: 2, Approvers: []string{"a", "b", "c"}}, 2},
		{"required-clamps-to-n", ApprovalStepDef{Required: 5, Approvers: []string{"a", "b"}}, 2},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := EffectiveRequired(c.def)
			if got != c.want {
				t.Fatalf("EffectiveRequired = %d, want %d", got, c.want)
			}
		})
	}
}

// ---- ValidateWorkflow ----

func TestValidateWorkflow_Errors(t *testing.T) {
	cfg := Defaults()
	cases := []struct {
		name string
		w    *ApprovalWorkflow
		want string
	}{
		{"nil", nil, "nil"},
		{"empty name", &ApprovalWorkflow{Steps: []ApprovalStepDef{{Role: "r", Approvers: []string{"a"}}}}, "name"},
		{"no steps", &ApprovalWorkflow{Name: "x"}, "steps"},
		{"too many steps", &ApprovalWorkflow{
			Name:  "x",
			Steps: genSteps(15),
		}, "max"},
		{"missing role", &ApprovalWorkflow{
			Name:  "x",
			Steps: []ApprovalStepDef{{Approvers: []string{"a"}}},
		}, "role"},
		{"missing approvers", &ApprovalWorkflow{
			Name:  "x",
			Steps: []ApprovalStepDef{{Role: "r"}},
		}, "approvers"},
		{"unknown mode", &ApprovalWorkflow{
			Name:  "x",
			Steps: []ApprovalStepDef{{Role: "r", Mode: "weird", Approvers: []string{"a"}}},
		}, "mode"},
		{"unknown timeout action", &ApprovalWorkflow{
			Name:  "x",
			Steps: []ApprovalStepDef{{Role: "r", TimeoutAction: "explode", Approvers: []string{"a"}}},
		}, "timeout"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := ValidateWorkflow(c.w, cfg)
			if err == nil {
				t.Fatalf("expected error containing %q", c.want)
			}
		})
	}
}

func TestValidateWorkflow_OK(t *testing.T) {
	w := &ApprovalWorkflow{
		Name: "standard",
		Steps: []ApprovalStepDef{
			{Role: "team_lead", Mode: ModeAny, Approvers: []string{"a", "b"}},
			{Role: "dba_lead", Mode: ModeUnanimous, Approvers: []string{"c", "d"}},
		},
	}
	if err := ValidateWorkflow(w, Defaults()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// ---- EvaluateStep ----

func TestEvaluateStep_UnanimousThreshold(t *testing.T) {
	cfg := Defaults()
	def := ApprovalStepDef{Mode: ModeUnanimous, Approvers: []string{"a", "b", "c"}}
	now := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)
	start := now.Add(-time.Hour)

	step := ApprovalStep{
		Status: StatusInProgress,
		StartedAt: &start,
		Approvals: []ApprovalRecord{
			{UserID: "a", Action: ActionApprove},
			{UserID: "b", Action: ActionApprove},
		},
	}
	ev := EvaluateStep(step, def, cfg, now)
	if ev.Complete {
		t.Fatalf("2 of 3 approvals should not complete a unanimous step")
	}
	if ev.ApprovalsObtained != 2 || ev.ApprovalsNeeded != 3 {
		t.Fatalf("wrong counts: got %d/%d want 2/3", ev.ApprovalsObtained, ev.ApprovalsNeeded)
	}

	step.Approvals = append(step.Approvals, ApprovalRecord{UserID: "c", Action: ActionApprove})
	ev = EvaluateStep(step, def, cfg, now)
	if !ev.Complete || !ev.Passed {
		t.Fatalf("3 of 3 approvals should pass: %+v", ev)
	}
	if ev.TerminalStatus != StatusApproved {
		t.Fatalf("terminal status should be approved, got %q", ev.TerminalStatus)
	}
}

func TestEvaluateStep_AnyMode(t *testing.T) {
	cfg := Defaults()
	def := ApprovalStepDef{Mode: ModeAny, Approvers: []string{"a", "b", "c"}}
	now := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)
	start := now.Add(-time.Hour)

	step := ApprovalStep{
		Status:    StatusInProgress,
		StartedAt: &start,
		Approvals: []ApprovalRecord{{UserID: "a", Action: ActionApprove}},
	}
	ev := EvaluateStep(step, def, cfg, now)
	if !ev.Complete || !ev.Passed {
		t.Fatalf("any-mode should pass after 1 approval: %+v", ev)
	}
	if ev.ApprovalsNeeded != 1 {
		t.Fatalf("any-mode approvals needed should be 1, got %d", ev.ApprovalsNeeded)
	}
}

func TestEvaluateStep_RequiredN(t *testing.T) {
	cfg := Defaults()
	// Required overrides mode to require 2-of-5.
	def := ApprovalStepDef{Mode: ModeAny, Required: 2, Approvers: []string{"a", "b", "c", "d", "e"}}
	now := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)
	start := now.Add(-time.Hour)

	step := ApprovalStep{
		Status:    StatusInProgress,
		StartedAt: &start,
		Approvals: []ApprovalRecord{
			{UserID: "a", Action: ActionApprove},
		},
	}
	ev := EvaluateStep(step, def, cfg, now)
	if ev.Complete {
		t.Fatalf("1 of 2 required approvals should not complete")
	}
	step.Approvals = append(step.Approvals, ApprovalRecord{UserID: "b", Action: ActionApprove})
	ev = EvaluateStep(step, def, cfg, now)
	if !ev.Complete || !ev.Passed {
		t.Fatalf("2 of 2 required approvals should pass: %+v", ev)
	}
}

func TestEvaluateStep_RejectionFails(t *testing.T) {
	cfg := Defaults()
	def := ApprovalStepDef{Mode: ModeUnanimous, Approvers: []string{"a", "b", "c"}}
	now := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)
	start := now.Add(-time.Hour)

	step := ApprovalStep{
		Status:    StatusInProgress,
		StartedAt: &start,
		Approvals: []ApprovalRecord{
			{UserID: "a", Action: ActionApprove},
			{UserID: "b", Action: ActionReject},
		},
	}
	ev := EvaluateStep(step, def, cfg, now)
	if !ev.Complete || ev.Passed {
		t.Fatalf("rejection should fail the step: %+v", ev)
	}
	if ev.TerminalStatus != StatusRejected {
		t.Fatalf("terminal should be rejected, got %q", ev.TerminalStatus)
	}
	if ev.RejectionsObtained != 1 {
		t.Fatalf("rejections should be 1, got %d", ev.RejectionsObtained)
	}
}

func TestEvaluateStep_TimeoutAutoReject(t *testing.T) {
	cfg := Config{
		DefaultTimeoutHours:  1,
		DefaultTimeoutAction: TimeoutActionReject,
		MaxSteps:             10,
		MaxApprovers:         50,
	}
	def := ApprovalStepDef{Mode: ModeUnanimous, Approvers: []string{"a", "b"}}
	now := time.Date(2026, 9, 6, 14, 0, 0, 0, time.UTC)
	start := now.Add(-2 * time.Hour) // 2h ago, exceeds 1h timeout

	step := ApprovalStep{
		Status:    StatusInProgress,
		StartedAt: &start,
	}
	ev := EvaluateStep(step, def, cfg, now)
	if !ev.Complete || ev.Passed {
		t.Fatalf("timeout with reject should fail the step: %+v", ev)
	}
	if ev.TerminalStatus != StatusTimedOut {
		t.Fatalf("terminal should be timed_out, got %q", ev.TerminalStatus)
	}
}

func TestEvaluateStep_TimeoutAutoApprove(t *testing.T) {
	cfg := Config{
		DefaultTimeoutHours:  1,
		DefaultTimeoutAction: TimeoutActionApprove,
	}
	def := ApprovalStepDef{Mode: ModeUnanimous, Approvers: []string{"a", "b"}}
	now := time.Date(2026, 9, 6, 14, 0, 0, 0, time.UTC)
	start := now.Add(-2 * time.Hour)
	step := ApprovalStep{
		Status:    StatusInProgress,
		StartedAt: &start,
	}
	ev := EvaluateStep(step, def, cfg, now)
	if !ev.Complete || !ev.Passed {
		t.Fatalf("timeout with approve should pass the step: %+v", ev)
	}
	if ev.TerminalStatus != StatusTimedOut {
		t.Fatalf("terminal should be timed_out, got %q", ev.TerminalStatus)
	}
}

func TestEvaluateStep_TimeoutEscalate(t *testing.T) {
	cfg := Config{
		DefaultTimeoutHours:  1,
		DefaultTimeoutAction: TimeoutActionEscalate,
	}
	def := ApprovalStepDef{Mode: ModeUnanimous, Approvers: []string{"a", "b"}}
	now := time.Date(2026, 9, 6, 14, 0, 0, 0, time.UTC)
	start := now.Add(-2 * time.Hour)
	step := ApprovalStep{
		Status:    StatusInProgress,
		StartedAt: &start,
	}
	ev := EvaluateStep(step, def, cfg, now)
	if ev.Complete {
		t.Fatalf("escalate timeout should NOT complete the step: %+v", ev)
	}
	if !ev.CanEscalate {
		t.Fatalf("should be escalatable: %+v", ev)
	}
}

func TestEvaluateStep_BeforeTimeout(t *testing.T) {
	cfg := Config{
		DefaultTimeoutHours:  1,
		DefaultTimeoutAction: TimeoutActionReject,
	}
	def := ApprovalStepDef{Mode: ModeUnanimous, Approvers: []string{"a", "b"}}
	now := time.Date(2026, 9, 6, 12, 30, 0, 0, time.UTC)
	start := now.Add(-30 * time.Minute)
	step := ApprovalStep{
		Status:    StatusInProgress,
		StartedAt: &start,
	}
	ev := EvaluateStep(step, def, cfg, now)
	if ev.Complete || ev.CanEscalate {
		t.Fatalf("should not be complete/escalatable before timeout: %+v", ev)
	}
}

func TestEvaluateStep_AlreadyTerminal(t *testing.T) {
	cfg := Defaults()
	def := ApprovalStepDef{Mode: ModeUnanimous, Approvers: []string{"a"}}
	now := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)

	step := ApprovalStep{
		Status: StatusApproved,
		Approvals: []ApprovalRecord{{UserID: "a", Action: ActionApprove}},
	}
	ev := EvaluateStep(step, def, cfg, now)
	if !ev.Complete || !ev.Passed {
		t.Fatalf("already-approved step should be complete+passed: %+v", ev)
	}
	step.Status = StatusRejected
	ev = EvaluateStep(step, def, cfg, now)
	if !ev.Complete || ev.Passed {
		t.Fatalf("already-rejected step should be complete+failed: %+v", ev)
	}
}

func TestEvaluateStep_NoApproversAutoPasses(t *testing.T) {
	cfg := Defaults()
	def := ApprovalStepDef{Mode: ModeUnanimous} // no Approvers
	now := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)
	step := ApprovalStep{Status: StatusInProgress}
	ev := EvaluateStep(step, def, cfg, now)
	if !ev.Complete || !ev.Passed {
		t.Fatalf("step with no approvers should auto-pass: %+v", ev)
	}
}

// ---- helpers ----

func genSteps(n int) []ApprovalStepDef {
	out := make([]ApprovalStepDef, n)
	for i := range out {
		out[i] = ApprovalStepDef{
			Role:      "role",
			Mode:      ModeAny,
			Approvers: []string{"a"},
		}
	}
	return out
}
