package script

import "errors"

type ScriptError struct { Code string; Message string; Cause error }

func (e *ScriptError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ScriptError) Is(target error) bool { _, ok := target.(*ScriptError); return ok }
func (e *ScriptError) Unwrap() error { return e.Cause }

var (
    ErrScriptNotFound     = &ScriptError{Code: "script_not_found", Message: "script: not found"}
    ErrScriptInvalidInput = &ScriptError{Code: "script_invalid_input", Message: "script: invalid input"}
    ErrScriptConflict     = &ScriptError{Code: "script_conflict", Message: "script: conflict"}
    ErrScriptUnauthorized = &ScriptError{Code: "script_unauthorized", Message: "script: unauthorized"}
    ErrScriptInternal     = &ScriptError{Code: "script_internal", Message: "script: internal error"}
)

func NewScriptError(code, msg string) error { return &ScriptError{Code: code, Message: msg} }
func IsScriptNotFound(err error) bool { return errors.Is(err, ErrScriptNotFound) }
