package common

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// OrionError basics
// ---------------------------------------------------------------------------

func TestOrionErrorNilSafeError(t *testing.T) {
	var e *OrionError
	if got := e.Error(); got != "<nil>" {
		t.Errorf("nil Error() = %q, want <nil>", got)
	}
}

func TestOrionErrorStringFormat(t *testing.T) {
	e := NewClient(CodeNotFound, "resource not found")
	if got := e.Error(); !strings.HasPrefix(got, "CLIENT.NOT_FOUND:") {
		t.Errorf("Error() = %q", got)
	}
	if !strings.Contains(e.Error(), "resource not found") {
		t.Errorf("Error() missing message: %q", e.Error())
	}
}

func TestNewClientDerivesHTTPStatus(t *testing.T) {
	cases := []struct {
		code string
		want int
	}{
		{"", http.StatusBadRequest},
		{CodeUnauthorized, http.StatusUnauthorized},
		{CodeForbidden, http.StatusForbidden},
		{CodeNotFound, http.StatusNotFound},
		{CodeConflict, http.StatusConflict},
		{CodePreconditionFail, http.StatusPreconditionFailed},
		{CodeValidationFail, http.StatusBadRequest},
		{CodeInspectionThresholdInv, http.StatusBadRequest},
		{CodeTenantMismatch, http.StatusForbidden},
		{CodeConfigFileVersionConflict, http.StatusConflict},
		{CodeSlowQuery, http.StatusServiceUnavailable},
		{CodeUnsupportedMediaType, http.StatusUnsupportedMediaType},
		{"CLIENT.UNKNOWN", http.StatusBadRequest},
	}
	for _, tc := range cases {
		e := NewClient(tc.code, "x")
		if e.HTTPStatus != tc.want {
			t.Errorf("code %q → status %d, want %d", tc.code, e.HTTPStatus, tc.want)
		}
	}
}

func TestNewServerDerivesHTTPStatus(t *testing.T) {
	cases := []struct {
		code string
		want int
	}{
		{"", http.StatusInternalServerError},
		{CodeInternal, http.StatusInternalServerError},
		{CodeDBUnavail, http.StatusServiceUnavailable},
		{CodeDepUnavail, http.StatusServiceUnavailable},
		{CodeNetworkUnreach, http.StatusServiceUnavailable},
		{CodeTimeout, http.StatusGatewayTimeout},
		{CodeCircuitOpen, http.StatusTooManyRequests},
		{CodeRateLimited, http.StatusTooManyRequests},
		{CodeNotImplemented, http.StatusNotImplemented},
		{"SERVER.UNKNOWN", http.StatusInternalServerError},
	}
	for _, tc := range cases {
		e := NewServer(tc.code, "x")
		if e.HTTPStatus != tc.want {
			t.Errorf("code %q → status %d, want %d", tc.code, e.HTTPStatus, tc.want)
		}
	}
}

func TestRetryableFlag(t *testing.T) {
	if NewClient(CodeNotFound, "x").Retryable {
		t.Error("CLIENT.* must not be retryable")
	}
	if !NewServer(CodeInternal, "x").Retryable {
		t.Error("SERVER.* must be retryable")
	}
}

func TestWrapClientPreservesCause(t *testing.T) {
	cause := errors.New("db down")
	e := WrapClient(CodeNotFound, "not found", cause)
	if !errors.Is(e, cause) {
		t.Error("WrapClient should preserve cause via errors.Is")
	}
	if e.Meta["caused_by"] != "db down" {
		t.Errorf("meta.caused_by = %q", e.Meta["caused_by"])
	}
}

func TestWithMetaMerges(t *testing.T) {
	e := NewClient(CodeNotFound, "x").WithMeta(map[string]string{"tenant_id": "t1"})
	e.WithMeta(map[string]string{"tenant_id": "t2", "request_id": "r1"})
	if e.Meta["tenant_id"] != "t2" || e.Meta["request_id"] != "r1" {
		t.Errorf("merge failed: %v", e.Meta)
	}
}

func TestCodeOfAndStatusOf(t *testing.T) {
	if CodeOf(nil) != "" {
		t.Error("CodeOf(nil) should be empty")
	}
	e := NewClient(CodeNotFound, "x")
	if CodeOf(e) != CodeNotFound {
		t.Errorf("CodeOf = %q", CodeOf(e))
	}
	if CodeOf(errors.New("plain")) != "" {
		t.Error("CodeOf(plain) should be empty")
	}

	if StatusOf(nil) != http.StatusOK {
		t.Error("StatusOf(nil) should be 200")
	}
	if StatusOf(e) != http.StatusNotFound {
		t.Errorf("StatusOf(OrionError) = %d", StatusOf(e))
	}
	if StatusOf(errors.New("plain")) != http.StatusInternalServerError {
		t.Errorf("StatusOf(plain) = %d, want 500", StatusOf(e))
	}
}

// ---------------------------------------------------------------------------
// Sentinel errors — P0 set (Y 手册 §S0-T1)
// ---------------------------------------------------------------------------

func TestP0SentinelsAreWiredToClientNamespace(t *testing.T) {
	sentinels := []struct {
		name string
		err  error
		want string
	}{
		// Generic
		{"ErrUnauthorized", ErrUnauthorized, CodeUnauthorized},
		{"ErrForbidden", ErrForbidden, CodeForbidden},
		{"ErrNotFound", ErrNotFound, CodeNotFound},
		{"ErrConflict", ErrConflict, CodeConflict},
		{"ErrValidationFailed", ErrValidationFailed, CodeValidationFail},
		{"ErrInvalidArgument", ErrInvalidArgument, CodeInvalidArg},
		{"ErrRateLimited", ErrRateLimited, CodeTooManyRequests},
		{"ErrTenantMismatch", ErrTenantMismatch, CodeTenantMismatch},
		// Inspection
		{"ErrInspectionNotFound", ErrInspectionNotFound, CodeInspectionNotFound},
		{"ErrInspectionThresholdInvalid", ErrInspectionThresholdInvalid, CodeInspectionThresholdInv},
		{"ErrInspectionConfigFileMissing", ErrInspectionConfigFileMissing, CodeInspectionConfigFileMissing},
		// Chaos
		{"ErrChaosInjectorUnavailable", ErrChaosInjectorUnavailable, CodeChaosInjectorUnavailable},
		{"ErrChaosExperimentInvalid", ErrChaosExperimentInvalid, CodeChaosExperimentInvalid},
		// Risk / Scenario
		{"ErrRiskApprovalRequired", ErrRiskApprovalRequired, CodeRiskApprovalRequired},
		{"ErrScenarioNotFound", ErrScenarioNotFound, CodeScenarioNotFound},
		{"ErrScenarioInactive", ErrScenarioInactive, CodeScenarioInactive},
		// Configfile
		{"ErrConfigFileVersionConflict", ErrConfigFileVersionConflict, CodeConfigFileVersionConflict},
		{"ErrConfigFileNotFound", ErrConfigFileNotFound, CodeConfigFileNotFound},
		// Ticket
		{"ErrTicketNotFound", ErrTicketNotFound, CodeTicketNotFound},
		{"ErrTicketInvalidState", ErrTicketInvalidState, CodeTicketInvalidState},
		// Alert
		{"ErrAlertNotFound", ErrAlertNotFound, CodeAlertNotFound},
		{"ErrAlertBreakerOpen", ErrAlertBreakerOpen, CodeAlertBreakerOpen},
		// Auth
		{"ErrAuthRequired", ErrAuthRequired, CodeAuthRequired},
		{"ErrPermissionDenied", ErrPermissionDenied, CodePermissionDenied},
		// DoS guard
		{"ErrSlowQuery", ErrSlowQuery, CodeSlowQuery},
		{"ErrPayloadTooLarge", ErrPayloadTooLarge, CodePayloadTooLarge},
		{"ErrUnsupportedMediaType", ErrUnsupportedMediaType, CodeUnsupportedMediaType},
		// Existence
		{"ErrAlreadyExists", ErrAlreadyExists, CodeAlreadyExists},
	}
	for _, tc := range sentinels {
		if CodeOf(tc.err) != tc.want {
			t.Errorf("%s: code = %q, want %q", tc.name, CodeOf(tc.err), tc.want)
		}
		var oe *OrionError
		if !errors.As(tc.err, &oe) || !oe.IsClient() {
			t.Errorf("%s: not a CLIENT OrionError", tc.name)
		}
	}
}

func TestServerSentinels(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want string
	}{
		{"ErrInternal", ErrInternal, CodeInternal},
		{"ErrDBUnavailable", ErrDBUnavailable, CodeDBUnavail},
		{"ErrDependencyUnavail", ErrDependencyUnavail, CodeDepUnavail},
		{"ErrTimeout", ErrTimeout, CodeTimeout},
		{"ErrCircuitOpen", ErrCircuitOpen, CodeCircuitOpen},
		{"ErrNotImplemented", ErrNotImplemented, CodeNotImplemented},
	}
	for _, tc := range cases {
		if CodeOf(tc.err) != tc.want {
			t.Errorf("%s: code = %q, want %q", tc.name, CodeOf(tc.err), tc.want)
		}
	}
}

func TestSentinelsAreDistinct(t *testing.T) {
	// Errors.Is should not cross-match between unrelated sentinels.
	if errors.Is(ErrNotFound, ErrTicketNotFound) ||
		errors.Is(ErrTicketNotFound, ErrNotFound) {
		t.Error("distinct sentinels should not match via errors.Is")
	}
	if errors.Is(ErrInternal, ErrDBUnavailable) {
		t.Error("SERVER sentinels must be distinct")
	}
}

func TestWrapWithSentinel(t *testing.T) {
	cause := errors.New("db timeout")
	wrapped := WrapClient(CodeInspectionNotFound, "not found", cause)
	if !errors.Is(wrapped, ErrInspectionNotFound) {
		t.Error("wrapped should still match ErrInspectionNotFound via errors.Is")
	}
	if !errors.Is(wrapped, cause) {
		t.Error("wrapped should preserve underlying cause")
	}
}

func TestIsNotImplemented(t *testing.T) {
	if !IsNotImplemented(ErrNotImplemented) {
		t.Error("IsNotImplemented(ErrNotImplemented) should be true")
	}
	if !IsNotImplemented(errors.Join(errors.New("x"), ErrNotImplemented)) {
		t.Error("IsNotImplemented should unwrap via errors.Is")
	}
	if IsNotImplemented(errors.New("plain")) {
		t.Error("IsNotImplemented(plain) should be false")
	}
}
