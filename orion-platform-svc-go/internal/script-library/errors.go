package scriptlibrary

import "errors"

type ScriptLibraryError struct { Code string; Message string; Cause error }

func (e *ScriptLibraryError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ScriptLibraryError) Is(target error) bool { _, ok := target.(*ScriptLibraryError); return ok }
func (e *ScriptLibraryError) Unwrap() error { return e.Cause }

var (
    ErrScriptLibraryNotFound     = &ScriptLibraryError{Code: "scriptlibrary_not_found", Message: "script-library: not found"}
    ErrScriptLibraryInvalidInput = &ScriptLibraryError{Code: "scriptlibrary_invalid_input", Message: "script-library: invalid input"}
    ErrScriptLibraryConflict     = &ScriptLibraryError{Code: "scriptlibrary_conflict", Message: "script-library: conflict"}
    ErrScriptLibraryUnauthorized = &ScriptLibraryError{Code: "scriptlibrary_unauthorized", Message: "script-library: unauthorized"}
    ErrScriptLibraryInternal     = &ScriptLibraryError{Code: "scriptlibrary_internal", Message: "script-library: internal error"}
)

func NewScriptLibraryError(code, msg string) error { return &ScriptLibraryError{Code: code, Message: msg} }
func IsScriptLibraryNotFound(err error) bool { return errors.Is(err, ErrScriptLibraryNotFound) }
