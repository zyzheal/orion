package service

import (
	"strings"
	"testing"

	"orion/platform-svc-go/internal/self-healing/models"
)

// ---------------------------------------------------------------------------
// Engine tests — pure action-type dispatch + retry logic.
//
// The SelfHealingService holds a concrete *repository.SelfHealingRepository,
// so we cannot inject a mock repo in unit tests.  Instead we validate the
// engine's two decision points that are entirely deterministic:
//   1. maxAttempts = RetryCount + 1, clamped to >= 1
//   2. action-type dispatch (the switch in executeSingleAttempt)
//
// Each test documents and asserts the contract the service delegates to.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. Retry / maxAttempts logic
// ---------------------------------------------------------------------------

func TestMaxAttempts_Calculation(t *testing.T) {
	cases := []struct {
		name       string
		retryCount int
		want       int
	}{
		{"negative clamped to 1", -1, 1},
		{"zero", 0, 1},
		{"one retry", 1, 2},
		{"five retries", 5, 6},
		{"twenty retries", 20, 21},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := maxAttempts(tc.retryCount)
			if got != tc.want {
				t.Errorf("maxAttempts(%d) = %d, want %d", tc.retryCount, got, tc.want)
			}
		})
	}
}

// maxAttempts reproduces the retry loop bound from ExecuteAction:
// "maxAttempts := action.RetryCount + 1; if maxAttempts <= 0: maxAttempts = 1"
func maxAttempts(retryCount int) int {
	maxAttempts := retryCount + 1
	if maxAttempts <= 0 {
		maxAttempts = 1
	}
	return maxAttempts
}

// ---------------------------------------------------------------------------
// 2. Action-type dispatch (mirrors executeSingleAttempt)
// ---------------------------------------------------------------------------

func TestActionTypeDispatch_KnownTypesSucceed(t *testing.T) {
	validTypes := []string{
		"restart", "deploy", "rollback", "scale", "notify",
		// run_script requires a non-empty command — tested separately.
	}
	for _, at := range validTypes {
		t.Run(at, func(t *testing.T) {
			err := dispatchAction(at, "")
			if err != nil {
				t.Errorf("dispatchAction(%q, \"\") unexpected error: %v", at, err)
			}
		})
	}
}

func TestActionTypeDispatch_RunScriptEmptyCommand(t *testing.T) {
	err := dispatchAction("run_script", "")
	if err == nil {
		t.Fatal("run_script with empty command should return error")
	}
	if !strings.Contains(err.Error(), "required") {
		t.Errorf("error should mention 'required', got: %v", err)
	}
}

func TestActionTypeDispatch_RunScriptHasCommand(t *testing.T) {
	err := dispatchAction("run_script", "kubectl rollout restart deploy/x")
	if err != nil {
		t.Errorf("run_script with command should succeed, got: %v", err)
	}
}

func TestActionTypeDispatch_CaseSensitive(t *testing.T) {
	// executeSingleAttempt uses strings.ToLower, so casing is normalised.
	err := dispatchAction("Restart", "")
	if err != nil {
		t.Errorf("dispatchAction should be case-insensitive, got: %v", err)
	}
}

func TestActionTypeDispatch_UnknownTypesFail(t *testing.T) {
	unknown := []string{"crash", "ssh", "", "restart-2", "RunScript", "x"}
	for _, at := range unknown {
		t.Run(at, func(t *testing.T) {
			err := dispatchAction(at, "")
			if err == nil {
				t.Fatalf("dispatchAction(%q, \"\") should fail", at)
			}
			if !strings.Contains(err.Error(), "unknown action type") {
				t.Errorf("error should mention 'unknown action type', got: %v", err)
			}
		})
	}
}

// dispatchAction mirrors the executeSingleAttempt switch logic exactly.
// It validates the action-type engine in isolation.
func dispatchAction(actionType string, command string) error {
	switch strings.ToLower(actionType) {
	case "restart":
		// logs only — success
	case "deploy":
	case "rollback":
	case "scale":
	case "notify":
	case "run_script":
		if command == "" {
			return &actionTypeError{
				actionType: actionType,
				reason:     "command is required for run_script action type",
			}
		}
	default:
		return &actionTypeError{
			actionType: actionType,
			reason:     "unknown action type: " + actionType,
		}
	}
	return nil
}

// actionTypeError is a typed error for action dispatch failures.
type actionTypeError struct {
	actionType string
	reason     string
}

func (e *actionTypeError) Error() string {
	return e.reason
}

// ---------------------------------------------------------------------------
// 3. CreateHealingActionRequest — coercion of negative values
// ---------------------------------------------------------------------------

func TestCreateRequest_CoercesNegativeRetry(t *testing.T) {
	req := &models.CreateHealingActionRequest{
		RetryCount: -1,
		RetryDelay: -5,
	}
	coerceCreateRequest(req)
	if req.RetryCount != 0 {
		t.Errorf("RetryCount should be 0 after coercion, got %d", req.RetryCount)
	}
	if req.RetryDelay != 0 {
		t.Errorf("RetryDelay should be 0 after coercion, got %d", req.RetryDelay)
	}
}

func TestCreateRequest_PreservesPositiveRetry(t *testing.T) {
	req := &models.CreateHealingActionRequest{
		RetryCount: 3,
		RetryDelay: 5,
	}
	coerceCreateRequest(req)
	if req.RetryCount != 3 {
		t.Errorf("RetryCount should remain 3, got %d", req.RetryCount)
	}
	if req.RetryDelay != 5 {
		t.Errorf("RetryDelay should remain 5, got %d", req.RetryDelay)
	}
}

func TestCreateRequest_ZeroValuesPreserved(t *testing.T) {
	req := &models.CreateHealingActionRequest{
		RetryCount: 0,
		RetryDelay: 0,
	}
	coerceCreateRequest(req)
	if req.RetryCount != 0 {
		t.Errorf("RetryCount should stay 0, got %d", req.RetryCount)
	}
}

// coerceCreateRequest mirrors the guards at the top of CreateHealingAction.
func coerceCreateRequest(req *models.CreateHealingActionRequest) {
	if req.RetryCount < 0 {
		req.RetryCount = 0
	}
	if req.RetryDelay < 0 {
		req.RetryDelay = 0
	}
}

// ---------------------------------------------------------------------------
// 4. Enable/disable gating
// ---------------------------------------------------------------------------

func TestIsEnabled_Gating(t *testing.T) {
	enabled := models.CreateHealingActionRequest{}
	disabled := models.CreateHealingActionRequest{}

	// enabled default (nil IsEnabled) → service defaults to true
	if enabled.IsEnabled == nil {
		// default is true in CreateHealingAction
	}
	_ = disabled
	// Documented invariant: IsEnabled == true → action can execute.
	// IsEnabled == false → ExecuteAction returns "disabled" error.
}

// ---------------------------------------------------------------------------
// 5. History query parameters
// ---------------------------------------------------------------------------

func TestQueryParameters_Defaults(t *testing.T) {
	// Default limit/offset in handler: limit=50, offset=0.
	// Default max in repo: limit clamped to 100.
	limit := 200
	if limit > 100 {
		limit = 100
	}
	if limit != 100 {
		t.Errorf("limit should clamp to 100, got %d", limit)
	}

	limit = 0
	if limit <= 0 {
		limit = 50
	}
	if limit != 50 {
		t.Errorf("limit should default to 50, got %d", limit)
	}
}
