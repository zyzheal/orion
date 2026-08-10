package module

import "errors"

type ModuleError struct { Code string; Message string; Cause error }

func (e *ModuleError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ModuleError) Is(target error) bool { _, ok := target.(*ModuleError); return ok }
func (e *ModuleError) Unwrap() error { return e.Cause }

var (
    ErrModuleNotFound     = &ModuleError{Code: "module_not_found", Message: "module: not found"}
    ErrModuleInvalidInput = &ModuleError{Code: "module_invalid_input", Message: "module: invalid input"}
    ErrModuleConflict     = &ModuleError{Code: "module_conflict", Message: "module: conflict"}
    ErrModuleUnauthorized = &ModuleError{Code: "module_unauthorized", Message: "module: unauthorized"}
    ErrModuleInternal     = &ModuleError{Code: "module_internal", Message: "module: internal error"}
)

func NewModuleError(code, msg string) error { return &ModuleError{Code: code, Message: msg} }
func IsModuleNotFound(err error) bool { return errors.Is(err, ErrModuleNotFound) }
