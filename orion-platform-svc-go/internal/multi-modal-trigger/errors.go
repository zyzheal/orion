package multimodaltrigger

import "errors"

type MultiModalTriggerError struct { Code string; Message string; Cause error }

func (e *MultiModalTriggerError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *MultiModalTriggerError) Is(target error) bool { _, ok := target.(*MultiModalTriggerError); return ok }
func (e *MultiModalTriggerError) Unwrap() error { return e.Cause }

var (
    ErrMultiModalTriggerNotFound     = &MultiModalTriggerError{Code: "multimodaltrigger_not_found", Message: "multi-modal-trigger: not found"}
    ErrMultiModalTriggerInvalidInput = &MultiModalTriggerError{Code: "multimodaltrigger_invalid_input", Message: "multi-modal-trigger: invalid input"}
    ErrMultiModalTriggerConflict     = &MultiModalTriggerError{Code: "multimodaltrigger_conflict", Message: "multi-modal-trigger: conflict"}
    ErrMultiModalTriggerUnauthorized = &MultiModalTriggerError{Code: "multimodaltrigger_unauthorized", Message: "multi-modal-trigger: unauthorized"}
    ErrMultiModalTriggerInternal     = &MultiModalTriggerError{Code: "multimodaltrigger_internal", Message: "multi-modal-trigger: internal error"}
)

func NewMultiModalTriggerError(code, msg string) error { return &MultiModalTriggerError{Code: code, Message: msg} }
func IsMultiModalTriggerNotFound(err error) bool { return errors.Is(err, ErrMultiModalTriggerNotFound) }
