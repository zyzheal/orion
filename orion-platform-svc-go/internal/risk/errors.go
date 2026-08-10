package risk

import "errors"

type RiskError struct { Code string; Message string; Cause error }

func (e *RiskError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *RiskError) Is(target error) bool { _, ok := target.(*RiskError); return ok }
func (e *RiskError) Unwrap() error { return e.Cause }

var (
    ErrRiskNotFound     = &RiskError{Code: "risk_not_found", Message: "risk: not found"}
    ErrRiskInvalidInput = &RiskError{Code: "risk_invalid_input", Message: "risk: invalid input"}
    ErrRiskConflict     = &RiskError{Code: "risk_conflict", Message: "risk: conflict"}
    ErrRiskUnauthorized = &RiskError{Code: "risk_unauthorized", Message: "risk: unauthorized"}
    ErrRiskInternal     = &RiskError{Code: "risk_internal", Message: "risk: internal error"}
)

func NewRiskError(code, msg string) error { return &RiskError{Code: code, Message: msg} }
func IsRiskNotFound(err error) bool { return errors.Is(err, ErrRiskNotFound) }
