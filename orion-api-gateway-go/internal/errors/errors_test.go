package errors

import (
	"strings"
	"testing"
)

func TestNew(t *testing.T) {
	err := New(CodeValidationError)
	if err == nil {
		t.Fatal("expected non-nil error")
	}
	if err.Code != CodeValidationError {
		t.Errorf("expected code %s, got %s", CodeValidationError, err.Code)
	}
	if err.Message == "" {
		t.Error("expected non-empty message")
	}
	if err.StatusCode == 0 {
		t.Error("expected non-zero status code")
	}
	if err.Timestamp == "" {
		t.Error("expected non-empty timestamp")
	}
}

func TestNewWithDetails(t *testing.T) {
	details := map[string]interface{}{"field": "email"}
	err := New(CodeValidationError, details)
	if err == nil {
		t.Fatal("expected non-nil error")
	}
	if err.Details == nil {
		t.Error("expected non-nil details")
	}
}

func TestNewWithUnknownCode(t *testing.T) {
	err := New("99999")
	if err == nil {
		t.Fatal("expected non-nil error")
	}
	if err.Message != "Unknown error" {
		t.Errorf("expected 'Unknown error', got %q", err.Message)
	}
	if err.StatusCode != 500 {
		t.Errorf("expected status 500, got %d", err.StatusCode)
	}
	if err.Category != CategoryUnknown {
		t.Errorf("expected CategoryUnknown, got %s", err.Category)
	}
}

func TestNewWithMessage(t *testing.T) {
	err := NewWithMessage(CodeValidationError, "custom message")
	if err == nil {
		t.Fatal("expected non-nil error")
	}
	if err.Message != "custom message" {
		t.Errorf("expected 'custom message', got %q", err.Message)
	}
}

func TestBadRequest(t *testing.T) {
	err := BadRequest("bad input")
	if err == nil {
		t.Fatal("expected non-nil error")
	}
	if err.Code != CodeValidationError {
		t.Errorf("expected code %s, got %s", CodeValidationError, err.Code)
	}
	if err.Message != "bad input" {
		t.Errorf("expected 'bad input', got %q", err.Message)
	}
}

func TestNotFound(t *testing.T) {
	err := NotFound("not found")
	if err == nil {
		t.Fatal("expected non-nil error")
	}
	if err.Code != CodeResourceNotFound {
		t.Errorf("expected code %s, got %s", CodeResourceNotFound, err.Code)
	}
}

func TestUnauthorized(t *testing.T) {
	err := Unauthorized("missing token")
	if err == nil {
		t.Fatal("expected non-nil error")
	}
	if err.Code != CodeTokenMissing {
		t.Errorf("expected code %s, got %s", CodeTokenMissing, err.Code)
	}
}

func TestForbidden(t *testing.T) {
	err := Forbidden("no permission")
	if err == nil {
		t.Fatal("expected non-nil error")
	}
	if err.Code != CodePermissionDenied {
		t.Errorf("expected code %s, got %s", CodePermissionDenied, err.Code)
	}
}

func TestInternal(t *testing.T) {
	err := Internal("internal error")
	if err == nil {
		t.Fatal("expected non-nil error")
	}
	if err.Code != CodeConfigInvalid {
		t.Errorf("expected code %s, got %s", CodeConfigInvalid, err.Code)
	}
}

func TestAppError_ErrorString(t *testing.T) {
	err := New(CodeValidationError)
	msg := err.Error()
	if !strings.Contains(msg, err.Code) {
		t.Errorf("error message should contain code, got %q", msg)
	}
}

func TestHTTPStatusOf(t *testing.T) {
	tests := map[string]int{
		CodeValidationError:     400,
		CodeResourceNotFound:    404,
		CodeTokenMissing:        401,
		CodePermissionDenied:    403,
		CodeConfigInvalid:       500,
		CodeRateLimitExceeded:   429,
		CodeGatewayUnavailable:  503,
	}
	for code, expected := range tests {
		got := HTTPStatusOf(code)
		if got != expected {
			t.Errorf("HTTPStatusOf(%s): expected %d, got %d", code, expected, got)
		}
	}
	// Unknown code
	if got := HTTPStatusOf("99999"); got != 500 {
		t.Errorf("HTTPStatusOf(unknown): expected 500, got %d", got)
	}
}

func TestMessageOf(t *testing.T) {
	msg := MessageOf(CodeValidationError)
	if msg == "" {
		t.Error("expected non-empty message")
	}
	// Unknown code
	msg = MessageOf("99999")
	if msg != "Unknown error" {
		t.Errorf("expected 'Unknown error', got %q", msg)
	}
}

func TestParseCategory(t *testing.T) {
	tests := []struct {
		code     string
		expected Category
	}{
		{"10101", CategoryPlatform},
		{"20101", CategoryAuth},
		{"30101", CategoryBusiness},
		{"40101", CategoryExternal},
		{"", CategoryUnknown},
		{"00000", CategoryUnknown},
	}
	for _, tt := range tests {
		got := parseCategory(tt.code)
		if got != tt.expected {
			t.Errorf("parseCategory(%s): expected %s, got %s", tt.code, tt.expected, got)
		}
	}
}

func TestErrorCodeUniqueness(t *testing.T) {
	codes := []string{
		CodeGatewayUnavailable, CodeRouteNotFound, CodeMethodNotAllowed,
		CodeRateLimitExceeded, CodeConfigInvalid,
		CodeTokenExpired, CodeTokenInvalid, CodeTokenMissing,
		CodePermissionDenied,
		CodeValidationError, CodeResourceNotFound,
		CodeResourceExists, CodeResourceDeleted,
		CodeInvalidState, CodeStateTransitionForbidden,
	}
	seen := make(map[string]bool)
	for _, code := range codes {
		if code == "" {
			t.Error("empty code constant found")
		}
		if seen[code] {
			t.Errorf("duplicate error code: %s", code)
		}
		seen[code] = true
	}
}

func TestAppError_Category(t *testing.T) {
	err := New(CodeTokenExpired)
	if err.Category != CategoryAuth {
		t.Errorf("expected CategoryAuth, got %s", err.Category)
	}
}

func TestNewDetailsNilWhenNoArgs(t *testing.T) {
	err := New(CodeValidationError)
	if err.Details != nil {
		t.Errorf("expected nil details with no args, got %v", err.Details)
	}
}
