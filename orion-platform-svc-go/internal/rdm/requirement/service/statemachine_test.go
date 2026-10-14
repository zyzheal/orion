package service

import (
	"errors"
	"testing"
)

func TestValidateReqTransition_Valid(t *testing.T) {
	tests := []struct {
		from, to string
	}{
		{"draft", "in_review"},
		{"draft", "in_progress"},
		{"draft", "closed"},
		{"in_review", "approved"},
		{"in_review", "rejected"},
		{"in_review", "draft"},
		{"approved", "in_progress"},
		{"rejected", "draft"},
		{"in_progress", "testing"},
		{"in_progress", "done"},
		{"testing", "done"},
		{"testing", "in_progress"},
		{"done", "closed"},
		{"done", "in_progress"},
	}
	for _, tt := range tests {
		if err := ValidateReqTransition(tt.from, tt.to); err != nil {
			t.Errorf("transition %s → %s should be valid, got %v", tt.from, tt.to, err)
		}
	}
}

func TestValidateReqTransition_Invalid(t *testing.T) {
	tests := []struct {
		from, to string
	}{
		{"draft", "done"},        // skip in_review/approved
		{"draft", "approved"},    // must go through in_review
		{"closed", "draft"},      // terminal state
		{"closed", "in_progress"},
		{"done", "draft"},        // must go through in_progress
		{"approved", "testing"},  // must go through in_progress
		{"rejected", "approved"}, // must go through draft → in_review
	}
	for _, tt := range tests {
		err := ValidateReqTransition(tt.from, tt.to)
		if err == nil {
			t.Errorf("transition %s → %s should be invalid", tt.from, tt.to)
		}
	}
}

func TestValidateReqTransition_UnknownStatus(t *testing.T) {
	err := ValidateReqTransition("draft", "bogus")
	if err == nil {
		t.Fatal("expected error for unknown target status")
	}
	if !errors.Is(err, ErrUnknownReqStatus) {
		t.Errorf("expected ErrUnknownReqStatus, got %v", err)
	}
}

func TestValidateReqTransition_UnknownFrom(t *testing.T) {
	err := ValidateReqTransition("bogus", "draft")
	if err == nil {
		t.Fatal("expected error for unknown source status")
	}
	if !errors.Is(err, ErrUnknownReqStatus) {
		t.Errorf("expected ErrUnknownReqStatus, got %v", err)
	}
}

func TestIsValidReqStatus(t *testing.T) {
	for _, s := range AllRequirementStatuses {
		if !IsValidReqStatus(s) {
			t.Errorf("status %q should be valid", s)
		}
	}
	if IsValidReqStatus("bogus") {
		t.Error("bogus should not be valid")
	}
}

func TestCanReqTransition_TerminalState(t *testing.T) {
	// closed is terminal — no outgoing transitions
	for _, to := range AllRequirementStatuses {
		if CanReqTransition("closed", to) {
			t.Errorf("closed → %s should not be allowed (terminal)", to)
		}
	}
}
