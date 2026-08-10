package scriptversion

import "errors"

type ScriptVersionError struct { Code string; Message string; Cause error }

func (e *ScriptVersionError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ScriptVersionError) Is(target error) bool { _, ok := target.(*ScriptVersionError); return ok }
func (e *ScriptVersionError) Unwrap() error { return e.Cause }

var (
    ErrScriptVersionNotFound     = &ScriptVersionError{Code: "scriptversion_not_found", Message: "script-version: not found"}
    ErrScriptVersionInvalidInput = &ScriptVersionError{Code: "scriptversion_invalid_input", Message: "script-version: invalid input"}
    ErrScriptVersionConflict     = &ScriptVersionError{Code: "scriptversion_conflict", Message: "script-version: conflict"}
    ErrScriptVersionUnauthorized = &ScriptVersionError{Code: "scriptversion_unauthorized", Message: "script-version: unauthorized"}
    ErrScriptVersionInternal     = &ScriptVersionError{Code: "scriptversion_internal", Message: "script-version: internal error"}
)

func NewScriptVersionError(code, msg string) error { return &ScriptVersionError{Code: code, Message: msg} }
func IsScriptVersionNotFound(err error) bool { return errors.Is(err, ErrScriptVersionNotFound) }
