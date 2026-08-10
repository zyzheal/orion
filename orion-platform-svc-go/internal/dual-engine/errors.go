package dualengine

import "errors"

type DualEngineError struct { Code string; Message string; Cause error }

func (e *DualEngineError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *DualEngineError) Is(target error) bool { _, ok := target.(*DualEngineError); return ok }
func (e *DualEngineError) Unwrap() error { return e.Cause }

var (
    ErrDualEngineNotFound     = &DualEngineError{Code: "dualengine_not_found", Message: "dual-engine: not found"}
    ErrDualEngineInvalidInput = &DualEngineError{Code: "dualengine_invalid_input", Message: "dual-engine: invalid input"}
    ErrDualEngineConflict     = &DualEngineError{Code: "dualengine_conflict", Message: "dual-engine: conflict"}
    ErrDualEngineUnauthorized = &DualEngineError{Code: "dualengine_unauthorized", Message: "dual-engine: unauthorized"}
    ErrDualEngineInternal     = &DualEngineError{Code: "dualengine_internal", Message: "dual-engine: internal error"}
)

func NewDualEngineError(code, msg string) error { return &DualEngineError{Code: code, Message: msg} }
func IsDualEngineNotFound(err error) bool { return errors.Is(err, ErrDualEngineNotFound) }
