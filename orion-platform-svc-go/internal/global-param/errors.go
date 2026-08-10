package globalparam

import "errors"

type GlobalParamError struct { Code string; Message string; Cause error }

func (e *GlobalParamError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *GlobalParamError) Is(target error) bool { _, ok := target.(*GlobalParamError); return ok }
func (e *GlobalParamError) Unwrap() error { return e.Cause }

var (
    ErrGlobalParamNotFound     = &GlobalParamError{Code: "globalparam_not_found", Message: "global-param: not found"}
    ErrGlobalParamInvalidInput = &GlobalParamError{Code: "globalparam_invalid_input", Message: "global-param: invalid input"}
    ErrGlobalParamConflict     = &GlobalParamError{Code: "globalparam_conflict", Message: "global-param: conflict"}
    ErrGlobalParamUnauthorized = &GlobalParamError{Code: "globalparam_unauthorized", Message: "global-param: unauthorized"}
    ErrGlobalParamInternal     = &GlobalParamError{Code: "globalparam_internal", Message: "global-param: internal error"}
)

func NewGlobalParamError(code, msg string) error { return &GlobalParamError{Code: code, Message: msg} }
func IsGlobalParamNotFound(err error) bool { return errors.Is(err, ErrGlobalParamNotFound) }
