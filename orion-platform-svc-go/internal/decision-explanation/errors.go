package decisionexplanation

import "errors"

type DecisionExplanationError struct { Code string; Message string; Cause error }

func (e *DecisionExplanationError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *DecisionExplanationError) Is(target error) bool { _, ok := target.(*DecisionExplanationError); return ok }
func (e *DecisionExplanationError) Unwrap() error { return e.Cause }

var (
    ErrDecisionExplanationNotFound     = &DecisionExplanationError{Code: "decisionexplanation_not_found", Message: "decision-explanation: not found"}
    ErrDecisionExplanationInvalidInput = &DecisionExplanationError{Code: "decisionexplanation_invalid_input", Message: "decision-explanation: invalid input"}
    ErrDecisionExplanationConflict     = &DecisionExplanationError{Code: "decisionexplanation_conflict", Message: "decision-explanation: conflict"}
    ErrDecisionExplanationUnauthorized = &DecisionExplanationError{Code: "decisionexplanation_unauthorized", Message: "decision-explanation: unauthorized"}
    ErrDecisionExplanationInternal     = &DecisionExplanationError{Code: "decisionexplanation_internal", Message: "decision-explanation: internal error"}
)

func NewDecisionExplanationError(code, msg string) error { return &DecisionExplanationError{Code: code, Message: msg} }
func IsDecisionExplanationNotFound(err error) bool { return errors.Is(err, ErrDecisionExplanationNotFound) }
