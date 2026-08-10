package handler

import "errors"

type RuleEngineError struct { Code string; Message string; Cause error }

func (e *RuleEngineError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *RuleEngineError) Is(target error) bool { _, ok := target.(*RuleEngineError); return ok }
func (e *RuleEngineError) Unwrap() error { return e.Cause }

var (
    ErrRuleEngineNotFound     = &RuleEngineError{Code: "ruleengine_not_found", Message: "rule-engine: not found"}
    ErrRuleEngineInvalidInput = &RuleEngineError{Code: "ruleengine_invalid_input", Message: "rule-engine: invalid input"}
    ErrRuleEngineConflict     = &RuleEngineError{Code: "ruleengine_conflict", Message: "rule-engine: conflict"}
    ErrRuleEngineUnauthorized = &RuleEngineError{Code: "ruleengine_unauthorized", Message: "rule-engine: unauthorized"}
    ErrRuleEngineInternal     = &RuleEngineError{Code: "ruleengine_internal", Message: "rule-engine: internal error"}
)

func NewRuleEngineError(code, msg string) error { return &RuleEngineError{Code: code, Message: msg} }
func IsRuleEngineNotFound(err error) bool { return errors.Is(err, ErrRuleEngineNotFound) }
