package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/branch-policy/models"
)

// fakeSchemaChecker is a test double for SchemaCompatibilityChecker. All
// methods are fields so tests can control each call precisely.
type fakeSchemaChecker struct {
	// result is returned by CheckSchemaCompatibility. When nil and err is
	// nil, the checker signals "no info" and the service records a warning.
	result *SchemaCompatibilityResult
	err    error
	// calls counts invocations so tests can assert the checker was (or was
	// not) called.
	calls int
	// lastReq records the most recent request the checker saw, so tests can
	// assert the service passes the right pointer.
	lastReq *models.DeployRequest
}

func (f *fakeSchemaChecker) CheckSchemaCompatibility(ctx context.Context, req *models.DeployRequest) (*SchemaCompatibilityResult, error) {
	f.calls++
	f.lastReq = req
	return f.result, f.err
}

// TestRunSchemaCompatibility_NilCheckerFallsBackToPlaceholder asserts the
// pre-wiring behaviour: when no checker is attached, R6 passes with a
// "not wired — placeholder" detail. This is the backward-compatible path
// that lets the branch-policy service run in environments that do not yet
// have a schema registry.
func TestRunSchemaCompatibility_NilCheckerFallsBackToPlaceholder(t *testing.T) {
	svc := NewService(newFakeRepo())
	passed, detail, err := svc.runSchemaCompatibility(context.Background(), &models.DeployRequest{
		TenantID: "t1", Branch: "main", TargetEnv: "prod",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !passed {
		t.Errorf("expected placeholder path to pass, got failed")
	}
	if !strings.Contains(detail, "not wired") {
		t.Errorf("expected detail to mention 'not wired', got %q", detail)
	}
}

// TestRunSchemaCompatibility_CheckerSaysCompatible asserts the happy path:
// a checker that reports Compatible=true with no warnings produces a
// "schema-compatible" detail and passes the rule.
func TestRunSchemaCompatibility_CheckerSaysCompatible(t *testing.T) {
	checker := &fakeSchemaChecker{result: &SchemaCompatibilityResult{Compatible: true}}
	svc := NewService(newFakeRepo()).WithSchemaChecker(checker)
	passed, detail, err := svc.runSchemaCompatibility(context.Background(), &models.DeployRequest{
		TenantID: "t1", Branch: "main", TargetEnv: "prod",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !passed {
		t.Errorf("expected rule to pass, got failed")
	}
	if detail != "schema-compatible" {
		t.Errorf("detail = %q, want %q", detail, "schema-compatible")
	}
	if checker.calls != 1 {
		t.Errorf("checker.calls = %d, want 1", checker.calls)
	}
}

// TestRunSchemaCompatibility_CheckerSaysCompatibleWithWarnings asserts that
// warnings do not flip the rule to failed but do surface in the detail
// string so operators can see them.
func TestRunSchemaCompatibility_CheckerSaysCompatibleWithWarnings(t *testing.T) {
	checker := &fakeSchemaChecker{result: &SchemaCompatibilityResult{
		Compatible: true,
		Warnings:   []string{"deprecated column scheduled for removal in v3", "planned migration 2026-10-01"},
	}}
	svc := NewService(newFakeRepo()).WithSchemaChecker(checker)
	passed, detail, err := svc.runSchemaCompatibility(context.Background(), &models.DeployRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !passed {
		t.Errorf("warnings should not fail the rule, got failed")
	}
	if !strings.Contains(detail, "schema-compatible with 2 warning(s)") {
		t.Errorf("detail = %q, want contains %q", detail, "schema-compatible with 2 warning(s)")
	}
	if !strings.Contains(detail, "deprecated column") {
		t.Errorf("detail should include first warning, got %q", detail)
	}
}

// TestRunSchemaCompatibility_CheckerSaysIncompatible asserts that a
// Compatible=false result flips the rule to failed and surfaces the breaking
// changes in the detail.
func TestRunSchemaCompatibility_CheckerSaysIncompatible(t *testing.T) {
	checker := &fakeSchemaChecker{result: &SchemaCompatibilityResult{
		Compatible: false,
		Breaking:   []string{"column 'legacy_flag' dropped by migration 2026-08-01", "foreign key 'user_id' changed to NOT NULL"},
	}}
	svc := NewService(newFakeRepo()).WithSchemaChecker(checker)
	passed, detail, err := svc.runSchemaCompatibility(context.Background(), &models.DeployRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if passed {
		t.Errorf("expected rule to fail on incompatible, got passed")
	}
	if !strings.Contains(detail, "schema-incompatible") {
		t.Errorf("detail = %q, want contains 'schema-incompatible'", detail)
	}
	if !strings.Contains(detail, "column 'legacy_flag' dropped") {
		t.Errorf("detail should include first breaking change, got %q", detail)
	}
}

// TestRunSchemaCompatibility_CheckerReturnsNilResult handles the edge case
// where a checker has no info to report. The rule passes with an
// informative detail so operators can distinguish this from a real pass.
func TestRunSchemaCompatibility_CheckerReturnsNilResult(t *testing.T) {
	checker := &fakeSchemaChecker{result: nil}
	svc := NewService(newFakeRepo()).WithSchemaChecker(checker)
	passed, detail, err := svc.runSchemaCompatibility(context.Background(), &models.DeployRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !passed {
		t.Errorf("nil result should pass (no info, not incompatible), got failed")
	}
	if !strings.Contains(detail, "returned nil result") {
		t.Errorf("detail = %q, want contains 'returned nil result'", detail)
	}
}

// TestRunSchemaCompatibility_CheckerErrorRecordsFailureWithoutPropagating
// asserts the fail-closed contract: a checker error flips the rule to
// failed (recorded with the error detail) but does NOT return an error from
// runSchemaCompatibility — that would blow up the whole PreDeployGate
// instead of just the R6 rule.
func TestRunSchemaCompatibility_CheckerErrorRecordsFailureWithoutPropagating(t *testing.T) {
	wantErr := errors.New("schema registry unavailable")
	checker := &fakeSchemaChecker{err: wantErr}
	svc := NewService(newFakeRepo()).WithSchemaChecker(checker)
	passed, detail, err := svc.runSchemaCompatibility(context.Background(), &models.DeployRequest{})
	if err != nil {
		t.Fatalf("runSchemaCompatibility must NOT propagate checker errors, got %v", err)
	}
	if passed {
		t.Errorf("checker error should fail the rule, got passed")
	}
	if !strings.Contains(detail, wantErr.Error()) {
		t.Errorf("detail = %q, want contains %q", detail, wantErr.Error())
	}
	if !strings.Contains(detail, "check failed") {
		t.Errorf("detail = %q, want contains 'check failed'", detail)
	}
}

// TestWithSchemaChecker_Chainable verifies the builder is chainable and
// idempotent.
func TestWithSchemaChecker_Chainable(t *testing.T) {
	base := NewService(newFakeRepo())
	c := &fakeSchemaChecker{result: &SchemaCompatibilityResult{Compatible: true}}
	out := base.WithSchemaChecker(c).WithLogger(nil).WithSchemaChecker(c)
	if out != base {
		t.Error("WithSchemaChecker should return the same *Service pointer")
	}
	if base.schemaChecker != c {
		t.Error("WithSchemaChecker did not set the schemaChecker field")
	}
}

// TestCheckPreDeployGate_R6PassesWithWiredChecker asserts the end-to-end
// integration: R6 shows up in the PreDeployGate result with the expected
// RuleID and Detail.
func TestCheckPreDeployGate_R6PassesWithWiredChecker(t *testing.T) {
	checker := &fakeSchemaChecker{result: &SchemaCompatibilityResult{Compatible: true}}
	svc := NewService(newFakeRepo()).WithSchemaChecker(checker)
	// R1-R5 all pass because we give a valid-enough request with no approvals
	// or artifacts. We only care about R6.
	result, err := svc.CheckPreDeployGate(context.Background(), "t1", models.DeployRequest{
		TenantID: "t1", Branch: "main", TargetEnv: "prod", PipelineName: "p",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	var r6 *models.GateRuleResult
	for i := range result.Rules {
		if result.Rules[i].RuleID == GateRuleIDSchema {
			r6 = &result.Rules[i]
			break
		}
	}
	if r6 == nil {
		t.Fatalf("R6 rule missing from result.Rules: %+v", result.Rules)
	}
	if r6.Name != "schema-compatibility" {
		t.Errorf("r6.Name = %q, want %q", r6.Name, "schema-compatibility")
	}
	if r6.Severity != models.GateSeverityWarning {
		t.Errorf("r6.Severity = %q, want Warning (still non-blocking)", r6.Severity)
	}
	if r6.Detail != "schema-compatible" {
		t.Errorf("r6.Detail = %q, want %q", r6.Detail, "schema-compatible")
	}
}

// TestCheckPreDeployGate_R6SeverityStaysWarningEvenOnFailure guards against
// a future change that would silently escalate R6 from Warning to Blocking
// — that would break callers relying on the non-blocking contract.
func TestCheckPreDeployGate_R6SeverityStaysWarningEvenOnFailure(t *testing.T) {
	checker := &fakeSchemaChecker{result: &SchemaCompatibilityResult{
		Compatible: false,
		Breaking:   []string{"some breaking change"},
	}}
	svc := NewService(newFakeRepo()).WithSchemaChecker(checker)
	result, err := svc.CheckPreDeployGate(context.Background(), "t1", models.DeployRequest{
		TenantID: "t1", Branch: "main", TargetEnv: "prod", PipelineName: "p",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for i := range result.Rules {
		if result.Rules[i].RuleID == GateRuleIDSchema {
			if result.Rules[i].Severity != models.GateSeverityWarning {
				t.Errorf("R6 severity changed to %q — this would silently escalate behaviour",
					result.Rules[i].Severity)
			}
			if result.Rules[i].Passed {
				t.Error("R6 should fail when checker says incompatible")
			}
			// Since R6 is Warning, it should NOT be in result.Blocked.
			for _, id := range result.Blocked {
				if id == GateRuleIDSchema {
					t.Errorf("R6 (Warning) must not be in Blocked list")
				}
			}
			return
		}
	}
	t.Fatalf("R6 rule missing from result.Rules")
}
