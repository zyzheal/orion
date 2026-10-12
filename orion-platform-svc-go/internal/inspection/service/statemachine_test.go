package service

import (
	"errors"
	"testing"
)

func TestIsValidStatus(t *testing.T) {
	for _, s := range AllStatuses {
		if !IsValidStatus(s) {
			t.Errorf("expected %s to be valid", s)
		}
	}
	for _, bad := range []string{"", "unknown", "success", "FAILED", " "} {
		if IsValidStatus(bad) {
			t.Errorf("expected %q to be invalid", bad)
		}
	}
}

func TestCanTransition_Happy(t *testing.T) {
	cases := [][2]string{
		{StatusPending, StatusRunning},
		{StatusPending, StatusCancelled},
		{StatusRunning, StatusPassed},
		{StatusRunning, StatusFailed},
		{StatusRunning, StatusWarning},
		{StatusRunning, StatusCancelled},
		{StatusPassed, StatusRunning},
		{StatusFailed, StatusRunning},
		{StatusWarning, StatusPassed},
	}
	for _, c := range cases {
		if !CanTransition(c[0], c[1]) {
			t.Errorf("expected %s -> %s to be allowed", c[0], c[1])
		}
	}
}

func TestCanTransition_Illegal(t *testing.T) {
	cases := [][2]string{
		{StatusCancelled, StatusRunning},
		{StatusPassed, StatusFailed},
		{StatusFailed, StatusPassed},
		{StatusPending, StatusPassed},   // must go through running
		{StatusRunning, StatusRunning},  // no self-loop
	}
	for _, c := range cases {
		if CanTransition(c[0], c[1]) {
			t.Errorf("expected %s -> %s to be rejected", c[0], c[1])
		}
	}
}

func TestCanTransition_Unknown(t *testing.T) {
	if CanTransition("unknown", StatusRunning) {
		t.Error("unknown source must be rejected")
	}
	if CanTransition(StatusPending, "unknown") {
		t.Error("unknown target must be rejected")
	}
}

func TestValidateTransition_Errors(t *testing.T) {
	if err := ValidateTransition(StatusPending, StatusRunning); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
	err := ValidateTransition(StatusPending, "bogus")
	if err == nil {
		t.Fatal("expected unknown-status error")
	}
	if !errors.Is(err, ErrUnknownStatus) {
		t.Errorf("expected ErrUnknownStatus, got %v", err)
	}
	err = ValidateTransition(StatusPassed, StatusFailed)
	if err == nil {
		t.Fatal("expected illegal transition error")
	}
	var te *TransitionError
	if !errors.As(err, &te) {
		t.Errorf("expected *TransitionError, got %T", err)
	}
}
