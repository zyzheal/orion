package service

import (
	"errors"
	"fmt"
)

// Inspection status state-machine. Replaces the previous blind
// "write any status" behavior of Service.UpdateStatus.
//
// Terminal states have no outgoing edges except for a forced re-run via
// RunInspection (which always drives pending→running→passed|failed).
const (
	StatusPending = "pending"
	StatusRunning = "running"
	StatusPassed  = "passed"
	StatusFailed  = "failed"
	StatusWarning = "warning"
	StatusCancelled = "cancelled"
)

// AllStatuses enumerates every valid status string; used by handler validators.
var AllStatuses = []string{
	StatusPending, StatusRunning, StatusPassed, StatusFailed, StatusWarning, StatusCancelled,
}

// transitions is the authoritative state machine. From → allowed set of To.
var transitions = map[string]map[string]bool{
	StatusPending: {
		StatusRunning: true, StatusCancelled: true, StatusFailed: true,
	},
	StatusRunning: {
		StatusPassed: true, StatusFailed: true, StatusWarning: true, StatusCancelled: true,
	},
	StatusPassed: {
		StatusRunning: true, StatusCancelled: true,
	},
	StatusFailed: {
		StatusRunning: true, StatusCancelled: true,
	},
	StatusWarning: {
		StatusRunning: true, StatusPassed: true, StatusFailed: true, StatusCancelled: true,
	},
	StatusCancelled: {},
}

// ErrUnknownStatus is returned when a status string is not in AllStatuses.
var ErrUnknownStatus = errors.New("inspection: unknown status")

// ErrInvalidTransition is returned when the requested transition is not
// allowed by the state machine.
var ErrInvalidTransition = errors.New("inspection: invalid transition")

// IsValidStatus reports whether the status string is recognized.
func IsValidStatus(s string) bool {
	_, ok := transitions[s]
	return ok
}

// CanTransition reports whether from→to is allowed.
// Either state unknown ⇒ false.
func CanTransition(from, to string) bool {
	next, ok := transitions[from]
	if !ok {
		return false
	}
	return next[to]
}

// TransitionError is the returned *error wrapper; callers can inspect
// From/To to render a useful message without parsing the error string.
type TransitionError struct {
	From string
	To   string
}

func (e *TransitionError) Error() string {
	return fmt.Sprintf("inspection: transition %s -> %s not allowed", e.From, e.To)
}

func (e *TransitionError) Is(target error) bool {
	_, ok := target.(*TransitionError)
	return ok
}

var errInvalidTransitionAny = &TransitionError{}

// ValidateTransition returns a descriptive error for the invalid case
// and nil otherwise. It distinguishes unknown-state from illegal-transition
// so handlers can map to different HTTP codes if desired.
func ValidateTransition(from, to string) error {
	if !IsValidStatus(to) {
		return fmt.Errorf("%w: %q", ErrUnknownStatus, to)
	}
	if !IsValidStatus(from) {
		return fmt.Errorf("%w: %q", ErrUnknownStatus, from)
	}
	if CanTransition(from, to) {
		return nil
	}
	return errInvalidTransitionAny
}
