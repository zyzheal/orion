package service

import (
	"errors"
	"fmt"
)

// Requirement status state-machine. Controls the lifecycle of a requirement
// from draft through review, development, testing, and completion.
//
// Terminal state: closed (no outgoing transitions).
const (
	StatusDraft      = "draft"
	StatusInReview   = "in_review"
	StatusApproved   = "approved"
	StatusRejected   = "rejected"
	StatusInProgress = "in_progress"
	StatusTesting    = "testing"
	StatusDone       = "done"
	StatusClosed     = "closed"
)

// AllRequirementStatuses enumerates every valid status string.
var AllRequirementStatuses = []string{
	StatusDraft, StatusInReview, StatusApproved, StatusRejected,
	StatusInProgress, StatusTesting, StatusDone, StatusClosed,
}

// reqTransitions is the authoritative state machine. From → allowed set of To.
var reqTransitions = map[string]map[string]bool{
	StatusDraft: {
		StatusInReview: true, StatusInProgress: true, StatusClosed: true,
	},
	StatusInReview: {
		StatusApproved: true, StatusRejected: true, StatusDraft: true,
	},
	StatusApproved: {
		StatusInProgress: true, StatusClosed: true,
	},
	StatusRejected: {
		StatusDraft: true, StatusClosed: true,
	},
	StatusInProgress: {
		StatusTesting: true, StatusDone: true, StatusDraft: true,
	},
	StatusTesting: {
		StatusDone: true, StatusInProgress: true,
	},
	StatusDone: {
		StatusClosed: true, StatusInProgress: true,
	},
	StatusClosed: {},
}

// ErrUnknownReqStatus is returned when a status string is not recognized.
var ErrUnknownReqStatus = errors.New("requirement: unknown status")

// ErrInvalidReqTransition is returned when the requested transition is not allowed.
var ErrInvalidReqTransition = errors.New("requirement: invalid transition")

// IsValidReqStatus reports whether the status string is recognized.
func IsValidReqStatus(s string) bool {
	_, ok := reqTransitions[s]
	return ok
}

// CanReqTransition reports whether from→to is allowed.
func CanReqTransition(from, to string) bool {
	next, ok := reqTransitions[from]
	if !ok {
		return false
	}
	return next[to]
}

// ValidateReqTransition returns nil if the transition is valid, or a
// descriptive error distinguishing unknown-state from illegal-transition.
func ValidateReqTransition(from, to string) error {
	if !IsValidReqStatus(to) {
		return fmt.Errorf("%w: %q", ErrUnknownReqStatus, to)
	}
	if !IsValidReqStatus(from) {
		return fmt.Errorf("%w: %q", ErrUnknownReqStatus, from)
	}
	if CanReqTransition(from, to) {
		return nil
	}
	return fmt.Errorf("%w: %s -> %s", ErrInvalidReqTransition, from, to)
}
